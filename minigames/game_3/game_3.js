// game_3.js — Flow Free–style connect-the-pairs puzzle
// - Prebuilt, solvable levels (no randomness)
// - Drag from endpoint to endpoint
// - No crossings / no shared cells
// - Mouse + touch via Pointer Events

// ---------- Solvable level pack ----------
const LEVELS = [
  {
    name: "1 (5x5)",
    rows: 5,
    cols: 5,
    colors: [
      { id: "red",    hex: "#ff4d4d", a: [0, 0], b: [0, 4] },
      { id: "blue",   hex: "#4da3ff", a: [1, 1], b: [3, 1] },
      { id: "yellow", hex: "#ffd84d", a: [2, 0], b: [4, 2] },
      { id: "green",  hex: "#4dff9a", a: [2, 3], b: [4, 4] },
    ],
  },
  {
    name: "2 (6x6)",
    rows: 6,
    cols: 6,
    colors: [
      { id: "red",    hex: "#ff4d4d", a: [0, 0], b: [0, 5] },
      { id: "blue",   hex: "#4da3ff", a: [1, 1], b: [4, 1] },
      { id: "purple", hex: "#b36bff", a: [1, 4], b: [4, 4] },
      { id: "green",  hex: "#4dff9a", a: [5, 0], b: [5, 5] },
    ],
  }
];

// ---------- DOM ----------
const boardEl = document.getElementById("board");
const levelSelectEl = document.getElementById("levelSelect");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");


let lastHoverIdx = null;

function idxFromPointerEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return null;

  // walk up until we find a .cell
  const cell = el.classList?.contains("cell") ? el : el.closest?.(".cell");
  if (!cell) return null;

  return Number(cell.dataset.idx);
}


// ---------- Game state ----------
let levelIndex = 0;
let level = LEVELS[levelIndex];

let cellEls = [];            // DOM refs by index
let owner = [];              // owner[i] = colorId or null
let endpoints = new Map();   // "r,c" -> { colorId, which: "a"|"b" }
let endpointCells = new Map(); // colorId -> {aIdx,bIdx}

let paths = new Map();       // colorId -> array of cell indices (the drawn path in order)

// Active drawing
let isDrawing = false;
let activeColor = null;
let activePath = [];         // cell indices in order
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
function inBounds(r, c) {
  return r >= 0 && c >= 0 && r < level.rows && c < level.cols;
}
function manhattan(aIdx, bIdx) {
  const [ar, ac] = rcOf(aIdx);
  const [br, bc] = rcOf(bIdx);
  return Math.abs(ar - br) + Math.abs(ac - bc);
}
function colorHex(colorId) {
  const c = level.colors.find(x => x.id === colorId);
  return c ? c.hex : "#ffffff";
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function countCompleted() {
  let done = 0;
  for (const c of level.colors) {
    if (isColorComplete(c.id)) done++;
  }
  return done;
}

function isColorComplete(colorId) {
  const p = paths.get(colorId);
  if (!p || p.length < 2) return false;

  const ends = endpointCells.get(colorId);
  if (!ends) return false;

  // Path must start/end at endpoints (either direction)
  const start = p[0];
  const end = p[p.length - 1];
  const ok =
    (start === ends.aIdx && end === ends.bIdx) ||
    (start === ends.bIdx && end === ends.aIdx);

  return ok;
}

function isWin() {
  return countCompleted() === level.colors.length;
}

// ---------- Rendering ----------
function buildLevelSelect() {
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
  boardEl.innerHTML = "";
  cellEls = [];
  owner = new Array(level.rows * level.cols).fill(null);
  endpoints.clear();
  endpointCells.clear();
  paths.clear();

  // responsive cell size
  // board max width ~ 520-620ish; pick a reasonable size per grid
  const maxCell = 54;
  const minCell = 34;
  const size = Math.max(
    minCell,
    Math.min(maxCell, Math.floor(520 / Math.max(level.rows, level.cols)))
  );

  boardEl.style.setProperty("--rows", level.rows);
  boardEl.style.setProperty("--cols", level.cols);
  boardEl.style.setProperty("--cellSize", `${size}px`);

  // precompute endpoints
  for (const c of level.colors) {
    const aIdx = idxOf(c.a[0], c.a[1]);
    const bIdx = idxOf(c.b[0], c.b[1]);
    endpointCells.set(c.id, { aIdx, bIdx });
    endpoints.set(keyOf(c.a[0], c.a[1]), { colorId: c.id, which: "a" });
    endpoints.set(keyOf(c.b[0], c.b[1]), { colorId: c.id, which: "b" });
  }

  // create cells
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

      // pointer handlers on each cell
      cell.addEventListener("pointerdown", onPointerDown);
      //cell.addEventListener("pointerenter", onPointerEnter);

      // Prevent context menu on long press
      cell.addEventListener("contextmenu", (e) => e.preventDefault());

      boardEl.appendChild(cell);
      cellEls[idx] = cell;
    }
  }

  // global pointerup
  //window.addEventListener("pointerup", onPointerUp);

  updateUI();
}

function onPointerMove(e) {
  if (!isDrawing) return;

  const idx = idxFromPointerEvent(e);
  if (idx == null) return;
  if (idx === lastHoverIdx) return;

  lastHoverIdx = idx;
  // reuse your existing step logic by calling onPointerEnter-like behavior
  stepToIdx(idx);
}


