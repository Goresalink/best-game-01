// waves.js — the wave director. Ten waves, each a spawn budget drawn from
// the kinds unlocked so far; wave 5 brings the Hollow Warden, wave 10 the
// Gloam King. Clearing a wave (every spawned enemy dead) pays a bonus and
// opens the next one; killing the King wins the game.
import { kindsForWave, spawnAtEdge, spawnEnemy } from './enemies.js';
import { spawnText } from './particles.js';
import { AudioSys } from './audio.js';

export const TOTAL_WAVES = 10;

export function startWave(G, n) {
  G.wave = n;
  const kinds = kindsForWave(n);
  let budget = 6 + n * 4;
  const queue = [];
  while (budget > 0) {
    // Later waves weight the tougher kinds more heavily.
    const weights = kinds.map((k) => {
      if (k === 'mite') return 5;
      if (k === 'wisp') return 3 + n * 0.3;
      if (k === 'spitter') return 2 + n * 0.4;
      return 1.5 + n * 0.5; // brute
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = G.rng() * total;
    let kind = kinds[0];
    for (let i = 0; i < kinds.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        kind = kinds[i];
        break;
      }
    }
    queue.push(kind);
    budget -= kind === 'brute' ? 3 : kind === 'spitter' ? 2 : 1;
  }
  // Shuffle so the wave does not arrive in sorted order.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(G.rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  G.spawnQueue = queue;
  G.spawnTimer = 0.5;
  G.spawnInterval = Math.max(0.35, 1.05 - n * 0.07);
  G.betweenWaves = 0;
  G.banner = 'WAVE ' + n + (n === 5 ? ' — THE HOLLOW WARDEN' : n === 10 ? ' — THE GLOAM KING' : '');
  G.bannerTimer = 2.2;
  if (n === 5) {
    spawnEnemy(G, 'warden', G.width / 2, -50, true);
    AudioSys.sfx('boss');
  }
  if (n === 10) {
    spawnEnemy(G, 'king', G.width / 2, -50, true);
    AudioSys.sfx('boss');
  }
  if (n === 1) AudioSys.startMusic();
}

export function updateWaves(G, dt) {
  if (G.bannerTimer > 0) G.bannerTimer -= dt;

  if (G.spawnQueue.length > 0) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      G.spawnTimer = G.spawnInterval;
      // Spawn in small bursts so the pressure ramps inside a wave.
      const burst = G.wave >= 6 ? 2 : 1;
      for (let i = 0; i < burst && G.spawnQueue.length > 0; i++) {
        spawnAtEdge(G, G.spawnQueue.shift());
      }
    }
    return;
  }

  // Wave clear: no queue left and no living enemies.
  if (G.enemies.length === 0 && G.state === 'playing') {
    if (G.wave >= TOTAL_WAVES) {
      // The King is dead and nothing is left: the run is won.
      winGame(G);
      return;
    }
    if (G.betweenWaves === 0) {
      const bonus = 100 * G.wave;
      G.score += bonus;
      spawnText(G, G.width / 2, G.height / 2 - 40, 'WAVE ' + G.wave + ' CLEAR  +' + bonus, '#7dff9a', 26);
      AudioSys.sfx('waveclear');
      G.betweenWaves = 2.6;
    }
    G.betweenWaves -= dt;
    if (G.betweenWaves <= 0) {
      startWave(G, G.wave + 1);
    }
  }
}

export function winGame(G) {
  G.state = 'victory';
  G.stats.timeSurvived = G.time;
  G.stats.score = G.score;
  AudioSys.sfx('victory');
  AudioSys.stopMusic();
}
