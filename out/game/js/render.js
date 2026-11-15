// render.js — everything drawn inside the arena: the floor, gems,
// pickups, enemies, the player, bolts, particles, and the HUD on top.
// The arena is a fixed 1280x720 world; the canvas is exactly that size.
import { clamp } from './util.js';
import { drawParticles } from './particles.js';

export function drawWorld(G, ctx) {
  drawFloor(G, ctx);
  drawGems(G, ctx);
  drawPickups(G, ctx);
  drawEnemies(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);
  drawVignette(G, ctx);
}

function drawFloor(G, ctx) {
  const grad = ctx.createRadialGradient(
    G.width / 2, G.height / 2, 80,
    G.width / 2, G.height / 2, 760,
  );
  grad.addColorStop(0, '#17142e');
  grad.addColorStop(1, '#0a0918');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, G.width, G.height);

  // Faint floor grid, lit from the lantern's side.
  ctx.strokeStyle = 'rgba(120, 110, 220, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= G.width; x += 64) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, G.height);
  }
  for (let y = 0; y <= G.height; y += 64) {
    ctx.moveTo(0, y);
    ctx.lineTo(G.width, y);
  }
  ctx.stroke();

  // The arena's edge: a low stone rim that reads as a boundary.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, G.width - 20, G.height - 20);
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.12)';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, G.width - 12, G.height - 12);
}

