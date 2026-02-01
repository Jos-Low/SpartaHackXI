/**
 * Game 5 — 3 Trashcans Whack-a-Critter (APNG swap model)
 *
 * Each lane is ONE image that swaps:
 * base -> up(APNG) -> peak(still) -> down(APNG) -> base
 * Damage animation swaps in on hit.
 */

/* ------------------ CONFIG ------------------ */
const ASSET_DIR = "../../assets/game_5/";

const BACKGROUND_SRC = "WHACK_A_SLOTH_BG.png";
const BASE_TRASHCAN_SRC = "trash_can.png";

const HEART_FULL_SRC = "Full_Heart.png";
const HEART_EMPTY_SRC = "Broken_Heart.png";

/* ------------------ CONFIG ------------------ */

// Put your real video path here.
// Example 1: in same folder as HTML: "win_cutscene.mp4"
// Example 2: elsewhere in assets: "../../assets/cutscenes/win_cutscene.mp4"
const WIN_VIDEO_SRC = "../../assets/game_5/final_vid.mp4";

// If you want the user to be able to skip:
const SHOW_SKIP_BUTTON_AFTER_MS = 800; // set 0 to show immediately, or null to never show


const CONFIG = {
  heartsMax: 3,

  // Spawning
  spawnEveryMin: 650,
  spawnEveryMax: 1050,

  upMs: 560,
  downMs: 560,

  peakHoldMin: 350,
  peakHoldMax: 900,

  hitShowMs: 420,

  playerSwingMs: 420,
  playerHurtMs: 420,

  slothDamage: 10,
  slothMaxHealth: 100,
};

/* --------------- ASSETS --------------- */
const ASSETS = {
  sloth: {
    up: "trash_can_with_sloth_GOING_UP.png",
    down: "trash_can_with_sloth_GOING_DOWN.png",
    peak: "trash_can_with_sloth_Image_AT_TOP.png",
    dmg: "trash_can_sloth_DAMAGE.png",
  },
  raccoon: {
    up: "trash_can_with_raccoon_GOING_UP.png",
    down: "trash_can_with_raccoon_GOING_DOWN.png",
    peak: "trash_can_with_raccoon_At_Top.png",
    dmg: "trash_can_with_raccoon_damage.png",
  },
  player: {
    idle: "Holding sword animation.png",
    swing: "Slashing_Sword_USE_THIS.png",
    hurt: "Holding_Sword_DAMAGE.png",
  },
};

const Phase = Object.freeze({
  NONE: "none",
  UP: "up",
  PEAK: "peak",
  DOWN: "down",
  HIT: "hit",
});

const Critter = Object.freeze({
  SLOTH: "sloth",
  RACCOON: "raccoon",
});

const Game = {
  running: false,
  score: CONFIG.slothMaxHealth,
  hearts: CONFIG.heartsMax,

  nextSpawnAt: 0,

  playerState: "idle",
  playerUntil: 0,

  cans: [],
};

/* ------------------ DOM ------------------ */
const els = {
  playfield: document.getElementById("playfield"),
  hearts: document.getElementById("hearts"),
  score: document.getElementById("score"),
  restartBtn: document.getElementById("restartBtn"),
  overlay: document.getElementById("overlay"),
  playerSprite: document.getElementById("playerSprite"),
  hpBar: document.getElementById("hpBar"),
  hpFill: document.getElementById("hpFill"),
  hpText: document.getElementById("hpText"),
  winScreen: document.getElementById("winScreen"),
  loseScreen: document.getElementById("loseScreen"),

    videoOverlay: document.getElementById("videoOverlay"),
  winVideo: document.getElementById("winVideo"),
  skipVideoBtn: document.getElementById("skipVideoBtn"),
};

