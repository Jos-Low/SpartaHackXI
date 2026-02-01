'use strict';

// ============================================
// CANVAS SETUP
// ============================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ============================================
// LOAD ASSETS
// ============================================
const assets = {
  sky: new Image(),
  trees: new Image(),
  ground: new Image(),
  flowerSprite: new Image(),
  obstacleSprite: new Image(),
  butterflySprite: new Image()
};

// Asset paths (adjust if needed for Chrome extension)
const getAssetPath = (filename) => {
  return chrome.runtime.getURL(`assets/game_1/${filename}`);
};

assets.sky.src = getAssetPath('GAME_1_SKY.png');
assets.trees.src = getAssetPath('GAME_1_TREES.png');
assets.ground.src = getAssetPath('GAME_1_GROUND.png');
assets.flowerSprite.src = getAssetPath('game1_flower_animation.png');
assets.obstacleSprite.src = getAssetPath('game1_obstacle_animation.png');
assets.butterflySprite.src = getAssetPath('game1_butterfly_animation.png');

// DEBUG: Log all asset paths
setTimeout(() => {
  console.log('=== ASSET PATHS ===');
  console.log('Flower:', assets.flowerSprite.src);
  console.log('Obstacle:', assets.obstacleSprite.src);
  console.log('Butterfly:', assets.butterflySprite.src);
  console.log('Assets loaded:', assetsLoaded, '/', totalAssets);
}, 1000);

let assetsLoaded = 0;
const totalAssets = 6;

Object.values(assets).forEach(img => {
  img.onload = () => {
    assetsLoaded++;
    console.log(`Asset loaded: ${assetsLoaded}/${totalAssets}`);
  };
});

// ============================================
// GAME CONSTANTS
// ============================================
const GROUND_Y = H - 140; // Ground starts at y=400
const MAX_SCORE = 250;
const GRAVITY = 0.7;
const JUMP_POWER = -15;

// Sprite animation config
const SPRITE_CONFIG = {
  flower: { frameWidth: 444.5, frameHeight: 480, frames: 2 },      // 889/2 = 444.5
  obstacle: { frameWidth: 491, frameHeight: 480, frames: 2 },      // 982/2 = 491
  butterfly: { frameWidth: 455, frameHeight: 479, frames: 2 }      // 910/2 = 455
};

// ============================================
// GAME STATE
// ============================================
let gameState = {
  score: 0,
  best: 0,
  speed: 7,
  gameOver: false,
  started: false,
  gameWon: false,
  animFrame: 0
};

let player = null;
let obstacles = [];
let butterflies = [];
let particles = [];

// Parallax background offsets
let bgOffsets = {
  sky: 0,
  trees: 0,
  ground: 0
};

// ============================================
// SPRITE ANIMATION HELPER
// ============================================
function drawSprite(spriteImg, config, x, y, animFrame, scale = 0.2) {
  // Check if image is loaded
  if (!spriteImg.complete || spriteImg.naturalWidth === 0) {
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(x - 20, y - 20, 40, 40);
    return;
  }
  
  const frame = Math.floor(animFrame / 15) % config.frames;
  const sx = frame * config.frameWidth;
  
  // Scale down the massive sprites
  const drawWidth = config.frameWidth * scale;
  const drawHeight = config.frameHeight * scale;
  
  ctx.drawImage(
    spriteImg,
    sx, 0, config.frameWidth, config.frameHeight,
    x - drawWidth / 2, y - drawHeight / 2,
    drawWidth, drawHeight
  );
}

// ============================================
// PLAYER
// ============================================
function createPlayer() {
  return {
    x: 150,
    y: GROUND_Y,
    vy: 0,
    grounded: true,
    width: 100,   
    height: 100  
  };
}

function updatePlayer() {
  if (!player.grounded) {
    player.vy += GRAVITY;
  }
  
  player.y += player.vy;
  
  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.grounded = true;
  }
}

function drawPlayer() {
  if (assetsLoaded < totalAssets) return;
  
  // Shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(player.x, GROUND_Y + 5, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Draw sprite
  drawSprite(assets.flowerSprite, SPRITE_CONFIG.flower, player.x, player.y - 15, gameState.animFrame, 0.2);
}

function jump() {
  if (gameState.gameOver || gameState.gameWon) {
    restart();
    return;
  }
  
  if (!gameState.started) {
    gameState.started = true;
    document.getElementById('overlay').classList.add('hidden');
  }
  
  if (player.grounded) {
    player.vy = JUMP_POWER;
    player.grounded = false;
    spawnParticles(player.x, player.y + 20);
  }
}

