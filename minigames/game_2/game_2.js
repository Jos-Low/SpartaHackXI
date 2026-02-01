// Get elements
var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var winScreen = document.getElementById('winScreen');
var scoreDiv = document.getElementById('score');
var scoreValue = document.getElementById('scoreValue');
var winScore = document.getElementById('winScore');
var finalScoreEl = document.getElementById('finalScore');
var gameOverScreen = document.getElementById('gameOverScreen');

// Game variables
var gameRunning = false;
var score = 0;
var WIN_SCORE = 20;
var player = { 
  x: 165, 
  y: 450, 
  vy: 0, 
  width: 50, 
  height: 50, 
  facingRight: true,
  state: 'jumping',
  landingTimer: 0
};
var platforms = [];
var leftPressed = false;
var rightPressed = false;
var birdAnimFrame = 0;
var birdAnimTimer = 0;

// Mountain scrolling
var totalScrolled = 0;
var MOUNTAIN_STAY_DISTANCE = 0;
var mountainOffset = 0;

// Platform sizes
var CLOUD_WIDTH = 90;
var CLOUD_HEIGHT = 25;
var BIRD_WIDTH = 120;
var BIRD_HEIGHT = 96;

// Player animation settings
var LANDING_DURATION = 20;

// Images
var jumpImg = new Image();
var jumpImgLoaded = false;

var landImg = new Image();
var landImgLoaded = false;

var platformImg = new Image();
var platformLoaded = false;

var birdLeftSheet = new Image();
var birdLeftLoaded = false;

var birdRightSheet = new Image();
var birdRightLoaded = false;

var skyImg = new Image();
var skyLoaded = false;

var mountainImg = new Image();
var mountainLoaded = false;

var mountain2Img = new Image();
var mountain2Loaded = false;

// Load handlers
jumpImg.onload = function() { 
  jumpImgLoaded = true;
  console.log('Jump image loaded!', jumpImg.width, 'x', jumpImg.height);
};
jumpImg.onerror = function() {
  console.log('Jump image failed to load');
};

landImg.onload = function() { 
  landImgLoaded = true;
  console.log('Land image loaded!', landImg.width, 'x', landImg.height);
};
landImg.onerror = function() {
  console.log('Land image failed to load');
};

platformImg.onload = function() { 
  platformLoaded = true;
  var ratio = platformImg.height / platformImg.width;
  CLOUD_WIDTH = 90;
  CLOUD_HEIGHT = Math.round(90 * ratio);
  console.log('Cloud loaded:', CLOUD_WIDTH, 'x', CLOUD_HEIGHT);
};
platformImg.onerror = function() {
  console.log('Cloud failed to load');
};

birdLeftSheet.onload = function() { 
  birdLeftLoaded = true;
  console.log('Bird LEFT sprite sheet loaded!');
  var frameWidth = birdLeftSheet.width / 2;
  var frameHeight = birdLeftSheet.height;
  BIRD_WIDTH = 120;
  BIRD_HEIGHT = Math.round(BIRD_WIDTH * (frameHeight / frameWidth));
  console.log('  Display size:', BIRD_WIDTH, 'x', BIRD_HEIGHT);
};
birdLeftSheet.onerror = function() {
  console.log('Bird LEFT failed to load');
};

birdRightSheet.onload = function() { 
  birdRightLoaded = true;
  console.log('Bird RIGHT loaded!', birdRightSheet.width, 'x', birdRightSheet.height);
};
birdRightSheet.onerror = function() {
  console.log('Bird RIGHT failed to load');
};

skyImg.onload = function() { 
  skyLoaded = true;
  console.log('Sky loaded!');
  draw();
};
skyImg.onerror = function() {
  console.log('Sky failed to load');
};

mountainImg.onload = function() {
  mountainLoaded = true;
  console.log('Mountain 1 loaded!', mountainImg.width, 'x', mountainImg.height);
};
mountainImg.onerror = function() {
  console.log('Mountain 1 failed to load');
};

mountain2Img.onload = function() {
  mountain2Loaded = true;
  console.log('Mountain 2 loaded!', mountain2Img.width, 'x', mountain2Img.height);
};
mountain2Img.onerror = function() {
  console.log('Mountain 2 failed to load');
};

// Load images
var basePath = '';
try {
  basePath = chrome.runtime.getURL('assets/game_2/');
} catch (e) {
  basePath = '../assets/game_2/';
}

console.log('Loading images from:', basePath);
jumpImg.src = basePath + 'GAME_2_Jumping.png';
landImg.src = basePath + 'GAME_2_Landing.png';
platformImg.src = basePath + 'GAME_2_cloud_platform.png';
birdLeftSheet.src = basePath + 'GAME_2_bird_platform_LEFT_sprite.png';
birdRightSheet.src = basePath + 'GAME_2_bird_platform_RIGHT_sprite.png';
skyImg.src = basePath + 'GAME_2_SKY.png';
mountainImg.src = basePath + 'GAME_2_mountain_1.png';
mountain2Img.src = basePath + 'GAME_2_mountain_2.png';

