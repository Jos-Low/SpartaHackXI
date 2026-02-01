// game_3.js — Flow Free–style connect-the-pairs puzzle
// - 3 fixed levels (5x5 -> 6x6 -> 7x7)
// - Drag from endpoint to endpoint
// - No crossings / no shared cells
// - Mouse + touch via Pointer Events
// - When a level is solved, show "Next Level" button.
// - After final level, show "You Won!" screen.
// - Timers: Level 1 = 15s, Level 2 = 20s, Level 3 = 30s

// ---------- Level pack ----------
const LEVELS = [
  {
    name: "Level 1 (5x5)",
    rows: 5,
    cols: 5,
    colors: [
      { id: "red", hex: "#ff4d4d", a: [0, 2], b: [3, 4] },
      { id: "blue", hex: "#4da3ff", a: [3, 2], b: [4, 4] },
      { id: "yellow", hex: "#ffd84d", a: [1, 0], b: [3, 0] },
      { id: "green", hex: "#4dff9a", a: [0, 0], b: [3, 3] },
      { id: "orange", hex: "#ca6315", a: [2, 2], b: [4, 0] },
    ],
  },
  {
    name: "Level 2 (6x6)",
    rows: 6,
    cols: 6,
    colors: [
      { id: "red", hex: "#ff4d4d", a: [4, 1], b: [4, 4] },
      { id: "blue", hex: "#4da3ff", a: [4, 2], b: [4, 5] },
      { id: "yellow", hex: "#ffd84d", a: [0, 1], b: [2, 5] },
      { id: "green", hex: "#4dff9a", a: [5, 1], b: [3, 5] },
      { id: "orange", hex: "#ca6315", a: [0, 0], b: [1, 4] },
    ],
  },
  {
    name: "Level 3 (7x7)",
    rows: 7,
    cols: 7,
    colors: [
      { id: "red", hex: "#ff4d4d", a: [0, 6], b: [3, 6] },
      { id: "blue", hex: "#4da3ff", a: [4, 5], b: [6, 6] },
      { id: "yellow", hex: "#ffd84d", a: [3, 3], b: [6, 4] },
      { id: "green", hex: "#4dff9a", a: [1, 4], b: [6, 1] },
      { id: "teal", hex: "#6bc4ff", a: [5, 1], b: [6, 5 ] },
      { id: "orange", hex: "#ca6315", a: [0, 2], b: [6, 0] },
    ],
  },
];

// ---------- DOM (null-safe) ----------
const boardEl = document.getElementById("board");
const levelSelectEl = document.getElementById("levelSelect");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");
const nextBtn = document.getElementById("nextBtn");
const timerEl = document.getElementById("timer");
const winScreen = document.getElementById("winScreen");
const loseScreen = document.getElementById("loseScreen");

// ---------- Campaign state ----------
let campaignComplete = false;
let levelSolved = false;

// ---------- Timer ----------
const LEVEL_TIMES = [15, 20, 30]; // seconds for levels 1, 2, 3
let timeLeft = 0;
let timerInterval = null;
let timeFailed = false;

// ---------- Pointer hover helper ----------
let lastHoverIdx = null;

function idxFromPointerEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return null;

  const cell = el.classList?.contains("cell") ? el : el.closest?.(".cell");
  if (!cell) return null;

  return Number(cell.dataset.idx);
}

// ---------- Game state ----------
let levelIndex = 0;
let level = LEVELS[levelIndex];

let cellEls = [];
let owner = [];
let endpoints = new Map();
let endpointCells = new Map();
let paths = new Map();

// Active drawing
let isDrawing = false;
let activeColor = null;
let activePath = [];
let lastIdx = null;

// ---------- Helpers ----------
function idxOf(r, c) {
  return r * level.cols + c;
}
function rcOf(idx) {
  return [Math.floor(idx / level.cols), idx % level.cols];
}
function keyOf(r, c) {
  return `${r},${c}`;
}
function manhattan(aIdx, bIdx) {
  const [ar, ac] = rcOf(aIdx);
  const [br, bc] = rcOf(bIdx);
  return Math.abs(ar - br) + Math.abs(ac - bc);
}
function colorHex(colorId) {
  const c = level.colors.find((x) => x.id === colorId);
  return c ? c.hex : "#ffffff";
}
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}
function showNextButton(show, label = "Next Level") {
  if (!nextBtn) return;
  nextBtn.textContent = label;
  nextBtn.style.display = show ? "inline-flex" : "none";
  nextBtn.disabled = !show;
}

function isColorComplete(colorId) {
  const p = paths.get(colorId);
  if (!p || p.length < 2) return false;

  const ends = endpointCells.get(colorId);
  if (!ends) return false;

  const start = p[0];
  const end = p[p.length - 1];
  return (
    (start === ends.aIdx && end === ends.bIdx) ||
    (start === ends.bIdx && end === ends.aIdx)
  );
}

function countCompleted() {
  let done = 0;
  for (const c of level.colors) {
    if (isColorComplete(c.id)) done++;
  }
  return done;
}