// ============================================
// OBSTACLES
// ============================================
function createObstacle() {
  return {
    x: W + 50,
    y: GROUND_Y,
    width: 80,   
    height: 80,    
    passed: false
  };
}

function updateObstacles() {
  // Spawn obstacles
  if (
    obstacles.length === 0 ||
    obstacles[obstacles.length - 1].x < W - 300
  ) {
    if (Math.random() < 0.02) {
      obstacles.push(createObstacle());
    }
  }

  // Move obstacles — SAME SPEED AS BUTTERFLIES
  obstacles.forEach(obs => {
    obs.x -= gameState.speed;
  });

  // Remove off-screen obstacles
  obstacles = obstacles.filter(obs => obs.x > -80);
}


function drawObstacles() {
  if (assetsLoaded < totalAssets) return;
  
  obstacles.forEach(obs => {
    // Shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(obs.x, GROUND_Y + 5, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Draw sprite LOWER (changed from -40 to -15)
    drawSprite(assets.obstacleSprite, SPRITE_CONFIG.obstacle, obs.x, obs.y - 15, gameState.animFrame, 0.18);
  });
}

// ============================================
// BUTTERFLIES
// ============================================
function createButterfly() {
  return {
    x: W + 50,
    y: GROUND_Y - 120 - Math.random() * 50,
    width: 100,  
    height: 50,   
    passed: false
  };
}

function updateButterflies() {
  // Spawn butterflies — HARD SAFE SEPARATION
  if (
    butterflies.length === 0 ||
    butterflies[butterflies.length - 1].x < W - 600
  ) {
    if (Math.random() < 0.008) {
      const spawnX = W + 50;
      let canSpawn = true;

      const SAFE_GAP = 600; // guaranteed fair

      for (let obs of obstacles) {
        if (Math.abs(spawnX - obs.x) < SAFE_GAP) {
          canSpawn = false;
          break;
        }
      }

      if (canSpawn) {
        butterflies.push(createButterfly());
      }
    }
  }

  // Move butterflies — SAME SPEED AS OBSTACLES
  butterflies.forEach(butterfly => {
    butterfly.x -= gameState.speed;

    // Gentle vertical motion stays
    butterfly.y += Math.sin(
      gameState.animFrame * 0.1 + butterfly.x * 0.01
    ) * 0.5;
  });

  // Remove off-screen butterflies
  butterflies = butterflies.filter(b => b.x > -80);
}

function drawButterflies() {
  if (assetsLoaded < totalAssets) return;
  
  butterflies.forEach(butterfly => {
    // Draw scaled sprite
    drawSprite(assets.butterflySprite, SPRITE_CONFIG.butterfly, butterfly.x, butterfly.y, gameState.animFrame, 0.15);
  });
}

// ============================================
// COLLISION DETECTION
// ============================================
function checkCollisions() {
  const px = player.x;
  const py = player.y;
  // TIGHTER HITBOXES (changed from 0.6 to 0.4)
  const pw = player.width * 0.4;
  const ph = player.height * 0.4;
  
  // Check obstacle collisions
  for (let obs of obstacles) {
    // Tighter obstacle hitbox too
    if (px + pw/2 > obs.x - obs.width*0.35 && 
        px - pw/2 < obs.x + obs.width*0.35 &&
        py + ph/2 > obs.y - obs.height*0.35 &&
        py - ph/2 < obs.y + obs.height*0.35) {
      endGame();
      return;
    }
  }
  
  // Check butterfly collisions
  for (let butterfly of butterflies) {
    // Tighter butterfly hitbox
    if (px + pw/2 > butterfly.x - butterfly.width*0.35 && 
        px - pw/2 < butterfly.x + butterfly.width*0.35 &&
        py - ph/2 < butterfly.y + butterfly.height*0.35 &&
        py + ph/2 > butterfly.y - butterfly.height*0.35) {
      endGame();
      return;
    }
  }
}

// ============================================
// PARTICLES
// ============================================
function spawnParticles(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 3 - 1,
      life: 1,
      size: Math.random() * 3 + 2,
      color: ['#b8e8d8', '#a8d8c8', '#f4e67d', '#e8a857'][Math.floor(Math.random() * 4)]
    });
  }
}

function updateParticles() {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life -= 0.02;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}

