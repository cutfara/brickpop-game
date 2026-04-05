/* ════════════════════════════════════════════════════════════
   BRICKPOP — script.js
   8×8 block puzzle · drag-and-drop · line clear
════════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────
   BLOCK SHAPES
   Each shape is an array of [row, col] offsets from [0,0].
   All shapes are pre-normalized (min row = 0, min col = 0).
────────────────────────────────────────────────────────── */
const SHAPES = [
  // Singles & Lines
  [[0,0]],                              // 1 dot
  [[0,0],[0,1]],                        // H-2
  [[0,0],[0,1],[0,2]],                  // H-3
  [[0,0],[1,0]],                        // V-2
  [[0,0],[1,0],[2,0]],                  // V-3

  // Square
  [[0,0],[0,1],[1,0],[1,1]],            // 2×2

  // L & J variants
  [[0,0],[1,0],[2,0],[2,1]],            // L down-right
  [[0,1],[1,1],[2,0],[2,1]],            // J down-left
  [[0,0],[0,1],[0,2],[1,0]],            // L flat-right
  [[0,0],[0,1],[0,2],[1,2]],            // J flat-left

  // T shapes
  [[0,0],[0,1],[0,2],[1,1]],            // T top
  [[0,1],[1,0],[1,1],[2,1]],            // T right

  // S / Z
  [[0,0],[0,1],[1,1],[1,2]],            // S
  [[0,1],[0,2],[1,0],[1,1]],            // Z

  // Corners (L-mini)
  [[0,0],[1,0],[1,1]],                  // corner ↙
  [[0,0],[0,1],[1,0]],                  // corner ↖
  [[0,0],[0,1],[1,1]],                  // corner ↗
  [[0,1],[1,0],[1,1]],                  // corner ↘
];

/* Neon color palette */
const COLORS = [
  '#00f5d4', // cyan
  '#f72585', // pink
  '#fee440', // yellow
  '#80ff44', // lime
  '#ff6b35', // orange
  '#a855f7', // purple
  '#4cc9f0', // sky
  '#ff85a1', // rose
];
const placeSound = new Audio('assets/place.mp3');
const clearSound = new Audio('assets/clear.mp3');
const gameOverSound = new Audio('assets/gameover.mp3');

const bgMusic = new Audio('assets/bg.mp3');
bgMusic.loop = true;
placeSound.volume = 0.5;
clearSound.volume = 0.6;
gameOverSound.volume = 0.7;
bgMusic.volume = 0.03;
/* ──────────────────────────────────────────────────────────
   GAME STATE
────────────────────────────────────────────────────────── */
const BOARD_N = 8;

let board    = [];          // 8×8 matrix: 0 = empty, "#color" = filled
let score    = 0;
let level = 1;
let coins = 0;
let ownedThemes = [];
let unlockedAchievements = [];
let lastLevel = 1;
let best     = 0;
let pieces   = [null, null, null];  // current 3 available pieces
let drag     = null;        // active drag descriptor
let litCells = [];          // board cells currently highlighted
let combo = 0;
let isPaused = false;
let soundOn = true;

/* ──────────────────────────────────────────────────────────
   DOM REFERENCES
────────────────────────────────────────────────────────── */
const $board      = document.getElementById('board');
const $scoreVal   = document.getElementById('scoreVal');
const $bestVal    = document.getElementById('bestVal');
const $levelVal = document.getElementById('levelVal');
const $coinVal = document.getElementById('coinVal');
const $buyNeonBtn = document.getElementById('buyNeonBtn');
const $buyCandyBtn = document.getElementById('buyCandyBtn');
const $buyGalaxyBtn = document.getElementById('buyGalaxyBtn');
const $resetThemeBtn = document.getElementById('resetThemeBtn');
const $shopPanel = document.getElementById('shopPanel');
const $shopToggle = document.getElementById('shopToggle');
const $levelPopup = document.getElementById('levelPopup');
const $achievementPopup = document.getElementById('achievementPopup');
const $rewardPopup = document.getElementById('rewardPopup');
const $rewardDayText = document.getElementById('rewardDayText');
const $overlay    = document.getElementById('overlay');
const $modalScore = document.getElementById('modalScore');
const $modalBest  = document.getElementById('modalBest');
const $btnRestart = document.getElementById('btnRestart');
const $btnPause = document.getElementById('btnPause');
const $btnMusic = document.getElementById('btnMusic');
const $pauseOverlay = document.getElementById('pauseOverlay');
const $btnResumeGame = document.getElementById('btnResumeGame');
const $btnAgain   = document.getElementById('btnPlayAgain');
const $startScreen = document.getElementById('startScreen');
const $btnStartGame = document.getElementById('btnStartGame');
const slots       = [0, 1, 2].map(i => document.getElementById(`slot-${i}`));

