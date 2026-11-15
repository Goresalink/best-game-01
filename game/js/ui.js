// ui.js — the screens around the fight: title, level-up choice, pause,
// game over and victory. Each is drawn on the canvas so a screenshot shows
// exactly what a player sees, with no DOM overlay in the way.
import { formatTime } from './util.js';

function dim(ctx, w, h, alpha) {
  ctx.fillStyle = 'rgba(6, 5, 16, ' + alpha + ')';
  ctx.fillRect(0, 0, w, h);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 8, 26, 0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function title(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || '#ffe9a8';
  ctx.font = 'bold ' + size + 'px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

export function drawTitle(G, ctx) {
  dim(ctx, G.width, G.height, 0.62);
  ctx.save();
  ctx.shadowColor = '#ff9a3c';
  ctx.shadowBlur = 34;
  title(ctx, 'EMBERFALL', G.width / 2, 190, 92, '#ffb347');
  ctx.restore();
  title(ctx, '—  L A S T   L A N T E R N  —', G.width / 2, 232, 26, '#e8e2ff');
  title(ctx, 'The dark has swallowed the valley. Your lantern is the last light.', G.width / 2, 282, 19, '#b9b3e6');
  title(ctx, 'Survive 10 waves. Slay the Gloam King.', G.width / 2, 312, 19, '#b9b3e6');

  panel(ctx, G.width / 2 - 330, 348, 660, 132);
  title(ctx, 'WASD / Arrows — move          Mouse — aim', G.width / 2, 382, 18, '#e8e2ff');
  title(ctx, 'Hold Click — fire embers          Space — dash', G.width / 2, 412, 18, '#e8e2ff');
  title(ctx, 'Q — star bomb          P — pause          M — mute', G.width / 2, 442, 18, '#e8e2ff');
  title(ctx, 'Collect embers, level up, choose your power.', G.width / 2, 468, 16, '#8d86b8');

  const pulse = 0.65 + 0.35 * Math.sin(G.time * 3);
  ctx.globalAlpha = pulse;
  title(ctx, '▶  CLICK OR PRESS ENTER TO BEGIN  ◀', G.width / 2, 540, 24, '#ffe9a8');
  ctx.globalAlpha = 1;

  if (G.best > 0) {
    title(ctx, 'BEST SCORE  ' + G.best.toLocaleString('en-US'), G.width / 2, 584, 18, '#b9b3e6');
  }
  title(ctx, 'An original game — art, sound and code made for this bounty.', G.width / 2, 668, 13, '#6f689e');
}

export function drawLevelUp(G, ctx) {
  dim(ctx, G.width, G.height, 0.55);
  title(ctx, 'LEVEL ' + G.player.level + ' — CHOOSE YOUR POWER', G.width / 2, 130, 36, '#ffe9a8');
  title(ctx, 'Click a card, or press 1, 2 or 3', G.width / 2, 166, 17, '#b9b3e6');
  const cardW = 260;
  const cardH = 220;
  const gap = 30;
  const total = cardW * 3 + gap * 2;
  const startX = (G.width - total) / 2;
  const y = 220;
  G.levelupRects = [];
  G.levelupChoices.forEach((c, i) => {
    const x = startX + i * (cardW + gap);
    G.levelupRects.push({ x, y, w: cardW, h: cardH, index: i });
    const hover = G.input.mouse.x >= x && G.input.mouse.x <= x + cardW &&
      G.input.mouse.y >= y && G.input.mouse.y <= y + cardH;
    ctx.fillStyle = hover ? 'rgba(46, 32, 84, 0.97)' : 'rgba(16, 12, 40, 0.95)';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = hover ? '#ffb347' : 'rgba(255, 179, 71, 0.4)';
    ctx.lineWidth = hover ? 3 : 2;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.name, x + cardW / 2, y + 52);
    ctx.fillStyle = '#e8e2ff';
    ctx.font = '16px Georgia, serif';
    wrapText(ctx, c.desc, x + cardW / 2, y + 92, cardW - 36, 22);
    const count = G.upgradeCounts[c.id] || 0;
    ctx.fillStyle = '#8d86b8';
    ctx.font = '14px Georgia, serif';
    ctx.fillText(count > 0 ? 'Owned: ' + count + ' / ' + c.max : 'New power', x + cardW / 2, y + 168);
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('[' + (i + 1) + ']', x + cardW / 2, y + 198);
  });
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, cx, yy);
}

