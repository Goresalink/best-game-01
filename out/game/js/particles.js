// particles.js — sparks, embers, shockwave rings and floating text.
// Purely visual: nothing here changes the score or the game state, so a
// particle bug can never break the game, only the look.
export function spawnBurst(G, x, y, color, count, speed, life) {
  for (let i = 0; i < count; i++) {
    const a = G.rng() * Math.PI * 2;
    const sp = speed * (0.3 + G.rng() * 0.7);
    G.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: life * (0.5 + G.rng() * 0.5),
      maxLife: life,
      size: 2 + G.rng() * 3.5,
      color,
      drag: 0.92,
    });
  }
}

export function spawnRing(G, x, y, color, maxR) {
  G.rings.push({ x, y, r: 6, maxR: maxR || 120, life: 0.45, maxLife: 0.45, color });
}

export function spawnText(G, x, y, text, color, size) {
  G.texts.push({ x, y, text, color: color || '#ffffff', size: size || 16, life: 0.9, maxLife: 0.9 });
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      G.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= p.drag;
    p.vy *= p.drag;
  }
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const r = G.rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      G.rings.splice(i, 1);
      continue;
    }
    const t = 1 - r.life / r.maxLife;
    r.r = 6 + (r.maxR - 6) * (1 - (1 - t) * (1 - t));
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.life -= dt;
    t.y -= 42 * dt;
    if (t.life <= 0) G.texts.splice(i, 1);
  }
  // Ambient drifting embers keep the arena alive even when nothing fights.
  if (G.particles.length < 90 && G.rng() < dt * 14) {
    G.particles.push({
      x: G.rng() * G.width,
      y: G.height + 6,
      vx: (G.rng() - 0.5) * 12,
      vy: -14 - G.rng() * 22,
      life: 5 + G.rng() * 3,
      maxLife: 8,
      size: 1 + G.rng() * 2,
      color: G.rng() < 0.7 ? '#ff9a3c' : '#ffd27a',
      drag: 1,
    });
  }
}

export function drawParticles(G, ctx) {
  for (const p of G.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const r of G.rings) {
    const a = Math.max(0, r.life / r.maxLife);
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const t of G.texts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = a;
    ctx.font = 'bold ' + t.size + 'px Georgia, serif';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