/* ──────────────────────────────────────────────────────────
   RESPONSIVE DIMENSIONS  (read from CSS custom properties)
────────────────────────────────────────────────────────── */
let CELL, GAP, TOTAL;   // px values, refreshed on resize

function readDims() {
  const cs = getComputedStyle(document.documentElement);
  CELL  = parseInt(cs.getPropertyValue('--cell-size'));
  GAP   = parseInt(cs.getPropertyValue('--cell-gap'));
  TOTAL = CELL + GAP;
}

/* ──────────────────────────────────────────────────────────
   UTILITY HELPERS
────────────────────────────────────────────────────────── */
/** Pick a random item from an array */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** Bounding box of a piece's cell list */
function bbox(cells) {
  return {
    rows: Math.max(...cells.map(c => c[0])) + 1,
    cols: Math.max(...cells.map(c => c[1])) + 1,
  };
}

/** Can the piece (cells) be placed with its top-left at [sr, sc]? */
function canFit(cells, sr, sc) {
  return cells.every(([dr, dc]) => {
    const r = sr + dr, c = sc + dc;
    return r >= 0 && r < BOARD_N &&
           c >= 0 && c < BOARD_N &&
           !board[r][c];
  });
}

/** Mini cell size in the tray (responsive) */
function miniCellPx() {
  if (window.innerWidth <= 400) return 22;
  if (window.innerWidth <= 520) return 26;
  return 32;
}

/* ──────────────────────────────────────────────────────────
   INITIALISE / RESTART
────────────────────────────────────────────────────────── */
function init() {
  readDims();

  board  = Array.from({ length: BOARD_N }, () => Array(BOARD_N).fill(0));
  score = 0;
level = 1;
lastLevel = 1;
combo = 0;
best = parseInt(localStorage.getItem('bp_best') || '0');
coins = parseInt(localStorage.getItem('bp_coins') || '0');

ownedThemes = JSON.parse(
  localStorage.getItem('bp_owned_themes') || '[]'
);

unlockedAchievements = JSON.parse(
  localStorage.getItem('bp_achievements') || '[]'
);
  pieces = [null, null, null];

  refreshScore();
  renderBoard();
  spawnPieces();
  hideOverlay();
  checkDailyReward();
  applySavedTheme();
  updateThemeButtons();
}

/* ──────────────────────────────────────────────────────────
   SCORE
────────────────────────────────────────────────────────── */
function addScore(pts, cx, cy) {
  score += pts;
  if (score > best) {
    best = score;
    localStorage.setItem('bp_best', best);
  }
  refreshScore();
  if (cx !== undefined) spawnFloatScore(pts, cx, cy);
}

