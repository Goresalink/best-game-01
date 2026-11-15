// enemies.js — the Gloam: five creature kinds and two bosses, their stats,
// movement AI and what they drop. Each kind is one entry in ENEMY_TYPES so
// the wave director and the renderer both read the same truth.
import { clamp, dist2, angleTo, edgePoint, pick } from './util.js';
import { spawnBurst, spawnRing, spawnText } from './particles.js';
import { AudioSys } from './audio.js';

export const ENEMY_TYPES = {
  mite: {
    name: 'Ember Mite', hp: 12, speed: 98, r: 14, score: 10, xp: 1,
    color: '#ff7a3c', eye: '#ffe9a8', damage: 1,
  },
  wisp: {
    name: 'Wisp', hp: 9, speed: 158, r: 11, score: 15, xp: 1,
    color: '#7ad9ff', eye: '#e8fbff', damage: 1,
  },
  spitter: {
    name: 'Spitter', hp: 20, speed: 62, r: 15, score: 25, xp: 2,
    color: '#9dff7a', eye: '#1d3a12', damage: 1,
  },
  brute: {
    name: 'Brute', hp: 68, speed: 46, r: 26, score: 40, xp: 3,
    color: '#c07aff', eye: '#ffd7ff', damage: 1,
  },
};

export const BOSSES = {
  warden: {
    name: 'Hollow Warden', hp: 950, speed: 52, r: 40, score: 500, xp: 12,
    color: '#b388ff', eye: '#fff3c4', damage: 1,
  },
  king: {
    name: 'The Gloam King', hp: 2100, speed: 46, r: 48, score: 1500, xp: 25,
    color: '#ff4d6d', eye: '#ffe9a8', damage: 1,
  },
};

let nextId = 1;

export function spawnEnemy(G, type, x, y, isBoss) {
  const def = isBoss ? BOSSES[type] : ENEMY_TYPES[type];
  const hpScale = 1 + (G.wave - 1) * 0.22;
  const spScale = 1 + (G.wave - 1) * 0.035;
  const e = {
    id: nextId++,
    type,
    isBoss: !!isBoss,
    name: def.name,
    x,
    y,
    r: def.r,
    hp: Math.round(def.hp * (isBoss ? 1 : hpScale)),
    maxHp: Math.round(def.hp * (isBoss ? 1 : hpScale)),
    speed: def.speed * spScale * (0.9 + G.rng() * 0.2),
    score: def.score,
    xp: def.xp,
    color: def.color,
    eye: def.eye,
    damage: def.damage,
    angle: 0,
    wobble: G.rng() * Math.PI * 2,
    shootTimer: 1.5 + G.rng(),
    chargeTimer: 3 + G.rng() * 2,
    charging: 0,
    flash: 0,
    dead: false,
    spawnT: 0,
  };
  G.enemies.push(e);
  return e;
}

export function spawnAtEdge(G, type) {
  const p = edgePoint(G.rng, G.width, G.height, 30);
  return spawnEnemy(G, type, p.x, p.y, false);
}

// Which kinds may appear on this wave.
export function kindsForWave(wave) {
  const kinds = ['mite'];
  if (wave >= 2) kinds.push('wisp');
  if (wave >= 3) kinds.push('spitter');
  if (wave >= 4) kinds.push('brute');
  return kinds;
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT < 1) e.spawnT = Math.min(1, e.spawnT + dt * 3);
    e.wobble += dt * 3;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y)) || 1;
    const a = angleTo(e.x, e.y, p.x, p.y);
    e.angle = a;

    if (e.isBoss) {
      updateBoss(G, e, dt, d, a);
    } else if (e.type === 'wisp') {
      // Zig-zag: chase, but weave side to side so it is hard to lead.
      const weave = Math.sin(e.wobble * 2.2) * 0.85;
      const mx = Math.cos(a) - Math.sin(a) * weave;
      const my = Math.sin(a) + Math.cos(a) * weave;
      const m = Math.hypot(mx, my) || 1;
      e.x += (mx / m) * e.speed * dt;
      e.y += (my / m) * e.speed * dt;
    } else if (e.type === 'spitter') {
      // Keep a ring around the player and spit orbs.
      if (d > 300) {
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
      } else if (d < 210) {
        e.x -= Math.cos(a) * e.speed * 0.7 * dt;
        e.y -= Math.sin(a) * e.speed * 0.7 * dt;
      } else {
        e.x += Math.cos(a + Math.PI / 2) * e.speed * 0.5 * dt;
        e.y += Math.sin(a + Math.PI / 2) * e.speed * 0.5 * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 560) {
        e.shootTimer = 2.3;
        G.ebullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
          r: 7, damage: 1, life: 4,
        });
        spawnBurst(G, e.x, e.y, '#9dff7a', 4, 60, 0.25);
      }
    } else {
      // Mites and brutes simply chase.
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    }

    e.x = clamp(e.x, -60, G.width + 60);
    e.y = clamp(e.y, -60, G.height + 60);

    // Touching the player hurts (the player's iframes gate the rate).
    if (p && d < e.r + p.r - 2 && p.iframes <= 0) {
      G.hurtPlayer(1);
      // Knock the enemy back a little so one touch is not a chain.
      e.x -= Math.cos(a) * 26;
      e.y -= Math.sin(a) * 26;
    }
  }
}

