// player.js — the Lantern-Keeper: movement, aiming, firing, dashing,
// taking hits, and experience. The player is one object on the game state;
// this file owns everything that object does.
import { clamp, dist2 } from './util.js';
import { spawnBurst, spawnRing, spawnText } from './particles.js';
import { AudioSys } from './audio.js';

export function createPlayer(G) {
  return {
    x: G.width / 2,
    y: G.height / 2,
    r: 16,
    angle: -Math.PI / 2,
    speed: 245,
    hp: 3,
    maxHp: 3,
    fireTimer: 0,
    fireRate: 4.6,
    damage: 10,
    bulletSpeed: 580,
    multishot: 1,
    pierce: 0,
    magnet: 150,
    nova: 0,
    novaRadius: 0,
    dashTimer: 0,
    dashCd: 0,
    dashCdMax: 2.4,
    dashDirX: 0,
    dashDirY: -1,
    iframes: 0,
    level: 1,
    xp: 0,
    xpNext: 6,
    bombs: 1,
    moving: false,
    walkPhase: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (!p) return;

  if (p.iframes > 0) p.iframes -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;

  // Aim at the mouse, always, even while standing still.
  p.angle = Math.atan2(G.input.mouse.y - p.y, G.input.mouse.x - p.x);

  const mx = G.input.moveX();
  const my = G.input.moveY();
  const mag = Math.hypot(mx, my) || 1;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    p.walkPhase += dt * 11;
    p.dashDirX = mx / mag;
    p.dashDirY = my / mag;
  }

  // Dash: a short burst of speed in the movement direction (or facing) with
  // invulnerability, on Space or Shift. It is the skill move: use it to
  // escape a surround or to cross a spitter's line of fire.
  if ((G.input.wasPressed('Space') || G.input.wasPressed('ShiftLeft') || G.input.wasPressed('ShiftRight')) && p.dashCd <= 0) {
    p.dashTimer = 0.16;
    p.dashCd = p.dashCdMax;
    p.iframes = Math.max(p.iframes, 0.3);
    AudioSys.sfx('dash');
    spawnBurst(G, p.x, p.y, '#ffd27a', 10, 160, 0.4);
  }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.x += p.dashDirX * 780 * dt;
    p.y += p.dashDirY * 780 * dt;
  } else if (p.moving) {
    p.x += (mx / mag) * p.speed * dt;
    p.y += (my / mag) * p.speed * dt;
  }

  p.x = clamp(p.x, 28, G.width - 28);
  p.y = clamp(p.y, 28, G.height - 28);

  // Star bomb: Q clears the screen. Limited, precious, loud.
  if (G.input.wasPressed('KeyQ') && p.bombs > 0) {
    p.bombs -= 1;
    AudioSys.sfx('bomb');
    spawnRing(G, p.x, p.y, '#ffe9a8', Math.max(G.width, G.height));
    G.shake = Math.max(G.shake, 14);
    for (const e of G.enemies) {
      damageEnemyExternal(G, e, 220, p.x, p.y);
    }
    spawnText(G, p.x, p.y - 34, 'STARFALL!', '#ffe9a8', 26);
  }

  // Fire while the mouse is held (or with auto-fire on, always). The lantern
  // never needs reloading; the fire rate is the only limit.
  p.fireTimer -= dt;
  const wantFire = G.input.mouse.down || G.autoFire;
  if (wantFire && p.fireTimer <= 0) {
    p.fireTimer = 1 / p.fireRate;
    fireBullets(G);
    G.stats.shotsFired += p.multishot;
  }

  // Pull in nearby embers and pickups. Embers drift toward the lantern
  // from a generous radius so kills far away still feed the level-up loop;
  // inside the magnet radius the pull is strong.
  const magnet2 = p.magnet * p.magnet;
  const drift2 = 330 * 330;
  for (const gem of G.gems) {
    const d2 = dist2(gem.x, gem.y, p.x, p.y);
    const d = Math.sqrt(d2) || 1;
    if (d2 < drift2) {
      const pull = d2 < magnet2 ? 520 * (1 - d / p.magnet) + 200 : 90;
      gem.x += ((p.x - gem.x) / d) * pull * dt;
      gem.y += ((p.y - gem.y) / d) * pull * dt;
    }
    if (d2 < (p.r + 12) * (p.r + 12)) {
      gem.dead = true;
      addXp(G, gem.value);
      AudioSys.sfx('gem');
      spawnBurst(G, gem.x, gem.y, '#ffb347', 4, 90, 0.3);
    }
  }
  for (const pk of G.pickups) {
    // Pickups drift toward the lantern too, so a low-health player can
    // collect a heart without walking into the pack that dropped it.
    const pd2 = dist2(pk.x, pk.y, p.x, p.y);
    if (pd2 < magnet2) {
      const pd = Math.sqrt(pd2) || 1;
      pk.x += ((p.x - pk.x) / pd) * 130 * dt;
      pk.y += ((p.y - pk.y) / pd) * 130 * dt;
    }
    if (dist2(pk.x, pk.y, p.x, p.y) < (p.r + 16) * (p.r + 16)) {
      pk.dead = true;
      applyPickup(G, pk);
    }
  }
}