function refreshScore() {
  function showLevelPopup() {
  $levelPopup.classList.add('show');

  setTimeout(() => {
    $levelPopup.classList.remove('show');
  }, 1200);
}
function checkAchievements() {
  if (score >= 500 && !unlockedAchievements.includes('rookie')) {
    unlockedAchievements.push('rookie');
    showAchievement('🏆 Rookie Unlocked!');
  }

  if (score >= 1000 && !unlockedAchievements.includes('pro')) {
    unlockedAchievements.push('pro');
    showAchievement('🔥 Pro Player!');
  }

  if (score >= 2000 && !unlockedAchievements.includes('master')) {
    unlockedAchievements.push('master');
    showAchievement('👑 Brick Master!');
  }
}

function showAchievement(text) {
  $achievementPopup.textContent = text;
  $achievementPopup.classList.add('show');

  setTimeout(() => {
    $achievementPopup.classList.remove('show');
  }, 1500);
}
 level = Math.floor(score / 500) + 1;

if (level > lastLevel) {
  showLevelPopup();

  const levelPill = document.querySelector('.score-pill.level');
  levelPill.style.animation = 'none';
  void levelPill.offsetHeight; // reset animation
  levelPill.style.animation = 'levelPulse 0.5s ease';

  lastLevel = level;
}
  $scoreVal.textContent = score;
  $bestVal.textContent  = best;
  $levelVal.textContent = level;
  $coinVal.textContent = coins;

  triggerBump($scoreVal);
  checkAchievements();
  saveProgress();
}

/** Pulse-scale a DOM element using CSS animation */
function triggerBump(el) {
  el.style.animation = 'none';
  void el.offsetHeight; // force reflow
  el.style.animation = 'scoreBump .22s ease-out';
}

