// projectiles.js — player ember bolts and enemy orbs: movement, wall
// removal, and every collision with an enemy or the player.
import { dist2 } from './util.js';
import { spawnBurst } from './particles.js';
import { AudioSys } from './audio.js';
import { hurtPlayer } from './player.js';

export function updateProjectiles(G, dt) {
  // Player bolts.
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > G.width + 20 || b.y < -20 || b.y > G.height + 20;
    if (!dead) {
      for (const e of G.enemies) {
        if (e.dead || b.hitIds.has(e.id)) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.hitIds.add(e.id);
          G.damageEnemy(e, b.damage, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
          G.stats.shotsHit += 1;
          spawnBurst(G, b.x, b.y, '#ffb347', 4, 110, 0.25);
          AudioSys.sfx('hit');
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }

  // Enemy orbs.
  const p = G.player;
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > G.width + 20 || b.y < -20 || b.y > G.height + 20;
    if (!dead && p && p.iframes <= 0) {
      const rr = p.r + b.r - 3;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        hurtPlayer(G, b.damage);
        dead = true;
      }
    }
    if (dead) G.ebullets.splice(i, 1);
  }
}