// ============================================
// BACKGROUND DRAWING (PARALLAX)
// ============================================
function drawBackground() {
  if (assetsLoaded < totalAssets) {
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  
  // Sky layer - FILL ENTIRE CANVAS
  const skyOffset = bgOffsets.sky % W;
  ctx.drawImage(assets.sky, -skyOffset, 0, W, H);
  ctx.drawImage(assets.sky, W - skyOffset, 0, W, H);
  
  // Trees layer
  const treesHeight = 250;
  const treesY = GROUND_Y - treesHeight + 10;
  const treesOffset = bgOffsets.trees % W;
  ctx.drawImage(assets.trees, -treesOffset, treesY, W, treesHeight);
  ctx.drawImage(assets.trees, W - treesOffset, treesY, W, treesHeight);
  
  // Ground layer - SIMPLE FIX
  const groundHeight = 200; // Just make it taller
  const groundOffset = bgOffsets.ground % W;
  ctx.drawImage(assets.ground, -groundOffset, GROUND_Y - 10, W, groundHeight);
  ctx.drawImage(assets.ground, W - groundOffset, GROUND_Y - 10, W, groundHeight);
}

function updateBackground() {
  bgOffsets.sky = (bgOffsets.sky + gameState.speed * 0.2) % W;
  bgOffsets.trees = (bgOffsets.trees + gameState.speed * 0.5) % W;
  bgOffsets.ground = (bgOffsets.ground + gameState.speed) % W;
}

// ============================================
// UI UPDATES
// ============================================
function updateUI() {
  document.getElementById('scoreVal').textContent = Math.floor(gameState.score);
  document.getElementById('bestVal').textContent = Math.floor(gameState.best);
  
  const progress = Math.min(gameState.score / MAX_SCORE, 1) * 100;
  document.getElementById('progress-bar').style.width = progress + '%';
  document.getElementById('progress-text').textContent = `${Math.floor(gameState.score)} / ${MAX_SCORE}`;
  
  // Change progress bar color based on progress
  const progressBar = document.getElementById('progress-bar');
  if (progress < 33) {
    progressBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
  } else if (progress < 66) {
    progressBar.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
  } else {
    progressBar.style.background = 'linear-gradient(90deg, #f87171, #dc2626)';
  }
}

// ============================================
// GAME LOOP
// ============================================
function update() {
  if (gameState.gameOver || !gameState.started || gameState.gameWon) return;
  
  gameState.animFrame++;
  gameState.score += 0.1;
  gameState.speed = 7 + gameState.score * 0.015;
  
  // Win condition
  if (gameState.score >= MAX_SCORE) {
    winGame();
    return;
  }
  
  updatePlayer();
  updateObstacles();
  updateButterflies();
  updateParticles();
  updateBackground();
  checkCollisions();
  updateUI();
}

function draw() {
  drawBackground();
  drawObstacles();
  drawButterflies();
  drawPlayer();
  drawParticles();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================
function winGame() {
  gameState.gameWon = true;
  if (gameState.score > gameState.best) gameState.best = gameState.score;
  
  document.getElementById('overlay-title').textContent = '✨ VICTORY! ✨';
  document.getElementById('overlay-subtitle').textContent = 'You completed the game!';
  document.getElementById('final-score').textContent = `SCORE: ${Math.floor(gameState.score)}`;
  document.getElementById('final-score').style.display = 'block';
  document.getElementById('start-btn').textContent = 'PLAY AGAIN';
  document.getElementById('overlay').classList.remove('hidden');
}

function endGame() {
  gameState.gameOver = true;
  if (gameState.score > gameState.best) gameState.best = gameState.score;
  
  document.getElementById('overlay-title').textContent = '💀 GAME OVER';
  document.getElementById('overlay-subtitle').textContent = 'Try again!';
  document.getElementById('final-score').textContent = `SCORE: ${Math.floor(gameState.score)}`;
  document.getElementById('final-score').style.display = 'block';
  document.getElementById('start-btn').textContent = 'PLAY AGAIN';
  document.getElementById('overlay').classList.remove('hidden');
}

function restart() {
  gameState = {
    score: 0,
    speed: 7,
    gameOver: false,
    started: true,
    gameWon: false,
    animFrame: 0,
    best: gameState.best // Keep best score
  };
  
  player = createPlayer();
  obstacles = [];
  butterflies = [];
  particles = [];
  bgOffsets = { sky: 0, trees: 0, ground: 0 };
  
  document.getElementById('overlay-title').textContent = '🌸 FLOWER JUMP';
  document.getElementById('overlay-subtitle').textContent = 'Avoid obstacles and butterflies!';
  document.getElementById('final-score').style.display = 'none';
  document.getElementById('start-btn').textContent = 'START GAME';
  document.getElementById('overlay').classList.add('hidden');
}

// ============================================
// INPUT HANDLERS
// ============================================
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    jump();
  }
});

canvas.addEventListener('click', jump);

document.getElementById('start-btn').addEventListener('click', (e) => {
  e.preventDefault();
  jump();
});

// ============================================
// INITIALIZE
// ============================================
player = createPlayer();
gameLoop();