/** Show a floating "+NNN" score label */
function spawnFloatScore(pts, cx, cy) {
  const el = document.createElement('div');
  el.className = 'fscore';
  el.textContent = '+' + pts;
  el.style.left  = cx + 'px';
  el.style.top   = cy + 'px';
  el.style.color =
    pts >= 250 ? '#fee440' :
    pts >= 100 ? '#00f5d4' : '#80ff44';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function showComboText(combo, cx, cy) {
  if (combo <= 1) return;

  const el = document.createElement('div');
  el.className = 'fscore';
  el.textContent = `COMBO x${combo}`;
  el.style.left = cx + 'px';
  el.style.top = (cy - 30) + 'px';
  el.style.color = '#f72585';

  document.body.appendChild(el);

  setTimeout(() => el.remove(), 1000);
}
/* ──────────────────────────────────────────────────────────
   BOARD RENDERING
────────────────────────────────────────────────────────── */
function renderBoard() {
  $board.innerHTML = '';
  for (let r = 0; r < BOARD_N; r++) {
    for (let c = 0; c < BOARD_N; c++) {
      const div = document.createElement('div');
      div.className   = 'cell';
      div.dataset.r   = r;
      div.dataset.c   = c;
      if (board[r][c]) applyFilledStyle(div, board[r][c]);
      $board.appendChild(div);
    }
  }
}

/** Get the DOM element for board cell [r, c] */
function cellEl(r, c) {
  return $board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

/** Visually fill a cell element with the given colour */
function applyFilledStyle(el, color) {
  el.classList.add('filled');
  el.style.background = color;
  el.style.boxShadow  = `0 0 11px ${color}80`;
}

/** Visually empty a cell element */
function clearCellStyle(el) {
  el.classList.remove('filled', 'hi-valid', 'hi-invalid', 'popping');
  el.style.background = '';
  el.style.boxShadow  = '';
}

/* ──────────────────────────────────────────────────────────
   PIECE TRAY
────────────────────────────────────────────────────────── */
/** Generate new pieces for any empty slots and draw them */
function spawnPieces() {
  for (let i = 0; i < 3; i++) {
    if (pieces[i] === null) {
      pieces[i] = {
        cells: [...pick(SHAPES)],   // clone shape
        color: pick(COLORS),
      };
    }
    drawSlot(i);
  }
}

/** Render piece in tray slot i */
function drawSlot(i) {
  const slot = slots[i];
  slot.innerHTML      = '';
  slot.onmousedown    = null;
  slot.ontouchstart   = null;

  if (!pieces[i]) {
    slot.classList.add('empty');
    return;
  }
  slot.classList.remove('empty');

  const p    = pieces[i];
  const MINI = miniCellPx();
  const { rows, cols } = bbox(p.cells);

  const grid = document.createElement('div');
  grid.className = 'mini-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, ${MINI}px)`;
  grid.style.gridTemplateRows    = `repeat(${rows}, ${MINI}px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = document.createElement('div');
      d.className    = 'mini-cell';
      d.style.width  = MINI + 'px';
      d.style.height = MINI + 'px';

      if (p.cells.some(([pr, pc]) => pr === r && pc === c)) {
        d.style.background = p.color;
        d.style.boxShadow  = `0 0 6px ${p.color}90`;
      } else {
        d.classList.add('blank');
      }
      grid.appendChild(d);
    }
  }

  slot.appendChild(grid);

  /* Attach drag starters */
  slot.onmousedown = e => {
    e.preventDefault();
    beginDrag(i, e.clientX, e.clientY);
  };
  slot.ontouchstart = e => {
    e.preventDefault();
    const t = e.touches[0];
    beginDrag(i, t.clientX, t.clientY);
  };
}

/* ──────────────────────────────────────────────────────────
   DRAG — BEGIN
────────────────────────────────────────────────────────── */
function beginDrag(pieceIdx, cx, cy) {
    if (isPaused) return;
  readDims();
  const p = pieces[pieceIdx];
  if (!p) return;

  const { rows, cols } = bbox(p.cells);
  const ghostW = cols * CELL + (cols - 1) * GAP;
  const ghostH = rows * CELL + (rows - 1) * GAP;

  /* Build ghost element (piece rendered at board scale) */
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
  ghost.style.gridTemplateRows    = `repeat(${rows}, ${CELL}px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = document.createElement('div');
      d.className = 'ghost-cell';
      if (p.cells.some(([pr, pc]) => pr === r && pc === c)) {
        d.style.background = p.color;
        d.style.boxShadow  = `0 0 14px ${p.color}`;
      } else {
        d.style.opacity = '0';
        d.style.pointerEvents = 'none';
      }
      ghost.appendChild(d);
    }
  }

  document.body.appendChild(ghost);

  /* Centre ghost on cursor */
  ghost.style.left = (cx - ghostW / 2) + 'px';
  ghost.style.top  = (cy - ghostH / 2) + 'px';

  /* Fade out the tray slot */
  slots[pieceIdx].style.opacity = '0.2';

  drag = {
    pieceIdx, p, ghost,
    ghostW, ghostH,
    snapR: null, snapC: null, snapOk: false,
  };
}

/* ──────────────────────────────────────────────────────────
   DRAG — MOVE
────────────────────────────────────────────────────────── */
function moveDrag(cx, cy) {
  if (!drag) return;
  const { ghost, ghostW, ghostH, p } = drag;

  /* Move ghost */
  ghost.style.left = (cx - ghostW / 2) + 'px';
  ghost.style.top  = (cy - ghostH / 2) + 'px';

  /* Clear previous highlights */
  clearLit();

  /* Only snap if cursor is inside the board area */
  const rect = $board.getBoundingClientRect();
  if (cx < rect.left || cx > rect.right ||
      cy < rect.top  || cy > rect.bottom) {
    drag.snapOk = false;
    drag.snapR = drag.snapC = null;
    return;
  }

  /* Map cursor → starting board cell so piece bounding box centres on cursor */
  const { rows, cols } = bbox(p.cells);
  const relX = cx - rect.left;
  const relY = cy - rect.top;

  const sc = Math.round(relX / TOTAL - cols / 2);
  const sr = Math.round(relY / TOTAL - rows / 2);

  const ok = canFit(p.cells, sr, sc);
  drag.snapR  = sr;
  drag.snapC  = sc;
  drag.snapOk = ok;

  /* Highlight target cells */
  p.cells.forEach(([dr, dc]) => {
    const r = sr + dr, c = sc + dc;
    if (r >= 0 && r < BOARD_N && c >= 0 && c < BOARD_N) {
      const el = cellEl(r, c);
      if (el) {
        el.classList.add(ok ? 'hi-valid' : 'hi-invalid');
        litCells.push({ r, c });
      }
    }
  });
}

/* ──────────────────────────────────────────────────────────
   DRAG — END
────────────────────────────────────────────────────────── */
function endDrag(cx, cy) {
  if (!drag) return;
  const { pieceIdx, snapR, snapC, snapOk, ghost } = drag;

  clearLit();
  ghost.remove();
  slots[pieceIdx].style.opacity = '';

  if (snapOk && snapR !== null) {
    placePiece(pieceIdx, snapR, snapC, cx, cy);
  }

  drag = null;
}

/** Remove all board highlight classes */
function clearLit() {
  litCells.forEach(({ r, c }) => {
    const el = cellEl(r, c);
    if (el) el.classList.remove('hi-valid', 'hi-invalid');
  });
  litCells = [];
}

/* ──────────────────────────────────────────────────────────
   PLACEMENT
────────────────────────────────────────────────────────── */
function placePiece(pieceIdx, sr, sc, cx, cy) {
  const p = pieces[pieceIdx];

  /* Write colour to board data + DOM */
  p.cells.forEach(([dr, dc]) => {
    const r = sr + dr, c = sc + dc;
    board[r][c] = p.color;
    const el = cellEl(r, c);
    if (el) applyFilledStyle(el, p.color);
  });

  /* +10 for placing a block */
  addScore(10, cx, cy);
 if (soundOn) {
  placeSound.currentTime = 0;
  placeSound.play();
}

  /* Remove piece from tray */
  pieces[pieceIdx] = null;
  slots[pieceIdx].innerHTML = '';
  slots[pieceIdx].classList.add('empty');
  slots[pieceIdx].onmousedown  = null;
  slots[pieceIdx].ontouchstart = null;

  /* Check for full lines; after animation handle refill + game-over */
  clearLines(cx, cy, () => {
    /* Regenerate all 3 pieces when all have been placed */
    if (pieces.every(p => p === null)) {
      pieces = [null, null, null];
      spawnPieces();
    }
    checkGameOver();
  });
}

/* ──────────────────────────────────────────────────────────
   LINE CLEAR
────────────────────────────────────────────────────────── */
function clearLines(cx, cy, callback) {
  const fullRows = [];
  const fullCols = [];

  /* Detect complete rows */
  for (let r = 0; r < BOARD_N; r++) {
    if (board[r].every(v => v !== 0)) fullRows.push(r);
  }
  /* Detect complete columns */
  for (let c = 0; c < BOARD_N; c++) {
    if (board.every(row => row[c] !== 0)) fullCols.push(c);
  }

if (!fullRows.length && !fullCols.length) {
    combo = 0;
    callback();
    return;
}

  /* Collect unique cells to clear */
  const keysToAnimate = new Set();
  fullRows.forEach(r => {
    for (let c = 0; c < BOARD_N; c++) keysToAnimate.add(`${r},${c}`);
  });
  fullCols.forEach(c => {
    for (let r = 0; r < BOARD_N; r++) keysToAnimate.add(`${r},${c}`);
  });

  /* Kick off pop animation */
  keysToAnimate.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    const el = cellEl(r, c);
    if (el) el.classList.add('popping');
  });

  /* After animation: clear data and update DOM */
 if (soundOn) {
  clearSound.currentTime = 0;
  clearSound.play();
}
  setTimeout(() => {
    keysToAnimate.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      board[r][c] = 0;
      const el = cellEl(r, c);
      if (el) clearCellStyle(el);
    });

    /* Score based on lines cleared (combos give bonus) */
    const n   = fullRows.length + fullCols.length;
    combo++;