function showWinScreen() {
  gameRunning = false;
  winScore.textContent = score;
  scoreDiv.classList.add('hidden');
  winScreen.classList.remove('hidden');
}

function handleDeath() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  scoreDiv.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// Keyboard
window.onkeydown = function(e) {
  var key = e.key;
  
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
    leftPressed = true;
    e.preventDefault();
  }
  if (key === 'ArrowRight' || key === 'd' || key === 'D') {
    rightPressed = true;
    e.preventDefault();
  }
};

window.onkeyup = function(e) {
  var key = e.key;
  
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
    leftPressed = false;
  }
  if (key === 'ArrowRight' || key === 'd' || key === 'D') {
    rightPressed = false;
  }
};

function startGame() {
  console.log('Starting game!');
  
  gameRunning = true;
  score = 0;
  totalScrolled = 0;
  mountainOffset = 0;
  
  player.x = 165;
  player.y = 450;
  player.vy = -12;
  player.facingRight = true;
  player.state = 'jumping';
  player.landingTimer = 0;
  
  leftPressed = false;
  rightPressed = false;
  birdAnimFrame = 0;
  birdAnimTimer = 0;
  
  platforms = [];
  platforms.push({ 
    x: 150, 
    y: 530, 
    width: CLOUD_WIDTH, 
    height: CLOUD_HEIGHT, 
    type: 'normal',
    vx: 0
  });
  
  var y = 430;
  while (y > -100) {
    var type = 'normal';
    if (Math.random() < 0.15) type = 'moving';
    
    var w = type === 'moving' ? BIRD_WIDTH : CLOUD_WIDTH;
    var h = type === 'moving' ? BIRD_HEIGHT : CLOUD_HEIGHT;
    
    platforms.push({
      x: Math.random() * (canvas.width - w),
      y: y,
      width: w,
      height: h,
      type: type,
      vx: type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0
    });
    y -= 100 + Math.random() * 40;
  }
  
  gameOverScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  scoreDiv.classList.remove('hidden');
  
  gameLoop();
}

function gameLoop() {
  if (!gameRunning) return;
  
  update();
  draw();
  
  requestAnimationFrame(gameLoop);
}

function update() {
  if (score >= WIN_SCORE) {
    showWinScreen();
    return;
  }
  
  birdAnimTimer++;
  if (birdAnimTimer >= 25) {
    birdAnimTimer = 0;
    birdAnimFrame = (birdAnimFrame + 1) % 2;
  }
  
  if (player.state === 'landing') {
    player.landingTimer--;
    if (player.landingTimer <= 0) {
      player.state = 'jumping';
    }
  }
  
  if (leftPressed) {
    player.x -= 7;
    player.facingRight = false;
  }
  if (rightPressed) {
    player.x += 7;
    player.facingRight = true;
  }
  
  if (player.x < -player.width) player.x = canvas.width;
  if (player.x > canvas.width) player.x = -player.width;
  
  var prevY = player.y;
  
  player.vy += 0.5;
  player.y += player.vy;
  
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    if (p.type === 'moving') {
      p.x += p.vx;
      if (p.x <= 0 || p.x + p.width >= canvas.width) {
        p.vx *= -1;
      }
    }
  }
  
  if (player.vy > 0) {
    var playerBottom = player.y + player.height;
    var prevPlayerBottom = prevY + player.height;
    var playerCenterX = player.x + player.width / 2;
    
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      var platformTop = p.y;
      
      if (prevPlayerBottom <= platformTop && playerBottom >= platformTop) {
        if (playerCenterX >= p.x && playerCenterX <= p.x + p.width) {
          player.y = platformTop - player.height;
          player.vy = -15;
          
          player.state = 'landing';
          player.landingTimer = LANDING_DURATION;
          
          break;
        }
      }
    }
  }
  
  if (player.y < 300) {
    var diff = 300 - player.y;
    player.y = 300;
    score += Math.floor(diff);
    totalScrolled += diff;
    
    if (totalScrolled > MOUNTAIN_STAY_DISTANCE) {
      mountainOffset += diff;
    }
    
    for (var i = 0; i < platforms.length; i++) {
      platforms[i].y += diff;
    }
    
    platforms = platforms.filter(function(p) { return p.y < 700; });
    
    while (platforms.length < 22) {
      var highestY = 0;
      for (var i = 0; i < platforms.length; i++) {
        if (platforms[i].y < highestY || highestY === 0) {
          highestY = platforms[i].y;
        }
      }
      
      var type = 'normal';
      if (score > 3000 && Math.random() < 0.35) type = 'moving';
      else if (score > 1500 && Math.random() < 0.25) type = 'moving';
      else if (score > 500 && Math.random() < 0.18) type = 'moving';
      else if (Math.random() < 0.12) type = 'moving';
      
      var w = type === 'moving' ? BIRD_WIDTH : CLOUD_WIDTH;
      var h = type === 'moving' ? BIRD_HEIGHT : CLOUD_HEIGHT;
      
      platforms.push({
        x: Math.random() * (400 - w),
        y: highestY - 100 - Math.random() * 40,
        width: w,
        height: h,
        type: type,
        vx: type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0
      });
    }
  }
  
  scoreValue.textContent = score;
  
  if (player.y > 650) {
    handleDeath();
  }
}

