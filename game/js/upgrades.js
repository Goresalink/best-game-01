// upgrades.js — the level-up pool. Each level-up offers 3 different
// upgrades; the player picks one (click or keys 1-3). Every upgrade has a
// short name, a one-line effect, and a max stack count, so a long run still
// faces real choices.
import { AudioSys } from './audio.js';

export const UPGRADE_POOL = [
  {
    id: 'damage', name: 'Ember Rounds', max: 5,
    desc: '+25% bolt damage',
    apply(p) { p.damage *= 1.25; },
  },
  {
    id: 'firerate', name: 'Rapid Wick', max: 5,
    desc: '+20% fire rate',
    apply(p) { p.fireRate *= 1.2; },
  },
  {
    id: 'multishot', name: 'Twin Flame', max: 3,
    desc: '+1 bolt per shot',
    apply(p) { p.multishot += 1; },
  },
  {
    id: 'pierce', name: 'Piercing Light', max: 3,
    desc: 'Bolts pierce +1 enemy',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'speed', name: 'Swift Boots', max: 4,
    desc: '+12% move speed',
    apply(p) { p.speed *= 1.12; },
  },
  {
    id: 'magnet', name: 'Magnet Core', max: 4,
    desc: '+50% ember pickup radius',
    apply(p) { p.magnet *= 1.5; },
  },
  {
    id: 'heart', name: 'Heartwood', max: 3,
    desc: '+1 max heart, heal 1',
    apply(p) { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); },
  },
  {
    id: 'dash', name: 'Quick Dash', max: 3,
    desc: '-25% dash cooldown',
    apply(p) { p.dashCdMax *= 0.75; },
  },
  {
    id: 'nova', name: 'Nova Burst', max: 3,
    desc: 'Kills explode, damaging nearby foes',
    apply(p) { p.nova += 1; p.novaRadius = 70 + p.nova * 30; },
  },
  {
    id: 'bomb', name: 'Star Cache', max: 3,
    desc: '+1 star bomb (press Q)',
    apply(p) { p.bombs += 1; },
  },
];

// Roll 3 distinct upgrades the player has not maxed out yet.
export function rollChoices(G) {
  const taken = G.upgradeCounts;
  const avail = UPGRADE_POOL.filter((u) => (taken[u.id] || 0) < u.max);
  const choices = [];
  while (choices.length < 3 && avail.length > 0) {
    const i = Math.floor(G.rng() * avail.length);
    choices.push(avail.splice(i, 1)[0]);
  }
  // If everything is maxed (a very long run), fall back to healing/score.
  while (choices.length < 3) {
    choices.push({
      id: 'feast', name: 'Ember Feast', max: 99,
      desc: 'Heal 1 heart, +250 score',
      apply(p) { p.hp = Math.min(p.maxHp, p.hp + 1); },
    });
  }
  return choices;
}

export function applyUpgrade(G, choice) {
  const p = G.player;
  choice.apply(p);
  if (choice.id === 'feast') G.score += 250;
  G.upgradeCounts[choice.id] = (G.upgradeCounts[choice.id] || 0) + 1;
  AudioSys.sfx('levelup');
}