let pts = n === 1 ? 100 : n === 2 ? 250 : n * 200;
pts += combo * 50;

addScore(pts, cx, cy);
showComboText(combo, cx, cy);

    callback();
  }, 340);
}

/* ──────────────────────────────────────────────────────────
   GAME OVER
────────────────────────────────────────────────────────── */
function checkGameOver() {
  const active = pieces.filter(Boolean);
  if (!active.length) return; // pieces are about to be regenerated

  /* If no available piece can fit anywhere → game over */
  const anyFit = active.some(p => {
    for (let r = 0; r < BOARD_N; r++) {
      for (let c = 0; c < BOARD_N; c++) {
        if (canFit(p.cells, r, c)) return true;
      }
    }
    return false;
  });

  if (!anyFit) setTimeout(showGameOver, 480);
}

/* ──────────────────────────────────────────────────────────
   OVERLAY  (game over modal)
────────────────────────────────────────────────────────── */
function showGameOver() {
  if (soundOn) {
  gameOverSound.currentTime = 0;
  gameOverSound.play();
}
  $modalScore.textContent = score;
  $modalBest.textContent  = best;
  $overlay.classList.add('show');
  $overlay.setAttribute('aria-hidden', 'false');
}

function hideOverlay() {
  $overlay.classList.remove('show');
  $overlay.setAttribute('aria-hidden', 'true');
}