function drawGems(G, ctx) {
  for (const gem of G.gems) {
    gem.bob += 0.12;
    const bobY = Math.sin(gem.bob) * 2;
    ctx.save();
    ctx.translate(gem.x, gem.y + bobY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffb347';
    ctx.shadowColor = '#ff9a3c';
    ctx.shadowBlur = 10;
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function drawPickups(G, ctx) {
  for (const pk of G.pickups) {
    pk.bob += 0.08;
    const y = pk.y + Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, y);
    if (pk.kind === 'heart') {
      ctx.fillStyle = '#ff5a7a';
      ctx.shadowColor = '#ff5a7a';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-12, -2, -7, -11, 0, -5);
      ctx.bezierCurveTo(7, -11, 12, -2, 0, 8);
      ctx.fill();
    } else {
      // Star bomb: a five-point star.
      ctx.fillStyle = '#ffe9a8';
      ctx.shadowColor = '#ffe9a8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 13 : 6;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function drawEnemies(G, ctx) {
  for (const e of G.enemies) {
    const scale = e.spawnT < 1 ? 0.4 + 0.6 * e.spawnT : 1;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = e.spawnT < 1 ? e.spawnT : 1;
    // Body: a dark blob with a glowing rim.
    ctx.fillStyle = '#1a1426';
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    const wob = Math.sin(e.wobble * 2) * 2;
    ctx.arc(0, 0, e.r + wob * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Eyes look toward the player, so the creature reads as hunting.
    const ex = Math.cos(e.angle);
    const ey = Math.sin(e.angle);
    const perpX = -ey;
    const perpY = ex;
    const eyeOff = e.r * 0.38;
    const eyeR = Math.max(2.5, e.r * 0.16);
    ctx.fillStyle = e.eye;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(ex * e.r * 0.3 + perpX * eyeOff * s, ey * e.r * 0.3 + perpY * eyeOff * s, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.flash > 0) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Boss health bar above the boss.
    if (e.isBoss) {
      const w = 220;
      const x = clamp(e.x - w / 2, 20, G.width - w - 20);
      const y = e.y - e.r - 26;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - 2, y - 2, w + 4, 12);
      ctx.fillStyle = '#3a0d1e';
      ctx.fillRect(x, y, w, 8);
      ctx.fillStyle = e.color;
      ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.name, e.x, y - 6);
    }
  }
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (!p || G.state === 'title') return;
  const blink = p.iframes > 0 && Math.floor(G.time * 14) % 2 === 0;
  if (blink) return; // I-frame flicker.
  ctx.save();
  ctx.translate(p.x, p.y);
  // Lantern glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.fill();
  // Dash cooldown ring under the player.
  if (p.dashCd > 0) {
    ctx.strokeStyle = 'rgba(255, 210, 122, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCd / p.dashCdMax));
    ctx.stroke();
  }
  // Cloak: a hooded keeper, drawn as a circle with a warm core and a
  // lantern held toward the aim direction.
  ctx.rotate(p.angle);
  const bob = p.moving ? Math.sin(p.walkPhase) * 1.5 : 0;
  ctx.fillStyle = '#2c2118';
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, bob, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // The lantern flame.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(p.r + 4, bob, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9a3c';
  ctx.beginPath();
  ctx.arc(p.r + 4, bob, 3, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(4, -5 + bob, 2.4, 0, Math.PI * 2);
  ctx.arc(4, 5 + bob, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullets(G, ctx) {
  for (const b of G.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#ffd27a';
    ctx.shadowColor = '#ff9a3c';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  for (const b of G.ebullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#b6ff9a';
    ctx.shadowColor = '#7dff5a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function drawVignette(G, ctx) {
  const p = G.player;
  if (p && p.hp === 1 && G.state === 'playing') {
    const pulse = 0.16 + 0.08 * Math.sin(G.time * 5);
    const grad = ctx.createRadialGradient(
      G.width / 2, G.height / 2, G.height * 0.35,
      G.width / 2, G.height / 2, G.height * 0.75,
    );
    grad.addColorStop(0, 'rgba(255, 40, 40, 0)');
    grad.addColorStop(1, 'rgba(255, 40, 40, ' + pulse + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, G.width, G.height);
  }
}

// ---- HUD -----------------------------------------------------------------

export function drawHUD(G, ctx) {
  const p = G.player;
  if (!p) return;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: score, best, wave.
  ctx.fillStyle = 'rgba(8, 6, 20, 0.6)';
  ctx.fillRect(18, 14, 250, 74);
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 14, 250, 74);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('SCORE ' + G.score.toLocaleString('en-US'), 30, 44);
  ctx.fillStyle = '#b9b3e6';
  ctx.font = '15px Georgia, serif';
  ctx.fillText('BEST ' + Math.max(G.best, G.score).toLocaleString('en-US'), 30, 66);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('WAVE ' + Math.max(1, G.wave) + ' / 10', 30, 84);

  // Top-center: XP bar and level.
  const barW = 420;
  const barX = (G.width - barW) / 2;
  ctx.fillStyle = 'rgba(8, 6, 20, 0.6)';
  ctx.fillRect(barX - 6, 16, barW + 12, 30);
  ctx.fillStyle = '#241d4d';
  ctx.fillRect(barX, 22, barW, 12);
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(barX, 22, barW * clamp(p.xp / p.xpNext, 0, 1), 12);
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.4)';
  ctx.strokeRect(barX, 22, barW, 12);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL ' + p.level + '   ·   ' + p.xp + ' / ' + p.xpNext + ' EMBERS', G.width / 2, 58);

  // Top-right: hearts, bombs, dash.
  ctx.textAlign = 'right';
  let hx = G.width - 28;
  for (let i = 0; i < p.maxHp; i++) {
    const filled = i < p.hp;
    ctx.fillStyle = filled ? '#ff5a7a' : 'rgba(255, 90, 122, 0.25)';
    ctx.beginPath();
    const cx = hx - i * 34;
    ctx.moveTo(cx, 40);
    ctx.bezierCurveTo(cx - 11, 31, cx - 16, 24, cx - 8, 20);
    ctx.bezierCurveTo(cx - 3, 17, cx, 20, cx, 23);
    ctx.bezierCurveTo(cx, 20, cx + 3, 17, cx + 8, 20);
    ctx.bezierCurveTo(cx + 16, 24, cx + 11, 31, cx, 40);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('★ ' + p.bombs + '  (Q)', G.width - 28, 66);
  ctx.fillStyle = p.dashCd <= 0 ? '#7dff9a' : '#8d86b8';
  ctx.font = '15px Georgia, serif';
  ctx.fillText(p.dashCd <= 0 ? 'DASH READY (Space)' : 'DASH ' + p.dashCd.toFixed(1) + 's', G.width - 28, 86);

  // Combo, under the score box.
  if (G.combo >= 4) {
    const mult = Math.min(5, 1 + Math.floor(G.combo / 8));
    ctx.textAlign = 'left';
    ctx.fillStyle = mult >= 3 ? '#ffd27a' : '#e8e2ff';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('COMBO x' + mult + '  (' + G.combo + ' kills)', 30, 116);
  }

  // Wave banner.
  if (G.bannerTimer > 0 && G.banner) {
    const a = clamp(G.bannerTimer / 0.5, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.shadowColor = '#ff9a3c';
    ctx.shadowBlur = 24;
    ctx.fillText(G.banner, G.width / 2, 170);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Boss warning bar at the very top when a boss lives.
  const boss = G.enemies.find((e) => e.isBoss && !e.dead);
  if (boss) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8fa3';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('⚠ ' + boss.name.toUpperCase() + ' ⚠', G.width / 2, 100);
  }

  // Bottom hint line.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(185, 179, 230, 0.75)';
  ctx.font = '14px Georgia, serif';
  ctx.fillText('WASD move · Mouse aim · Hold click to fire · Space dash · Q star bomb · P pause · M mute', G.width / 2, G.height - 14);
}