function isWin() {
  return countCompleted() === level.colors.length;
}

// ---------- Timer functions ----------
function startTimer() {
  stopTimer();
  timeFailed = false;
  timeLeft = LEVEL_TIMES[levelIndex];
  updateTimerDisplay();
  
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 5 && timerEl) {
      timerEl.classList.add('warning');
    }
    
    if (timeLeft <= 0) {
      onTimerExpired();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (timerEl) timerEl.classList.remove('warning');
}

function updateTimerDisplay() {
  if (!timerEl) return;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  timerEl.textContent = `⏱ ${mins}:${secs.toString().padStart(2, '0')}`;
}

function onTimerExpired() {
  stopTimer();
  timeFailed = true;
  isDrawing = false;
  loseScreen.classList.remove('hidden');
  lockGameUI();
}

// ---------- Rendering ----------
function buildLevelSelect() {
  if (!levelSelectEl) return;
  levelSelectEl.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = L.name;
    levelSelectEl.appendChild(opt);
  });
  levelSelectEl.value = String(levelIndex);
}

function rebuildBoard() {
  if (!boardEl) return;

  boardEl.innerHTML = "";
  cellEls = [];
  owner = new Array(level.rows * level.cols).fill(null);
  endpoints.clear();
  endpointCells.clear();
  paths.clear();

  // responsive cell size
  const maxCell = 54;
  const minCell = 34;
  const size = Math.max(
    minCell,
    Math.min(maxCell, Math.floor(520 / Math.max(level.rows, level.cols)))
  );

  boardEl.style.setProperty("--rows", level.rows);
  boardEl.style.setProperty("--cols", level.cols);
  boardEl.style.setProperty("--cellSize", `${size}px`);

  // endpoints
  for (const c of level.colors) {
    const aIdx = idxOf(c.a[0], c.a[1]);
    const bIdx = idxOf(c.b[0], c.b[1]);
    endpointCells.set(c.id, { aIdx, bIdx });
    endpoints.set(keyOf(c.a[0], c.a[1]), { colorId: c.id, which: "a" });
    endpoints.set(keyOf(c.b[0], c.b[1]), { colorId: c.id, which: "b" });
  }

  // cells
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const idx = idxOf(r, c);
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.idx = String(idx);

      const ep = endpoints.get(keyOf(r, c));
      if (ep) {
        const wrapper = document.createElement("div");
        wrapper.className = "endpoint";
        wrapper.style.setProperty("--fill", colorHex(ep.colorId));

        const dot = document.createElement("div");
        dot.className = "dot";

        wrapper.appendChild(dot);
        cell.appendChild(wrapper);
      }

      cell.addEventListener("pointerdown", onPointerDown);
      cell.addEventListener("contextmenu", (e) => e.preventDefault());

      boardEl.appendChild(cell);
      cellEls[idx] = cell;
    }
  }

  redrawAll();
  updateUI();
}

function applyCellStyle(idx) {
  const cell = cellEls[idx];
  if (!cell) return;

  cell.classList.remove("active");

  const o = owner[idx];
  if (o) {
    cell.classList.add("filled");
    cell.style.setProperty("--fill", colorHex(o));
  } else {
    cell.classList.remove("filled");
    cell.style.removeProperty("--fill");
  }
}

function redrawAll() {
  for (let i = 0; i < owner.length; i++) applyCellStyle(i);
}

function lockGameUI() {
  if (levelSelectEl) levelSelectEl.disabled = true;
  if (resetBtn) resetBtn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
}

function updateUI() {
  const done = countCompleted();
  if (progressEl) progressEl.textContent = `${done}/${level.colors.length} connected`;

  if (timeFailed) return;

  if (campaignComplete) {
    setStatus("🎉 Good Game!");
    showNextButton(false);
    return;
  }

  if (isWin()) {
    levelSolved = true;
    stopTimer();

    if (levelIndex >= LEVELS.length - 1) {
      // Finished last level - show win screen!
      campaignComplete = true;
      winScreen.classList.remove('hidden');
      lockGameUI();
      return;
    }

    setStatus("✅ Level complete!");
    showNextButton(true, "Next Level");
  } else {
    levelSolved = false;
    setStatus("Connect all matching colors.");
    showNextButton(false);
  }
}

// ---------- Path / ownership logic ----------
function clearPath(colorId) {
  const p = paths.get(colorId);
  if (!p) return;

  for (const idx of p) owner[idx] = null;
  paths.delete(colorId);
}

function commitActivePath() {
  if (!activeColor || activePath.length === 0) return;

  for (const idx of activePath) owner[idx] = activeColor;
  paths.set(activeColor, [...activePath]);
}

function canStepInto(nextIdx) {
  if (lastIdx === null) return false;
  if (manhattan(lastIdx, nextIdx) !== 1) return false;

  const cellOwner = owner[nextIdx];
  if (cellOwner === null) return true;
  if (cellOwner === activeColor) return true;

  return false;
}