/* ──────────────────────────────────────────────────────────
   EVENT LISTENERS
────────────────────────────────────────────────────────── */

/* Mouse drag */
document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
document.addEventListener('mouseup',   e => endDrag(e.clientX, e.clientY));

/* Touch drag */
document.addEventListener('touchmove', e => {
  if (!drag) return;
  e.preventDefault();
  const t = e.touches[0];
  moveDrag(t.clientX, t.clientY);
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!drag) return;
  const t = e.changedTouches[0];
  endDrag(t.clientX, t.clientY);
});

/* Buttons */
$shopToggle.addEventListener('click', () => {
  if ($shopPanel.style.display === 'none' || !$shopPanel.style.display) {
    $shopPanel.style.display = 'block';
  } else {
    $shopPanel.style.display = 'none';
  }
});
$btnRestart.addEventListener('click', init);
$buyNeonBtn.addEventListener('click', () => buyTheme('neon', 500));
$buyCandyBtn.addEventListener('click', () => buyTheme('candy', 700));
$buyGalaxyBtn.addEventListener('click', () => buyTheme('galaxy', 1000));
$resetThemeBtn.addEventListener('click', resetTheme);
$btnMusic.addEventListener('click', () => {
  soundOn = !soundOn;

  if (soundOn) {
    $btnMusic.textContent = '🔊';
    bgMusic.play();
  } else {
    $btnMusic.textContent = '🔇';
    bgMusic.pause();
  }
});

$btnPause.addEventListener('click', () => {
  isPaused = !isPaused;

if (isPaused) {
  $btnPause.textContent = '▶';
  $pauseOverlay.style.display = 'flex';
  bgMusic.pause();
} else {
  $btnPause.textContent = '⏸';
  $pauseOverlay.style.display = 'none';
  if (soundOn) bgMusic.play();
}
});
$btnResumeGame.addEventListener('click', () => {
  isPaused = false;
  $btnPause.textContent = '⏸';
  $pauseOverlay.style.display = 'none';
});
$btnAgain.addEventListener('click', init);

/* Refresh dimensions & redraw slots on window resize */
window.addEventListener('resize', () => {
  readDims();
  slots.forEach((_, i) => drawSlot(i));
});

/* ──────────────────────────────────────────────────────────
   BOOT
────────────────────────────────────────────────────────── */
document.querySelector('.game-container').style.display = 'none';
$btnStartGame.addEventListener('click', () => {
  $startScreen.style.display = 'none';
  document.querySelector('.game-container').style.display = 'flex';

  bgMusic.play();

  init();
});
function saveProgress() {
  localStorage.setItem('bp_best', best);

  localStorage.setItem(
    'bp_achievements',
    JSON.stringify(unlockedAchievements)
  );

  localStorage.setItem('bp_coins', coins);

  localStorage.setItem(
    'bp_owned_themes',
    JSON.stringify(ownedThemes)
  );
}
function checkDailyReward() {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem('bp_last_login');
  let streak = parseInt(localStorage.getItem('bp_streak') || '1');

  if (!savedDate) {
    streak = 1;
  } else {
    const lastDate = new Date(savedDate);
    const currentDate = new Date(today);

    const diffTime = currentDate - lastDate;
   const diffDays = Math.round(
  diffTime / (1000 * 60 * 60 * 24)
);

    if (diffDays === 1) {
      streak++;
    } else if (diffDays > 1) {
      streak = 1;
    } else {
      return;
    }
  }

  localStorage.setItem('bp_last_login', today);
  localStorage.setItem('bp_streak', streak);

  showDailyReward(streak);
}

