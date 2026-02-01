// minigames/game.js
// Canvas-based memory game with flip animation, 3 lives, and easy custom images.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  status: document.getElementById("status"),
  lives: document.getElementById("lives"),
  matches: document.getElementById("matches"),
  totalPairs: document.getElementById("totalPairs"),
  restart: document.getElementById("restart"),
};

const winScreen = document.getElementById("winScreen");
const loseScreen = document.getElementById("loseScreen");

// ------------------------
// Customization
// ------------------------

const GRID_COLS = 4;
const GRID_ROWS = 3;

const START_LIVES = 3;
const PREVIEW_MS = 5000;
const BETWEEN_FLIPS_MS = 400;

const CARD_RADIUS = 14;
const CARD_GAP = 14;
const CARD_BACK_COLOR = "rgba(255,255,255,0.10)";
const CARD_BACK_BORDER = "rgba(255,255,255,0.18)";
const CARD_FACE_BORDER = "rgba(255,255,255,0.22)";

const FACE_IMAGE_PATHS = [
  "../../assets/game_4/GAME_4_baby_sloth.png",
  "../../assets/game_4/GAME_4_chad_sloth.png",
  "../../assets/game_4/GAME_4_clown_sloth.png",
  "../../assets/game_4/GAME_4_evil_sloth.png",
  "../../assets/game_4/GAME_4_flower_sloth.png",
  "../../assets/game_4/GAME_4_sleep_sloth.png",
];
const BACK_IMAGE_PATH = "../../assets/game_4/GAME_4_CARD_BACK.png";

const HEART_FULL_PATH  = "../../assets/game_4/Full_Heart.png";
const HEART_EMPTY_PATH = "../../assets/game_4/Broken_Heart.png";

const BG_IMAGE_PATH = "../../assets/game_4/GAME_4_BG.png";
let bgImg = null;

const ALLOW_PLACEHOLDER_FACES = false;

// ------------------------
// Helpers
// ------------------------

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitRectKeepAspect(srcW, srcH, dstX, dstY, dstW, dstH) {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  let w, h, x, y;
  if (srcAspect > dstAspect) {
    w = dstW;
    h = w / srcAspect;
    x = dstX;
    y = dstY + (dstH - h) / 2;
  } else {
    h = dstH;
    w = h * srcAspect;
    x = dstX + (dstW - w) / 2;
    y = dstY;
  }
  return { x, y, w, h };
}

function assetUrl(relPath) {
  return new URL(relPath, import.meta.url).href;
}

function renderHearts() {
  const heartsEl = document.getElementById("hearts");
  if (!heartsEl) return;

  heartsEl.innerHTML = "";

  for (let i = 0; i < START_LIVES; i++) {
    const img = document.createElement("img");
    img.className = "heart";
    img.alt = i < lives ? "Full heart" : "Empty heart";
    img.src = assetUrl(i < lives ? HEART_FULL_PATH : HEART_EMPTY_PATH);
    heartsEl.appendChild(img);
  }
}

// ------------------------
// Assets
// ------------------------

