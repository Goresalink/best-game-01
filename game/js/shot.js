// shot.js — deterministic scenes for the screenshots (?shot=<scene>&seed=<n>).
// Each scene builds one fixed moment of the game with the seeded RNG, draws
// one frame, and sets window.__shotReady so the screenshot tool knows the
// frame is complete. Real play never uses these paths.
import { createPlayer } from './player.js';
import { spawnEnemy } from './enemies.js';
import { rollChoices } from './upgrades.js';
import { mulberry32 } from './util.js';
import { spawnBurst, spawnRing } from './particles.js';

export function setupShot(G, scene, seed) {
  G.rng = mulberry32(seed || 1);
  G.player = createPlayer(G);
  G.enemies = [];
  G.bullets = [];
  G.ebullets = [];
  G.gems = [];
  G.pickups = [];
  G.particles = [];
  G.texts = [];
  G.rings = [];
  G.autoFire = false;

  if (scene === 'title') {
    G.state = 'title';
    G.best = 8420;
    G.score = 0;
    // A few creatures wander the dim arena behind the title panel.
    for (let i = 0; i < 7; i++) {
      const e = spawnEnemy(G, ['mite', 'wisp', 'spitter', 'brute'][i % 4],
        120 + G.rng() * (G.width - 240), 120 + G.rng() * (G.height - 240), false);
      e.spawnT = 1;
    }
    G.player.x = G.width / 2;
    G.player.y = 480;
  } else if (scene === 'play') {
    G.state = 'playing';
    G.wave = 4;
    G.score = 3280;
    G.best = 8420;
    G.kills = 87;
    G.combo = 14;
    G.comboTimer = 2.0;
    G.player.level = 5;
    G.player.xp = 9;
    G.player.xpNext = 28;
    G.player.hp = 2;
    G.player.multishot = 2;
    G.player.pierce = 1;
    G.player.bombs = 2;
    G.player.x = G.width / 2;
    G.player.y = G.height / 2 + 40;
    G.player.angle = -0.5;
    const spots = [
      ['mite', 300, 200], ['mite', 420, 160], ['wisp', 900, 180], ['wisp', 980, 300],
      ['spitter', 1050, 480], ['spitter', 220, 520], ['brute', 700, 130], ['brute', 560, 560],
      ['mite', 820, 520], ['wisp', 180, 260], ['mite', 1080, 220], ['spitter', 640, 620],
    ];
    for (const [type, x, y] of spots) {
      const e = spawnEnemy(G, type, x, y, false);
      e.spawnT = 1;
    }
    // Ember bolts mid-flight and fresh kill sparks.
    for (let i = 0; i < 10; i++) {
      const a = -0.5 + (G.rng() - 0.5) * 0.7;
      G.bullets.push({
        x: G.player.x + 40 + i * 38, y: G.player.y - 60 + (G.rng() - 0.5) * 170,
        vx: Math.cos(a) * 580, vy: Math.sin(a) * 580,
        r: 5, damage: 12, pierce: 1, hitIds: new Set(), life: 1,
      });
    }
    // Spitter orbs arcing back toward the player.
    for (const [ox, oy, tx, ty] of [[1050, 480, 640, 400], [220, 520, 640, 400], [900, 180, 640, 400]]) {
      const a = Math.atan2(ty - oy, tx - ox);
      G.ebullets.push({ x: ox, y: oy, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 7, damage: 1, life: 4 });
    }
    for (let i = 0; i < 8; i++) {
      G.gems.push({ x: 350 + G.rng() * 500, y: 300 + G.rng() * 200, value: 1, dead: false, bob: G.rng() * 6 });
    }
    G.pickups.push({ x: 950, y: 560, kind: 'heart', dead: false, bob: 0 });
    spawnBurst(G, 700, 240, '#ff7a3c', 14, 200, 0.6);
    spawnBurst(G, 880, 420, '#7ad9ff', 10, 180, 0.5);
    spawnRing(G, 700, 240, '#ff7a3c', 70);
    G.banner = 'WAVE 4';
    G.bannerTimer = 1.4;
    G.time = 143;
    G.stats.shotsFired = 240;
    G.stats.shotsHit = 171;
  } else if (scene === 'upgrade') {
    G.state = 'levelup';
    G.wave = 3;
    G.score = 2140;
    G.best = 8420;
    G.kills = 52;
    G.combo = 6;
    G.player.level = 4;
    G.player.xp = 0;
    G.player.xpNext = 24;
    G.player.x = G.width / 2;
    G.player.y = G.height / 2 + 60;
    for (const [type, x, y] of [['mite', 260, 180], ['wisp', 1020, 200], ['spitter', 900, 520], ['brute', 380, 540]]) {
      const e = spawnEnemy(G, type, x, y, false);
      e.spawnT = 1;
    }
    for (let i = 0; i < 5; i++) {
      G.gems.push({ x: 420 + G.rng() * 420, y: 330 + G.rng() * 160, value: 1, dead: false, bob: G.rng() * 6 });
    }
    G.levelupChoices = rollChoices(G);
    G.time = 98;
  } else if (scene === 'boss') {
    // The cover: the final fight. The Gloam King at the top with its spiral
    // of orbs, minions closing in, the keeper below with a full spread of
    // bolts, the boss bar and the wave banner all on screen.
    G.state = 'playing';
    G.wave = 10;
    G.score = 15200;
    G.best = 8420;
    G.kills = 310;
    G.combo = 22;
    G.comboTimer = 2.0;
    G.bestCombo = 31;
    G.player.level = 11;
    G.player.xp = 12;
    G.player.xpNext = 50;
    G.player.hp = 2;
    G.player.multishot = 3;
    G.player.pierce = 2;
    G.player.bombs = 1;
    G.player.x = G.width / 2;
    G.player.y = 560;
    G.player.angle = -Math.PI / 2;
    const king = spawnEnemy(G, 'king', G.width / 2, 305, true);
    king.spawnT = 1;
    king.hp = Math.round(king.maxHp * 0.55);
    for (const [type, x, y] of [['mite', 300, 320], ['mite', 980, 320], ['wisp', 220, 470], ['wisp', 1060, 470], ['spitter', 380, 230], ['spitter', 900, 230], ['brute', 790, 440]]) {
      const e = spawnEnemy(G, type, x, y, false);
      e.spawnT = 1;
    }
    // The King's spiral: two arms of orbs winding outward.
    for (let i = 0; i < 14; i++) {
      const a = i * 0.55;
      const r = 70 + i * 16;
      const ox = king.x + Math.cos(a) * r;
      const oy = king.y + Math.sin(a) * r;
      G.ebullets.push({ x: ox, y: oy, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 7, damage: 1, life: 5 });
      const a2 = a + Math.PI;
      const ox2 = king.x + Math.cos(a2) * r;
      const oy2 = king.y + Math.sin(a2) * r;
      G.ebullets.push({ x: ox2, y: oy2, vx: Math.cos(a2) * 170, vy: Math.sin(a2) * 170, r: 7, damage: 1, life: 5 });
    }
    // The keeper's triple-shot fan, mid-flight toward the King.
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (G.rng() - 0.5) * 0.45;
      G.bullets.push({
        x: G.player.x + (G.rng() - 0.5) * 60, y: G.player.y - 30 - i * 32,
        vx: Math.cos(a) * 580, vy: Math.sin(a) * 580,
        r: 5, damage: 30, pierce: 2, hitIds: new Set(), life: 1,
      });
    }
    for (let i = 0; i < 10; i++) {
      G.gems.push({ x: 300 + G.rng() * 680, y: 380 + G.rng() * 180, value: 1, dead: false, bob: G.rng() * 6 });
    }
    G.pickups.push({ x: 950, y: 620, kind: 'heart', dead: false, bob: 0 });
    spawnBurst(G, 640, 330, '#c07aff', 16, 220, 0.6);
    spawnRing(G, king.x, king.y, '#ff4d6d', 150);
    G.banner = 'WAVE 10 — THE GLOAM KING';
    G.bannerTimer = 1.6;
    G.time = 480;
    G.stats.shotsFired = 1320;
    G.stats.shotsHit = 990;
  } else if (scene === 'victory') {
    G.state = 'victory';
    G.wave = 10;
    G.score = 18450;
    G.best = 8420;
    G.newBest = true;
    G.kills = 342;
    G.bestCombo = 31;
    G.player.level = 12;
    G.player.hp = 2;
    G.stats.timeSurvived = 512;
    G.stats.shotsFired = 1480;
    G.stats.shotsHit = 1124;
    G.player.x = G.width / 2;
    G.player.y = G.height / 2 + 40;
    spawnBurst(G, G.width / 2 - 200, 300, '#ffd27a', 20, 200, 1);
    spawnBurst(G, G.width / 2 + 200, 300, '#ff9a3c', 20, 200, 1);
    G.time = 512;
  } else {
    G.state = 'title';
  }
  // One deterministic world step so particles/rings have visible shape.
  G.shotMode = true;
  window.__shotReady = true;
}