function applyCellStyle(idx) {
  const cell = cellEls[idx];
  if (!cell) return;

  // clear active
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

function updateUI() {
  const done = countCompleted();
  progressEl.textContent = `${done}/${level.colors.length} connected`;

  if (isWin()) {
    setStatus("✅ Level complete! Nice.");
  } else {
    setStatus("Connect all matching colors.");
  }
}

// ---------- Path / ownership logic ----------
function clearPath(colorId) {
  const p = paths.get(colorId);
  if (!p) return;

  for (const idx of p) {
    // keep endpoints visually endpoints, but ownership should be cleared too
    owner[idx] = null;
  }
  paths.delete(colorId);
}

function commitActivePath() {
  if (!activeColor || activePath.length === 0) return;

  // Assign ownership to activeColor for every cell in path
  for (const idx of activePath) owner[idx] = activeColor;

  paths.set(activeColor, [...activePath]);
}

function canStepInto(nextIdx) {
  // Must be adjacent orthogonally
  if (lastIdx === null) return false;
  if (manhattan(lastIdx, nextIdx) !== 1) return false;

  const cellOwner = owner[nextIdx];
  if (cellOwner === null) return true;

  // Allow stepping into cells already owned by this same color
  // (useful for backtracking or re-tracing)
  if (cellOwner === activeColor) return true;

  // Otherwise blocked (no crossing / sharing)
  return false;
}

function isEndpointIdx(idx, colorId) {
  const ends = endpointCells.get(colorId);
  if (!ends) return false;
  return idx === ends.aIdx || idx === ends.bIdx;
}

// ---------- Input handling ----------
function onPointerDown(e) {
  e.preventDefault();
  const idx = Number(e.currentTarget.dataset.idx);

  const [r, c] = rcOf(idx);
  const ep = endpoints.get(keyOf(r, c));

  const clickedOwner = owner[idx];

  // Start drawing only if:
  // - clicked an endpoint, OR
  // - clicked an existing path cell (continue/edit that color)
  if (!ep && !clickedOwner) return;

  isDrawing = true;

  lastHoverIdx = idx;
  boardEl.setPointerCapture?.(e.pointerId);

  activeColor = ep ? ep.colorId : clickedOwner;

  // wipe existing path for that color so user can redraw cleanly
  clearPath(activeColor);

  // start from this cell
  activePath = [idx];
  lastIdx = idx;

  // claim starting cell immediately
  owner[idx] = activeColor;

  highlightActive(true);
  redrawAll();
  updateUI();

  // capture pointer so we continue even if we slip off a bit
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {}
}

function stepToIdx(idx) {
  if (!isDrawing) return;
  if (idx === lastIdx) return;

  // Backtracking: if user moves to previous cell in path, pop
  const prevIdx = activePath.length >= 2 ? activePath[activePath.length - 2] : null;
  if (prevIdx !== null && idx === prevIdx) {
    const removed = activePath.pop();
    if (!isEndpointIdx(removed, activeColor)) owner[removed] = null;
    lastIdx = idx;
    redrawAll();
    updateUI();
    return;
  }

  // Regular step forward
  if (!canStepInto(idx)) return;

  // If stepping into same-color owned cell that is earlier in the path, trim back
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

  // Commit path if it ends on that color's endpoint
  const ends = endpointCells.get(activeColor);
  const endIdx = activePath[activePath.length - 1];

  // Valid path must touch both endpoints (start & end)
  // (start is always an endpoint OR a path cell; we enforce endpoint requirement on completion)
  const startIdx = activePath[0];
  const touchesA = activePath.includes(ends.aIdx);
  const touchesB = activePath.includes(ends.bIdx);

  // Stronger rule: endpoints must be the ends of the path for clarity
  const isEndpointEnd =
    (endIdx === ends.aIdx || endIdx === ends.bIdx) &&
    (startIdx === ends.aIdx || startIdx === ends.bIdx);

  if (touchesA && touchesB && isEndpointEnd) {
    // Keep it
    commitActivePath();
  } else {
    // Not a valid connection: clear whatever user drew (except endpoints)
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
    for (const el of cellEls) el.classList.remove("active");
    return;
  }
  // highlight endpoints of active color
  const ends = endpointCells.get(activeColor);
  if (!ends) return;
  cellEls[ends.aIdx]?.classList.add("active");
  cellEls[ends.bIdx]?.classList.add("active");
}

// ---------- Buttons / level changes ----------
function loadLevel(i) {
  levelIndex = i;
  level = LEVELS[levelIndex];
  rebuildBoard();
}

resetBtn.addEventListener("click", () => {
  // reset keeps endpoints, clears paths for current level
  for (const c of level.colors) clearPath(c.id);
  owner.fill(null);
  redrawAll();
  updateUI();
});

clearBtn.addEventListener("click", () => {
  // clear all + wipe ownership
  for (const c of level.colors) clearPath(c.id);
  owner.fill(null);
  redrawAll();
  updateUI();
});

levelSelectEl.addEventListener("change", (e) => {
  const i = Number(e.target.value);
  loadLevel(i);
});


window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

// ---------- Init ----------
buildLevelSelect();
loadLevel(0);