function updateBoss(G, e, dt, d, a) {
  const p = G.player;
  if (e.type === 'warden') {
    // The Warden alternates: slow chase, then a telegraphed charge.
    e.chargeTimer -= dt;
    if (e.charging > 0) {
      e.charging -= dt;
      e.x += Math.cos(e.chargeAngle) * 460 * dt;
      e.y += Math.sin(e.chargeAngle) * 460 * dt;
      if (G.rng() < dt * 20) spawnBurst(G, e.x, e.y, '#b388ff', 2, 80, 0.3);
    } else if (e.chargeTimer <= 0) {
      e.charging = 0.55;
      e.chargeAngle = a;
      e.chargeTimer = 3.4;
      AudioSys.sfx('boss');
      spawnText(G, e.x, e.y - e.r - 12, '!', '#ff5a5a', 28);
    } else {
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = 2.6;
      for (let i = 0; i < 8; i++) {
        const sa = (i / 8) * Math.PI * 2 + e.wobble;
        G.ebullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(sa) * 150, vy: Math.sin(sa) * 150,
          r: 7, damage: 1, life: 5,
        });
      }
      spawnRing(G, e.x, e.y, '#b388ff', 90);
    }
  } else {
    // The Gloam King: slow spiral fire, and it summons mites.
    e.x += Math.cos(a) * e.speed * dt;
    e.y += Math.sin(a) * e.speed * dt;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = 0.32;
      const sa = e.wobble * 1.7;
      G.ebullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(sa) * 170, vy: Math.sin(sa) * 170,
        r: 7, damage: 1, life: 5,
      });
      G.ebullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(sa + Math.PI) * 170, vy: Math.sin(sa + Math.PI) * 170,
        r: 7, damage: 1, life: 5,
      });
    }
    e.chargeTimer -= dt;
    if (e.chargeTimer <= 0 && G.enemies.length < 14) {
      e.chargeTimer = 6;
      for (let i = 0; i < 3; i++) {
        const p2 = edgePoint(G.rng, G.width, G.height, 30);
        spawnEnemy(G, 'mite', p2.x, p2.y, false);
      }
      spawnText(G, e.x, e.y - e.r - 12, 'RISE, GLOAM!', '#ff4d6d', 20);
      AudioSys.sfx('boss');
    }
  }
}

// Damage from a player bullet, the bomb, or a nova. fromX/fromY set the
// knockback direction; pass the player's position for the bomb.
export function damageEnemy(G, e, dmg, fromX, fromY) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 0.09;
  G.stats.damageDealt += dmg;
  const a = angleTo(fromX, fromY, e.x, e.y);
  const kb = e.isBoss ? 4 : 26;
  e.x += Math.cos(a) * kb;
  e.y += Math.sin(a) * kb;
  if (e.hp <= 0) killEnemy(G, e);
}

export function killEnemy(G, e) {
  if (e.dead) return;
  e.dead = true;
  G.kills += 1;
  G.stats.kills = G.kills;
  // Combo: kills within 2.5 s of each other build a multiplier, up to x5.
  G.combo += 1;
  G.comboTimer = 2.5;
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  const mult = Math.min(5, 1 + Math.floor(G.combo / 8));
  const gained = e.score * mult;
  G.score += gained;
  spawnBurst(G, e.x, e.y, e.color, e.isBoss ? 50 : 12, e.isBoss ? 320 : 190, 0.6);
  spawnRing(G, e.x, e.y, e.color, e.isBoss ? 200 : 60);
  spawnText(G, e.x, e.y - e.r - 6, '+' + gained, '#ffd27a', e.isBoss ? 26 : 15);
  // XP embers: one gem per xp point, scattered a little.
  for (let i = 0; i < e.xp; i++) {
    G.gems.push({
      x: e.x + (G.rng() - 0.5) * 26,
      y: e.y + (G.rng() - 0.5) * 26,
      value: 1,
      dead: false,
      bob: G.rng() * Math.PI * 2,
    });
  }
  // Pickups: hearts and bombs drop rarely, more often from big kills.
  const roll = G.rng();
  if (e.isBoss || roll < 0.03) {
    G.pickups.push({ x: e.x, y: e.y, kind: e.isBoss ? 'bomb' : roll < 0.015 ? 'bomb' : 'heart', dead: false, bob: 0 });
  } else if (e.type === 'brute' && roll < 0.12) {
    G.pickups.push({ x: e.x, y: e.y, kind: 'heart', dead: false, bob: 0 });
  }
  AudioSys.sfx('die');
  G.shake = Math.max(G.shake, e.isBoss ? 16 : 3);
  // Nova Burst upgrade: death releases a damaging shockwave.
  const p = G.player;
  if (p && p.nova > 0) {
    const R = p.novaRadius;
    spawnRing(G, e.x, e.y, '#ff9a3c', R);
    for (const other of G.enemies) {
      if (!other.dead && other !== e && dist2(other.x, other.y, e.x, e.y) < R * R) {
        damageEnemy(G, other, p.nova * 8, e.x, e.y);
      }
    }
  }
  if (e.isBoss) {
    G.bossDown = e.type;
    spawnText(G, G.width / 2, 200, e.name.toUpperCase() + ' FALLEN!', '#ffe9a8', 34);
  }
}