export function drawPaused(G, ctx) {
  dim(ctx, G.width, G.height, 0.6);
  title(ctx, 'PAUSED', G.width / 2, 300, 56, '#ffe9a8');
  title(ctx, 'P or Esc — resume          R — restart run          M — mute', G.width / 2, 350, 18, '#e8e2ff');
  title(ctx, 'Wave ' + G.wave + '  ·  Score ' + G.score.toLocaleString('en-US') + '  ·  Level ' + G.player.level, G.width / 2, 388, 17, '#b9b3e6');
}

function statsLines(G) {
  return [
    'SCORE  ' + G.score.toLocaleString('en-US'),
    'WAVE REACHED  ' + Math.max(1, G.wave) + ' / 10',
    'KILLS  ' + G.kills + '    ·    BEST COMBO  ' + G.bestCombo,
    'LEVEL  ' + G.player.level + '    ·    TIME  ' + formatTime(G.stats.timeSurvived || G.time),
    'ACCURACY  ' + accuracy(G) + '%',
  ];
}

function accuracy(G) {
  if (G.stats.shotsFired === 0) return 0;
  return Math.round((100 * G.stats.shotsHit) / G.stats.shotsFired);
}

export function drawGameOver(G, ctx) {
  dim(ctx, G.width, G.height, 0.66);
  ctx.save();
  ctx.shadowColor = '#ff4d6d';
  ctx.shadowBlur = 30;
  title(ctx, 'THE LIGHT GOES OUT', G.width / 2, 168, 54, '#ff8fa3');
  ctx.restore();
  title(ctx, 'The Gloam takes the valley… this time.', G.width / 2, 210, 19, '#b9b3e6');
  if (G.newBest) {
    title(ctx, '★ NEW BEST SCORE! ★', G.width / 2, 252, 24, '#ffd27a');
  }
  panel(ctx, G.width / 2 - 280, 286, 560, 190);
  statsLines(G).forEach((line, i) => {
    title(ctx, line, G.width / 2, 322 + i * 32, i === 0 ? 24 : 18, i === 0 ? '#ffe9a8' : '#e8e2ff');
  });
  const pulse = 0.65 + 0.35 * Math.sin(G.time * 3);
  ctx.globalAlpha = pulse;
  title(ctx, '▶  PRESS R OR CLICK TO TRY AGAIN  ◀', G.width / 2, 540, 22, '#ffe9a8');
  ctx.globalAlpha = 1;
}

export function drawVictory(G, ctx) {
  dim(ctx, G.width, G.height, 0.6);
  ctx.save();
  ctx.shadowColor = '#ffd27a';
  ctx.shadowBlur = 34;
  title(ctx, 'DAWN BREAKS', G.width / 2, 140, 64, '#ffe9a8');
  ctx.restore();
  title(ctx, 'The Gloam King is fallen. The valley wakes in warm light.', G.width / 2, 184, 19, '#e8e2ff');
  title(ctx, 'You kept the last lantern burning — all 10 waves survived.', G.width / 2, 212, 19, '#e8e2ff');
  if (G.newBest) {
    title(ctx, '★ NEW BEST SCORE! ★', G.width / 2, 244, 22, '#ffd27a');
  }
  panel(ctx, G.width / 2 - 280, 278, 560, 224);
  statsLines(G).forEach((line, i) => {
    title(ctx, line, G.width / 2, 314 + i * 32, i === 0 ? 24 : 18, i === 0 ? '#ffe9a8' : '#e8e2ff');
  });
  // Performance stars: one for the win, one for keeping 2+ hearts, one
  // for 60%+ accuracy. They are the run's grade, shown on the results.
  const stars = 1 + (G.player.hp >= 2 ? 1 : 0) + (accuracy(G) >= 60 ? 1 : 0);
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < stars ? '#ffd27a' : 'rgba(255, 210, 122, 0.25)';
    ctx.fillText('★', G.width / 2 - 44 + i * 44, 486);
  }
  const pulse = 0.65 + 0.35 * Math.sin(G.time * 3);
  ctx.globalAlpha = pulse;
  title(ctx, '▶  PRESS R OR CLICK TO PLAY AGAIN  ◀', G.width / 2, 556, 22, '#ffe9a8');
  ctx.globalAlpha = 1;
}