function showDailyReward(day) {
  const reward = day * 100;

  coins += reward;
localStorage.setItem('bp_coins', coins);
refreshScore();

  $rewardDayText.textContent = `🎁 Day ${day} Reward`;
  $rewardPopup.querySelector('span').textContent = `+${reward} Coins`;

  $rewardPopup.classList.add('show');

  setTimeout(() => {
    $rewardPopup.classList.remove('show');
  }, 2000);
}

function buyTheme(themeName, price) {
  // kalau sudah punya, cukup pakai theme
  if (ownedThemes.includes(themeName)) {
    localStorage.setItem('bp_theme', themeName);

    applySavedTheme();
    updateThemeButtons();
    refreshScore();   // <- penting
    return;
  }

  // cek coin cukup atau tidak
  if (coins < price) {
    alert('Coins not enough!');
    return;
  }

  // kurangi coin
 const oldCoins = coins;
coins -= price;
animateCoins(oldCoins, coins);

  // simpan theme yang dibeli
  ownedThemes.push(themeName);

  // save
  localStorage.setItem('bp_coins', coins);
  localStorage.setItem('bp_theme', themeName);
  localStorage.setItem(
    'bp_owned_themes',
    JSON.stringify(ownedThemes)
  );

  // update UI
  applySavedTheme();
  updateThemeButtons();
  refreshScore();   // <- WAJIB
}
function applySavedTheme() {
  const savedTheme = localStorage.getItem('bp_theme');

  if (savedTheme === 'neon') {
    document.documentElement.style.setProperty('--surface', '#00f5d4');
    document.documentElement.style.setProperty('--surface-2', '#4cc9f0');
  }

  if (savedTheme === 'candy') {
    document.documentElement.style.setProperty('--surface', '#f72585');
    document.documentElement.style.setProperty('--surface-2', '#ff85a1');
  }

  if (savedTheme === 'galaxy') {
    document.documentElement.style.setProperty('--surface', '#240046');
    document.documentElement.style.setProperty('--surface-2', '#5a189a');
  }
}
function updateThemeButtons() {
  const activeTheme = localStorage.getItem('bp_theme');

  // Neon
  if (ownedThemes.includes('neon')) {
    $buyNeonBtn.textContent =
      activeTheme === 'neon' ? 'Using ✓' : 'Use Theme';
  } else {
    $buyNeonBtn.textContent = 'Neon Blue (500 Coins)';
  }

  // Candy
  if (ownedThemes.includes('candy')) {
    $buyCandyBtn.textContent =
      activeTheme === 'candy' ? 'Using ✓' : 'Use Theme';
  } else {
    $buyCandyBtn.textContent = 'Candy Pink (700 Coins)';
  }

  // Galaxy
  if (ownedThemes.includes('galaxy')) {
    $buyGalaxyBtn.textContent =
      activeTheme === 'galaxy' ? 'Using ✓' : 'Use Theme';
  } else {
    $buyGalaxyBtn.textContent = 'Galaxy (1000 Coins)';
  }
}
function resetTheme() {
  localStorage.removeItem('bp_theme');

  document.documentElement.style.setProperty('--surface', '#0e0e26');
  document.documentElement.style.setProperty('--surface-2', '#13132d');
}
function animateCoins(from, to) {
  let current = from;

  const step = Math.ceil((from - to) / 15);

  const interval = setInterval(() => {
    current -= step;

    if (current <= to) {
      current = to;
      clearInterval(interval);
    }

    $coinVal.textContent = current;
  }, 40);
}