async function loadImages(paths) {
  const imgs = [];
  for (const p of paths) {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    const prom = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${p}`));
    });
    img.src = p;
    imgs.push(prom);
  }
  return Promise.all(imgs);
}

function makePlaceholderCanvas(seed, w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");

  const hue = (seed * 47) % 360;
  g.fillStyle = `hsl(${hue} 70% 45%)`;
  g.fillRect(0, 0, w, h);

  g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath();
  g.arc(w * 0.55, h * 0.45, w * 0.32, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "rgba(0,0,0,0.35)";
  g.font = "700 78px ui-sans-serif, system-ui, -apple-system";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(seed + 1), w / 2, h / 2);

  return c;
}

// ------------------------
// Game State
// ------------------------

const totalCards = GRID_COLS * GRID_ROWS;
if (totalCards % 2 !== 0) {
  throw new Error("Grid must have an even number of cards.");
}
const totalPairs = totalCards / 2;

ui.totalPairs.textContent = String(totalPairs);

let faces = [];
let backImg = null;

class Card {
  constructor(id, faceIndex) {
    this.id = id;
    this.faceIndex = faceIndex;

    this.x = 0; this.y = 0; this.w = 0; this.h = 0;

    this.state = "faceUp";
    this.anim = 1;
    this.targetAnim = 1;

    this.locked = false;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  flipUp() {
    if (this.state === "matched") return;
    this.state = "faceUp";
    this.targetAnim = 1;
    this.locked = true;
  }

  flipDown() {
    if (this.state === "matched") return;
    this.state = "faceDown";
    this.targetAnim = 0;
    this.locked = true;
  }

  setMatched() {
    this.state = "matched";
    this.targetAnim = 1;
    this.anim = 1;
    this.locked = false;
  }

  update(dt) {
    const speed = 10;
    const diff = this.targetAnim - this.anim;
    if (Math.abs(diff) < 0.001) {
      this.anim = this.targetAnim;
      this.locked = false;
      return;
    }
    this.anim += diff * (1 - Math.exp(-speed * dt));
  }

  draw(ctx) {
    const t = this.anim;
    const flip = Math.abs(t - 0.5) * 2;

    ctx.save();

    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    ctx.translate(cx, cy);
    ctx.scale(clamp(flip, 0.05, 1), 1);
    ctx.translate(-cx, -cy);

    const showFace = t >= 0.5;

    roundRectPath(ctx, this.x, this.y, this.w, this.h, CARD_RADIUS);

    if (!showFace) {
      const pad = 0;
      if (backImg) {
        ctx.save();
        roundRectPath(
          ctx,
          this.x + pad,
          this.y + pad,
          this.w - pad * 2,
          this.h - pad * 2,
          12
        );
        ctx.clip();

        const rect = fitRectKeepAspect(
          backImg.width ?? backImg.naturalWidth ?? 256,
          backImg.height ?? backImg.naturalHeight ?? 256,
          this.x + pad,
          this.y + pad,
          this.w - pad * 2,
          this.h - pad * 2
        );

        ctx.drawImage(backImg, rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      } else {
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        const step = 18;
        for (let y = this.y - this.h; y < this.y + this.h * 2; y += step) {
          ctx.fillRect(this.x - this.w, y, this.w * 3, 6);
        }
        ctx.restore();
      }
    } else {
      const pad = 0;
      const img = faces[this.faceIndex];

      ctx.save();
      roundRectPath(ctx, this.x + pad, this.y + pad, this.w - pad * 2, this.h - pad * 2, 12);
      ctx.clip();

      const rect = fitRectKeepAspect(
        img.width ?? img.naturalWidth ?? 256,
        img.height ?? img.naturalHeight ?? 256,
        this.x + pad,
        this.y + pad,
        this.w - pad * 2,
        this.h - pad * 2
      );

      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();

      if (this.state === "matched") {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        roundRectPath(ctx, this.x, this.y, this.w, this.h, CARD_RADIUS);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

let cards = [];
let lives = START_LIVES;
let matchedPairs = 0;

let inputEnabled = false;
let firstPick = null;
let secondPick = null;
let resolving = false;

function setStatus(text) {
  ui.status.textContent = text;
}

function setLives(n) {
  lives = n;
  if (ui.lives) ui.lives.textContent = String(lives);
  renderHearts();
}

function setMatches(n) {
  matchedPairs = n;
  ui.matches.textContent = String(matchedPairs);
}

function layoutCards() {
  const margin = 0;
  const usableW = canvas.width - margin * 2;
  const usableH = canvas.height - margin * 2;

  const totalGapW = CARD_GAP * (GRID_COLS - 1);
  const totalGapH = CARD_GAP * (GRID_ROWS - 1);

  const cardW = (usableW - totalGapW) / GRID_COLS;
  const cardH = (usableH - totalGapH) / GRID_ROWS;

  for (let i = 0; i < cards.length; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);

    cards[i].x = margin + col * (cardW + CARD_GAP);
    cards[i].y = margin + row * (cardH + CARD_GAP);
    cards[i].w = cardW;
    cards[i].h = cardH;
  }
}

function buildDeck() {
  const faceIndexes = [];
  for (let i = 0; i < totalPairs; i++) {
    faceIndexes.push(i, i);
  }
  shuffle(faceIndexes);

  cards = [];
  for (let i = 0; i < totalCards; i++) {
    cards.push(new Card(i, faceIndexes[i]));
  }
  layoutCards();
}

function resetGame() {
  winScreen.classList.add('hidden');
  loseScreen.classList.add('hidden');
  
  setLives(START_LIVES);
  setMatches(0);
  firstPick = null;
  secondPick = null;
  resolving = false;
  inputEnabled = false;

  buildDeck();

  for (const c of cards) {
    c.state = "faceUp";
    c.anim = 1;
    c.targetAnim = 1;
    c.locked = false;
  }

  setStatus("Memorize the cards…");

  setTimeout(() => {
    for (const c of cards) c.flipDown();
    setStatus("Pick two cards!");
    setTimeout(() => {
      inputEnabled = true;
    }, BETWEEN_FLIPS_MS);
  }, PREVIEW_MS);
}

function cardAtPoint(px, py) {
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].contains(px, py)) return cards[i];
  }
  return null;
}

function canSelect(card) {
  if (!card) return false;
  if (!inputEnabled) return false;
  if (resolving) return false;
  if (card.locked) return false;
  if (card.state === "matched") return false;
  if (card === firstPick) return false;
  if (card.state === "faceUp") return false;
  return true;
}

async function resolveTurn() {
  if (!firstPick || !secondPick) return;

  resolving = true;
  inputEnabled = false;

  await new Promise((r) => setTimeout(r, 450));

  const a = firstPick;
  const b = secondPick;

  if (a.faceIndex === b.faceIndex) {
    a.setMatched();
    b.setMatched();
    setMatches(matchedPairs + 1);
    setStatus("Match!");

    if (matchedPairs + 1 >= totalPairs) {
      setStatus("You win! 🎉");
      winScreen.classList.remove('hidden');
    }
  } else {
    a.flipDown();
    b.flipDown();
    setLives(lives - 1);
    setStatus("Nope — lose 1 life.");

    if (lives - 1 <= 0) {
      setStatus("Game over!");
      loseScreen.classList.remove('hidden');
    }
  }

  firstPick = null;
  secondPick = null;

  await new Promise((r) => setTimeout(r, 300));

  resolving = false;
  inputEnabled = lives > 0 && matchedPairs < totalPairs;
  if (inputEnabled) setStatus("Pick two cards!");
}

function handleClick(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const px = (evt.clientX - rect.left) * scaleX;
  const py = (evt.clientY - rect.top) * scaleY;

  const card = cardAtPoint(px, py);
  if (!canSelect(card)) return;

  card.flipUp();

  if (!firstPick) {
    firstPick = card;
  } else if (!secondPick) {
    secondPick = card;
    resolveTurn();
  }
}

// ------------------------
// Main loop
// ------------------------

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  for (const c of cards) c.update(dt);

  draw();
  requestAnimationFrame(loop);
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bgImg) {
    const srcW = bgImg.width ?? bgImg.naturalWidth ?? canvas.width;
    const srcH = bgImg.height ?? bgImg.naturalHeight ?? canvas.height;
    const srcAspect = srcW / srcH;
    const dstAspect = canvas.width / canvas.height;

    let drawW, drawH, drawX, drawY;
    if (srcAspect > dstAspect) {
      drawH = canvas.height;
      drawW = drawH * srcAspect;
      drawX = (canvas.width - drawW) / 2;
      drawY = 0;
    } else {
      drawW = canvas.width;
      drawH = drawW / srcAspect;
      drawX = 0;
      drawY = (canvas.height - drawH) / 2;
    }

    ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const grd = ctx.createRadialGradient(
      canvas.width * 0.35, canvas.height * 0.25, 80,
      canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.9
    );
    grd.addColorStop(0, "rgba(255,255,255,0.06)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5, canvas.height * 0.45, 120,
    canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.85
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  drawBackground();
  for (const c of cards) c.draw(ctx);
}

// ------------------------
// Init
// ------------------------

async function init() {
  if (FACE_IMAGE_PATHS.length < totalPairs && !ALLOW_PLACEHOLDER_FACES) {
    throw new Error(
      `Need at least ${totalPairs} unique images in FACE_IMAGE_PATHS, or set ALLOW_PLACEHOLDER_FACES=true`
    );
  }

  let loaded = [];
  try {
    const needed = FACE_IMAGE_PATHS.slice(0, totalPairs);
    loaded = await loadImages(needed);
  } catch (e) {
    if (!ALLOW_PLACEHOLDER_FACES) throw e;
    loaded = [];
  }

  try {
    [backImg] = await loadImages([BACK_IMAGE_PATH]);
  } catch (e) {
    console.error(e);
    backImg = null;
  }

  try {
    [bgImg] = await loadImages([BG_IMAGE_PATH]);
  } catch (e) {
    console.error(e);
    bgImg = null;
  }

  if (loaded.length === totalPairs) {
    faces = loaded;
  } else {
    faces = Array.from({ length: totalPairs }, (_, i) => makePlaceholderCanvas(i));
  }

  ui.restart.addEventListener("click", resetGame);
  canvas.addEventListener("click", handleClick);

  // Win/Lose buttons
  document.getElementById('playAgainWin').onclick = resetGame;
  document.getElementById('closeWinBtn').onclick = () => window.close();
  document.getElementById('tryAgainBtn').onclick = resetGame;
  document.getElementById('closeLoseBtn').onclick = () => window.close();

  renderHearts();

  resetGame();
  requestAnimationFrame(loop);
}

init();