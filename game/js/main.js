// main.js — Emberfall: Last Lantern. Bootstrap, the game loop, and the
// state machine. All the game state lives in one object G so every module
// reads and writes the same truth.
import { mulberry32, clamp } from './util.js';
import { loadBest, saveBest } from './storage.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { createPlayer, updatePlayer, hurtPlayer } from './player.js';
import { updateEnemies, damageEnemy, spawnEnemy } from './enemies.js';
import { updateProjectiles } from './projectiles.js';
import { updateParticles } from './particles.js';
import { rollChoices, applyUpgrade } from './upgrades.js';
import { startWave, updateWaves, TOTAL_WAVES } from './waves.js';
import { drawWorld, drawHUD } from './render.js';
import { drawTitle, drawLevelUp, drawPaused, drawGameOver, drawVictory } from './ui.js';
import { setupShot } from './shot.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  width: 1280,
  height: 720,
  state: 'title', // title | playing | levelup | paused | gameover | victory
  time: 0,
  rng: mulberry32((Math.random() * 0xffffffff) >>> 0),
  input: Input,
  player: null,
  enemies: [],
  bullets: [],
  ebullets: [],
  gems: [],
  pickups: [],
  particles: [],
  texts: [],
  rings: [],
  wave: 0,
  spawnQueue: [],
  spawnTimer: 0,
  spawnInterval: 1,
  betweenWaves: 0,
  banner: '',
  bannerTimer: 0,
  score: 0,
  best: loadBest(),
  newBest: false,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  bestCombo: 0,
  bossDown: null,
  pendingLevels: 0,
  levelupChoices: [],
  levelupRects: [],
  upgradeCounts: {},
  shake: 0,
  autoFire: false,
  shotMode: false,
  stats: { shotsFired: 0, shotsHit: 0, damageDealt: 0, xpGained: 0, timeSurvived: 0, kills: 0, score: 0 },
};

// Cross-module function slots, set here so player.js / projectiles.js can
// call into enemies.js without a circular import.
G.damageEnemy = (e, dmg, fx, fy) => damageEnemy(G, e, dmg, fx, fy);
G.hurtPlayer = (dmg) => hurtPlayer(G, dmg);

Input.attach(canvas);

// Exposed for play-testing and debugging (the finalist review can inspect
// the live state the same way); it changes nothing about the game.
window.__emberfall = G;

function resetRun() {
  G.rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
  G.player = createPlayer(G);
  G.enemies = [];
  G.bullets = [];
  G.ebullets = [];
  G.gems = [];
  G.pickups = [];
  G.particles = [];
  G.texts = [];
  G.rings = [];
  G.wave = 0;
  G.spawnQueue = [];
  G.betweenWaves = 0;
  G.banner = '';
  G.bannerTimer = 0;
  G.score = 0;
  G.newBest = false;
  G.kills = 0;
  G.combo = 0;
  G.comboTimer = 0;
  G.bestCombo = 0;
  G.bossDown = null;
  G.pendingLevels = 0;
  G.levelupChoices = [];
  G.upgradeCounts = {};
  G.shake = 0;
  G.time = 0;
  G.stats = { shotsFired: 0, shotsHit: 0, damageDealt: 0, xpGained: 0, timeSurvived: 0, kills: 0, score: 0 };
  G.state = 'playing';
  startWave(G, 1);
}

function openLevelUp() {
  G.levelupChoices = rollChoices(G);
  G.state = 'levelup';
  AudioSys.sfx('levelup');
}

function closeLevelUp(choice) {
  applyUpgrade(G, choice);
  G.pendingLevels -= 1;
  if (G.pendingLevels > 0) {
    openLevelUp();
  } else {
    G.state = 'playing';
  }
}

function finishRun() {
  G.stats.score = G.score;
  G.newBest = saveBest(G.score);
  G.best = loadBest();
}