function fireBullets(G) {
  const p = G.player;
  const n = p.multishot;
  const spread = 0.14;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * spread;
    const a = p.angle + off;
    G.bullets.push({
      x: p.x + Math.cos(a) * (p.r + 8),
      y: p.y + Math.sin(a) * (p.r + 8),
      vx: Math.cos(a) * p.bulletSpeed,
      vy: Math.sin(a) * p.bulletSpeed,
      r: 5,
      damage: p.damage,
      pierce: p.pierce,
      hitIds: new Set(),
      life: 1.1,
    });
  }
  AudioSys.sfx('shoot');
  // A little kick so the shot feels like it leaves the lantern.
  p.x -= Math.cos(p.angle) * 1.5;
  p.y -= Math.sin(p.angle) * 1.5;
}

export function addXp(G, n) {
  const p = G.player;
  p.xp += n;
  G.stats.xpGained += n;
  if (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = Math.floor(6 + p.level * 4.5);
    G.pendingLevels += 1;
  }
}

function applyPickup(G, pk) {
  const p = G.player;
  if (pk.kind === 'heart') {
    if (p.hp < p.maxHp) {
      p.hp += 1;
      spawnText(G, p.x, p.y - 26, '+1 HEART', '#7dff9a', 18);
    } else {
      G.score += 50;
      spawnText(G, p.x, p.y - 26, '+50', '#7dff9a', 16);
    }
    AudioSys.sfx('pickup');
  } else if (pk.kind === 'bomb') {
    p.bombs += 1;
    spawnText(G, p.x, p.y - 26, '+1 STAR BOMB', '#ffe9a8', 18);
    AudioSys.sfx('pickup');
  }
  spawnBurst(G, pk.x, pk.y, pk.kind === 'heart' ? '#7dff9a' : '#ffe9a8', 10, 120, 0.4);
}

// Called from projectiles.js and the bomb; kept here so enemy damage from
// the player always flows through one function.
export function damageEnemyExternal(G, e, dmg, fromX, fromY) {
  // Imported lazily through the shared module to avoid a circular import:
  // enemies.js owns the real implementation.
  G.damageEnemy(e, dmg, fromX, fromY);
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (!p || p.iframes > 0 || G.state !== 'playing') return;
  p.hp -= dmg;
  p.iframes = 1.1;
  G.shake = Math.max(G.shake, 10);
  G.combo = 0;
  AudioSys.sfx('hurt');
  spawnBurst(G, p.x, p.y, '#ff5a5a', 16, 220, 0.5);
  spawnText(G, p.x, p.y - 30, '-' + dmg + ' HEART', '#ff7a7a', 20);
  if (p.hp <= 0) {
    p.hp = 0;
    G.state = 'gameover';
    G.stats.timeSurvived = G.time;
    AudioSys.sfx('gameover');
    AudioSys.stopMusic();
    spawnBurst(G, p.x, p.y, '#ffb347', 60, 320, 1.1);
    spawnRing(G, p.x, p.y, '#ffb347', 220);
  }
}