function draw() {
  if (skyLoaded) {
    var bgHeight = canvas.height;
    var bgWidth = canvas.width;
    var bgY = canvas.height - bgHeight;
    ctx.drawImage(skyImg, 0, bgY, bgWidth, bgHeight);
  } else {
    var gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#4a90d9');
    gradient.addColorStop(1, '#87CEEB');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 600);
  }
  
  drawMountains();
  
  var progress = Math.min(score / WIN_SCORE, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(50, 10, 300, 10);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(50, 10, 300 * progress, 10);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(50, 10, 300, 10);
  
  for (var i = 0; i < platforms.length; i++) {
    drawPlatform(platforms[i]);
  }
  
  drawPlayer();
}

function drawMountains() {
  var mountainWidth = canvas.width;

  if (mountain2Loaded) {
    var mountain2Height = (mountain2Img.height / mountain2Img.width) * mountainWidth;
    var mountain2Y = canvas.height - mountain2Height;
    ctx.drawImage(mountain2Img, 0, mountain2Y, mountainWidth, mountain2Height);
  }

  if (!mountainLoaded) return;

  var mountainHeight = (mountainImg.height / mountainImg.width) * mountainWidth;
  var baseY = canvas.height - mountainHeight;
  var maxScrollUp = Math.max(0, -baseY);
  var scrollUp = Math.min(totalScrolled, maxScrollUp);
  var drawY = baseY + scrollUp;

  ctx.drawImage(mountainImg, 0, drawY, mountainWidth, mountainHeight);

  if (scrollUp >= maxScrollUp && mountain2Loaded) {
    var mountain2Height = (mountain2Img.height / mountain2Img.width) * mountainWidth;
    var drawY2 = canvas.height - mountain2Height;
    ctx.drawImage(mountain2Img, 0, drawY2, mountainWidth, mountain2Height);
  }
}

function drawPlatform(p) {
  if (p.type === 'normal') {
    if (platformLoaded) {
      ctx.drawImage(platformImg, p.x, p.y, p.width, p.height);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(p.x + p.width/2, p.y + p.height/2, p.width/2, p.height/2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.type === 'moving') {
    var movingRight = p.vx > 0;
    var sheet = movingRight ? birdRightSheet : birdLeftSheet;
    var loaded = movingRight ? birdRightLoaded : birdLeftLoaded;
    
    if (loaded && sheet.width > 0 && sheet.height > 0) {
      var frameWidth = sheet.width / 2;
      var frameHeight = sheet.height;
      var sourceX = birdAnimFrame * frameWidth;
      
      ctx.drawImage(
        sheet,
        sourceX, 0, frameWidth, frameHeight,
        p.x, p.y, p.width, p.height
      );
    } else {
      ctx.fillStyle = '#6b8e9f';
      ctx.beginPath();
      ctx.ellipse(p.x + p.width/2, p.y + p.height/2, p.width/3, p.height/3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  ctx.save();
  
  var drawWidth = 70;
  var drawHeight = 70;
  var offsetX = (player.width - drawWidth) / 2;
  var offsetY = (player.height - drawHeight) / 2;
  
  var img = null;
  var imgLoaded = false;
  
  if (player.state === 'landing' && landImgLoaded) {
    img = landImg;
    imgLoaded = true;
  } else if (jumpImgLoaded) {
    img = jumpImg;
    imgLoaded = true;
  }
  
  if (imgLoaded && img) {
    if (!player.facingRight) {
      ctx.translate(player.x + offsetX + drawWidth, player.y + offsetY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
    } else {
      ctx.drawImage(img, player.x + offsetX, player.y + offsetY, drawWidth, drawHeight);
    }
  } else {
    var cx = player.x + player.width / 2;
    var cy = player.y + player.height / 2;
    
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 5, 4, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy - 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// Button handlers
document.getElementById('restartBtn').onclick = function() {
  gameOverScreen.classList.add('hidden');
  startGame();
};

document.getElementById('closeBtn').onclick = function() {
  window.close();
};

document.getElementById('continueBtn').onclick = function() {
  window.close();
};

// Auto-start
draw();
console.log('Game loaded! Starting...');
setTimeout(function() {
  startGame();
}, 500);