function update(dt) {
  G.time += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);

  // Global keys, working on every screen.
  if (Input.wasPressed('KeyM')) {
    const muted = AudioSys.toggleMute();
    spawnText(G, G.width / 2, 40, muted ? 'MUTED' : 'SOUND ON', '#b9b3e6', 15);
  }

  if (G.state === 'title') {
    updateParticles(G, dt);
    // The title arena simmers: creatures drift so the backdrop is alive.
    for (const e of G.enemies) {
      e.wobble += dt * 2;
      e.x += Math.cos(e.wobble) * 12 * dt;
      e.y += Math.sin(e.wobble * 0.8) * 12 * dt;
    }
    if (Input.wasPressed('Enter') || Input.wasMousePressed()) {
      AudioSys.init();
      AudioSys.sfx('click');
      resetRun();
    }
    return;
  }

  if (G.state === 'gameover' || G.state === 'victory') {
    updateParticles(G, dt);
    if (Input.wasPressed('KeyR') || Input.wasMousePressed()) {
      AudioSys.sfx('click');
      resetRun();
    }
    return;
  }

  if (G.state === 'paused') {
    if (Input.wasPressed('KeyP') || Input.wasPressed('Escape')) {
      G.state = 'playing';
      AudioSys.sfx('click');
    } else if (Input.wasPressed('KeyR')) {
      resetRun();
    }
    return;
  }

  if (G.state === 'levelup') {
    if (Input.wasPressed('Digit1')) closeLevelUp(G.levelupChoices[0]);
    else if (Input.wasPressed('Digit2') && G.levelupChoices[1]) closeLevelUp(G.levelupChoices[1]);
    else if (Input.wasPressed('Digit3') && G.levelupChoices[2]) closeLevelUp(G.levelupChoices[2]);
    else if (Input.wasMousePressed()) {
      for (const r of G.levelupRects) {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) {
          closeLevelUp(G.levelupChoices[r.index]);
          break;
        }
      }
    }
    return;
  }

  // Playing.
  if (Input.wasPressed('KeyP') || Input.wasPressed('Escape')) {
    G.state = 'paused';
    AudioSys.sfx('click');
    return;
  }
  if (Input.wasPressed('KeyR')) {
    resetRun();
    return;
  }
  if (Input.wasPressed('KeyF')) {
    G.autoFire = !G.autoFire;
    spawnText(G, G.player.x, G.player.y - 30, G.autoFire ? 'AUTO-FIRE ON' : 'AUTO-FIRE OFF', '#b9b3e6', 15);
  }

  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) G.combo = 0;
  }

  updatePlayer(G, dt);
  updateEnemies(G, dt);
  updateProjectiles(G, dt);
  updateParticles(G, dt);

  // Clean up collected / spent objects.
  G.gems = G.gems.filter((g) => !g.dead);
  G.pickups = G.pickups.filter((p) => !p.dead);
  G.enemies = G.enemies.filter((e) => !e.dead);

  if (G.state !== 'playing') {
    // The player died (or won) during this frame's updates.
    finishRun();
    return;
  }

  updateWaves(G, dt);
  if (G.state === 'victory') {
    finishRun();
    return;
  }

  if (G.pendingLevels > 0) {
    openLevelUp();
  }
}

function draw() {
  ctx.save();
  if (G.shake > 0) {
    const s = G.shake;
    ctx.translate((G.rng() - 0.5) * s, (G.rng() - 0.5) * s);
  }
  ctx.clearRect(-20, -20, G.width + 40, G.height + 40);
  drawWorld(G, ctx);
  if (G.state === 'playing' || G.state === 'paused' || G.state === 'levelup') {
    drawHUD(G, ctx);
  }
  if (G.state === 'title') drawTitle(G, ctx);
  else if (G.state === 'levelup') drawLevelUp(G, ctx);
  else if (G.state === 'paused') drawPaused(G, ctx);
  else if (G.state === 'gameover') drawGameOver(G, ctx);
  else if (G.state === 'victory') drawVictory(G, ctx);
  ctx.restore();
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 1 / 30);
  last = now;
  if (!G.shotMode) {
    update(dt);
  }
  draw();
  Input.endFrame();
  requestAnimationFrame(frame);
}

// Screenshot mode: ?shot=title|play|upgrade|victory&seed=N renders one
// fixed scene and freezes the simulation, so the screenshot is exact.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot framing: hide the page hint and scrollbar so the frame is
  // exactly the 1280x720 game canvas.
  const hint = document.getElementById('hint');
  if (hint) hint.style.display = 'none';
  document.getElementById('wrap').style.padding = '0';
  document.getElementById('wrap').style.gap = '0';
  document.body.style.overflow = 'hidden';
  const seed = Number(params.get('seed') || '1') || 1;
  setupShot(G, shot, seed);
  draw();
} else {
  // A few creatures wander behind the title screen.
  const titleTypes = ['mite', 'wisp', 'spitter', 'brute'];
  for (let i = 0; i < 6; i++) {
    const e = spawnEnemy(G, titleTypes[i % titleTypes.length],
      140 + G.rng() * (G.width - 280), 140 + G.rng() * (G.height - 280), false);
    e.spawnT = 1;
  }
  requestAnimationFrame(frame);
}

export { G, TOTAL_WAVES };