function isEndpointIdx(idx, colorId) {
  const ends = endpointCells.get(colorId);
  if (!ends) return false;
  return idx === ends.aIdx || idx === ends.bIdx;
}

// ---------- Input handling ----------
function onPointerMove(e) {
  if (!isDrawing) return;

  const idx = idxFromPointerEvent(e);
  if (idx == null) return;
  if (idx === lastHoverIdx) return;

  lastHoverIdx = idx;
  stepToIdx(idx);
}

function onPointerDown(e) {
  if (campaignComplete || timeFailed) return;
  e.preventDefault();

  const idx = Number(e.currentTarget.dataset.idx);
  const [r, c] = rcOf(idx);
  const ep = endpoints.get(keyOf(r, c));
  const clickedOwner = owner[idx];

  if (!ep && !clickedOwner) return;

  isDrawing = true;
  lastHoverIdx = idx;

  activeColor = ep ? ep.colorId : clickedOwner;

  clearPath(activeColor);

  activePath = [idx];
  lastIdx = idx;

  owner[idx] = activeColor;

  highlightActive(true);
  redrawAll();
  updateUI();

  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {}
}

function stepToIdx(idx) {
  if (!isDrawing) return;
  if (idx === lastIdx) return;

  const prevIdx = activePath.length >= 2 ? activePath[activePath.length - 2] : null;
  if (prevIdx !== null && idx === prevIdx) {
    const removed = activePath.pop();
    if (!isEndpointIdx(removed, activeColor)) owner[removed] = null;
    lastIdx = idx;
    redrawAll();
    updateUI();
    return;
  }

  if (!canStepInto(idx)) return;

  const existingPos = activePath.indexOf(idx);
  if (existingPos !== -1) {
    for (let i = activePath.length - 1; i > existingPos; i--) {
      const removed = activePath[i];
      if (!isEndpointIdx(removed, activeColor)) owner[removed] = null;
    }
    activePath = activePath.slice(0, existingPos + 1);
    lastIdx = idx;
    redrawAll();
    updateUI();
    return;
  }

  activePath.push(idx);
  owner[idx] = activeColor;
  lastIdx = idx;

  redrawAll();
  updateUI();
}

function onPointerUp() {
  if (!isDrawing) return;

  const ends = endpointCells.get(activeColor);
  const startIdx = activePath[0];
  const endIdx = activePath[activePath.length - 1];

  const touchesA = activePath.includes(ends.aIdx);
  const touchesB = activePath.includes(ends.bIdx);

  const isEndpointEnd =
    (endIdx === ends.aIdx || endIdx === ends.bIdx) &&
    (startIdx === ends.aIdx || startIdx === ends.bIdx);

  if (touchesA && touchesB && isEndpointEnd) {
    commitActivePath();
  } else {
    for (const idx of activePath) {
      if (!isEndpointIdx(idx, activeColor)) owner[idx] = null;
    }
  }

  isDrawing = false;
  activeColor = null;
  activePath = [];
  lastIdx = null;

  highlightActive(false);
  redrawAll();
  updateUI();
}

function highlightActive(on) {
  if (!on) {
    for (const el of cellEls) el?.classList?.remove("active");
    return;
  }
  const ends = endpointCells.get(activeColor);
  if (!ends) return;
  cellEls[ends.aIdx]?.classList.add("active");
  cellEls[ends.bIdx]?.classList.add("active");
}

// ---------- Level changes ----------
function loadLevel(i) {
  levelIndex = i;
  level = LEVELS[levelIndex];

  isDrawing = false;
  activeColor = null;
  activePath = [];
  lastIdx = null;
  lastHoverIdx = null;

  levelSolved = false;
  showNextButton(false);

  rebuildBoard();
  buildLevelSelect();
  
  startTimer();
}

// ---------- Buttons ----------
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (campaignComplete || timeFailed) return;
    for (const c of level.colors) clearPath(c.id);
    owner.fill(null);
    redrawAll();
    updateUI();
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (campaignComplete || timeFailed) return;
    for (const c of level.colors) clearPath(c.id);
    owner.fill(null);
    redrawAll();
    updateUI();
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (campaignComplete) return;
    if (!levelSolved) return;

    const next = levelIndex + 1;
    if (next < LEVELS.length) {
      loadLevel(next);
    }
  });
}

if (levelSelectEl) {
  levelSelectEl.addEventListener("change", (e) => {
    if (campaignComplete) return;
    const i = Number(e.target.value);
    loadLevel(i);
  });
}

// Win/Lose screen buttons
if (document.getElementById('closeWinBtn')) {
  document.getElementById('closeWinBtn').onclick = () => window.close();
}

if (document.getElementById('retryBtn')) {
  document.getElementById('retryBtn').onclick = () => {
    loseScreen.classList.add('hidden');
    timeFailed = false;
    if (resetBtn) resetBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    loadLevel(levelIndex);
  };
}

if (document.getElementById('closeLoseBtn')) {
  document.getElementById('closeLoseBtn').onclick = () => window.close();
}

// Global pointer events
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

// ---------- Init ----------
buildLevelSelect();
loadLevel(0);