/* ------------------ HELPERS ------------------ */
function fullPath(name) {
  if (!name) return "";
  return ASSET_DIR ? ASSET_DIR + name : name;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function playAnim(imgEl, src) {
  const s = fullPath(src);
  imgEl.src = "";
  imgEl.offsetHeight;
  imgEl.src = s;
}

function setStill(imgEl, src) {
  imgEl.src = fullPath(src);
}

function anyCanActive() {
  return Game.cans.some((c) => c.active);
}

function showVideoOverlay(on) {
  if (!els.videoOverlay) return;
  els.videoOverlay.classList.toggle("hidden", !on);
}

function stopWinVideo() {
  if (!els.winVideo) return;
  try {
    els.winVideo.pause();
    els.winVideo.currentTime = 0;
  } catch {}
  showVideoOverlay(false);
  if (els.skipVideoBtn) els.skipVideoBtn.classList.add("hidden");
}

async function playWinVideoThenShowWinScreen() {
  // If no video element exists, just fall back to win screen
  if (!els.winVideo || !els.videoOverlay) {
    els.winScreen.classList.remove("hidden");
    return;
  }

  // Hide win/lose screens while video plays
  els.winScreen.classList.add("hidden");
  els.loseScreen.classList.add("hidden");

  // Load video
  els.winVideo.src = WIN_VIDEO_SRC;
  els.winVideo.currentTime = 0;

  showVideoOverlay(true);

  // Optional skip button
  if (els.skipVideoBtn) {
    els.skipVideoBtn.classList.add("hidden");
    if (SHOW_SKIP_BUTTON_AFTER_MS !== null) {
      setTimeout(() => {
        // only show if still visible/playing
        if (!els.videoOverlay.classList.contains("hidden")) {
          els.skipVideoBtn.classList.remove("hidden");
        }
      }, Math.max(0, SHOW_SKIP_BUTTON_AFTER_MS));
    }
  }

  const finish = () => {
    // cleanup listeners safely
    els.winVideo.onended = null;
    els.winVideo.onerror = null;

    stopWinVideo();
    els.winScreen.classList.remove("hidden");
  };

  els.winVideo.onended = finish;
  els.winVideo.onerror = finish;

  // Try to play. (User just clicked to win, so autoplay should usually be allowed.)
  try {
    await els.winVideo.play();
  } catch (e) {
    // If autoplay is blocked, just show win screen.
    finish();
  }
}


/* ------------------ UI ------------------ */
function applyBackground() {
  if (BACKGROUND_SRC) {
    els.playfield.style.backgroundImage = `url("${fullPath(BACKGROUND_SRC)}")`;
  }
}

function buildHearts() {
  els.hearts.innerHTML = "";
  for (let i = 0; i < CONFIG.heartsMax; i++) {
    const img = document.createElement("img");
    img.className = "heart";
    img.alt = i === 0 ? "Health hearts" : "";
    img.draggable = false;
    img.dataset.idx = String(i);
    els.hearts.appendChild(img);
  }
  renderHearts();
}

function renderHearts() {
  const kids = [...els.hearts.querySelectorAll(".heart")];
  kids.forEach((img, i) => {
    img.src = fullPath(i < Game.hearts ? HEART_FULL_SRC : HEART_EMPTY_SRC);
  });
}

function renderScore() {
  const hp = clamp(Game.score, 0, CONFIG.slothMaxHealth);
  const max = CONFIG.slothMaxHealth;

  const pct = max > 0 ? (hp / max) * 100 : 0;

  if (els.hpFill) els.hpFill.style.width = `${pct}%`;
  if (els.hpText) els.hpText.textContent = `${hp} / ${max}`;

  if (els.hpBar) {
    els.hpBar.setAttribute("aria-valuenow", String(hp));
    els.hpBar.setAttribute("aria-valuemax", String(max));
  }
}

function showOverlay(on) {
  els.overlay.classList.toggle("hidden", !on);
}

/* ------------------ PLAYER ------------------ */
function setPlayer(state, now) {
  Game.playerState = state;

  if (state === "idle") {
    playAnim(els.playerSprite, ASSETS.player.idle);
    Game.playerUntil = 0;
    return;
  }
  if (state === "swing") {
    playAnim(els.playerSprite, ASSETS.player.swing);
    Game.playerUntil = now + CONFIG.playerSwingMs;
    return;
  }
  if (state === "hurt") {
    playAnim(els.playerSprite, ASSETS.player.hurt);
    Game.playerUntil = now + CONFIG.playerHurtMs;
    return;
  }
}

function swing(now) {
  if (Game.playerState === "hurt") return;
  setPlayer("swing", now);
}

function hurt(now) {
  setPlayer("hurt", now);
}

/* ------------------ CANS ------------------ */
function initCans() {
  const canEls = [
    document.getElementById("can0"),
    document.getElementById("can1"),
    document.getElementById("can2"),
  ];

  Game.cans = canEls.map((btn, idx) => {
    const img = btn.querySelector(".canImg");
    setStill(img, BASE_TRASHCAN_SRC);

    btn.addEventListener("click", () => onCanClick(idx));

    return {
      el: btn,
      img,

      active: false,
      critter: null,
      phase: Phase.NONE,

      phaseUntil: 0,
      peakUntil: 0,

      hittable: false,
    };
  });
}

function startSpawn(now) {
  const idx = randInt(0, 2);
  const can = Game.cans[idx];

  can.active = true;
  can.critter = Math.random() < 0.5 ? Critter.SLOTH : Critter.RACCOON;
  can.phase = Phase.UP;
  can.hittable = true;

  playAnim(can.img, ASSETS[can.critter].up);
  can.phaseUntil = now + CONFIG.upMs;
}

function beginPeak(can, now) {
  can.phase = Phase.PEAK;
  can.hittable = true;

  setStill(can.img, ASSETS[can.critter].peak);
  can.peakUntil = now + randInt(CONFIG.peakHoldMin, CONFIG.peakHoldMax);
}

function beginDown(can, now) {
  can.phase = Phase.DOWN;
  can.hittable = false;

  playAnim(can.img, ASSETS[can.critter].down);
  can.phaseUntil = now + CONFIG.downMs;
}

function beginHit(can, now) {
  can.phase = Phase.HIT;
  can.hittable = false;

  playAnim(can.img, ASSETS[can.critter].dmg);
  can.phaseUntil = now + CONFIG.hitShowMs;
}

function resetToBase(can) {
  can.active = false;
  can.critter = null;
  can.phase = Phase.NONE;
  can.phaseUntil = 0;
  can.peakUntil = 0;
  can.hittable = false;

  setStill(can.img, BASE_TRASHCAN_SRC);
}

/* ------------------ GAME RULES ------------------ */
function loseHeart(now) {
  if (!Game.running) return;

  Game.hearts = clamp(Game.hearts - 1, 0, CONFIG.heartsMax);
  renderHearts();
  hurt(now);

  if (Game.hearts <= 0) endGame(false);
}

function endGame(won) {
  Game.running = false;
  showOverlay(false);

  Game.cans.forEach(resetToBase);

  if (won) {
    // NEW: play the win video first, then show win screen
    playWinVideoThenShowWinScreen();
  } else {
    stopWinVideo(); // just in case
    els.loseScreen.classList.remove("hidden");
  }
}


function restart() {
  const now = performance.now();
  stopWinVideo();
  Game.running = true;
  Game.score = CONFIG.slothMaxHealth;
  Game.hearts = CONFIG.heartsMax;

  renderScore();
  renderHearts();
  showOverlay(false);
  els.winScreen.classList.add('hidden');
  els.loseScreen.classList.add('hidden');

  setPlayer("idle", now);

  Game.cans.forEach(resetToBase);

  Game.nextSpawnAt = now + randInt(CONFIG.spawnEveryMin, CONFIG.spawnEveryMax);
}

/* ------------------ INPUT ------------------ */
function onCanClick(idx) {
  if (!Game.running) return;

  const now = performance.now();
  const can = Game.cans[idx];
  if (!can.active) return;

  if (!can.hittable) return;

  swing(now);

  if (can.critter === Critter.RACCOON) {
    beginHit(can, now);
    loseHeart(now);
    return;
  }

  if (can.critter === Critter.SLOTH) {
    beginHit(can, now);

    Game.score = clamp(
        Game.score - CONFIG.slothDamage,
        0,
        CONFIG.slothMaxHealth
    );
    renderScore();
    if (Game.score <= 0) {
        endGame(true); // won!
    }
    return;
  }
}

/* ------------------ LOOP ------------------ */
function loop() {
  const now = performance.now();

  if (Game.running) {
    if (!anyCanActive() && now >= Game.nextSpawnAt) {
      startSpawn(now);
    }

    if (Game.playerState !== "idle" && Game.playerUntil && now >= Game.playerUntil) {
      setPlayer("idle", now);
    }

    for (const can of Game.cans) {
      if (!can.active) continue;

      if (can.phase === Phase.UP && now >= can.phaseUntil) {
        beginPeak(can, now);
      }

      if (can.phase === Phase.PEAK && now >= can.peakUntil) {
        beginDown(can, now);
      }

      if (can.phase === Phase.DOWN && now >= can.phaseUntil) {
        const wasSloth = can.critter === Critter.SLOTH;
        resetToBase(can);

        Game.nextSpawnAt = now + randInt(CONFIG.spawnEveryMin, CONFIG.spawnEveryMax);

        if (wasSloth) loseHeart(now);
      }

      if (can.phase === Phase.HIT && now >= can.phaseUntil) {
        resetToBase(can);
        Game.nextSpawnAt = now + randInt(CONFIG.spawnEveryMin, CONFIG.spawnEveryMax);
      }
    }
  }

  requestAnimationFrame(loop);
}

/* ------------------ BOOT ------------------ */
function boot() {
  applyBackground();
  buildHearts();
  initCans();

  els.restartBtn.addEventListener("click", restart);

  // Win/Lose buttons
  document.getElementById('playAgainWin').onclick = restart;
  document.getElementById('closeWinBtn').onclick = () => window.close();
  document.getElementById('tryAgainBtn').onclick = restart;
  document.getElementById('closeLoseBtn').onclick = () => window.close();

  setPlayer("idle", performance.now());
  restart();
  requestAnimationFrame(loop);

  if (els.skipVideoBtn) {
  els.skipVideoBtn.onclick = () => {
    // End video early and show win screen
    stopWinVideo();
    els.winScreen.classList.remove("hidden");
  };
}
}

boot();