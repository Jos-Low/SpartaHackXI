function render(state) {
  const xp = Math.floor(state.xp || 0);
  const level = state.level || 1;
  const xpToNext = state.xpToNext || 100;

  document.getElementById("levelText").textContent = `Level ${level}`;
  document.getElementById("xpText").textContent = `XP: ${xp}/${xpToNext}`;

  const pct = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
  document.getElementById("xpFill").style.width = `${pct}%`;

  // Change character sprite based on level
  const characterIcon = document.getElementById("characterIcon");
  if (characterIcon) {
    if (level >= 3) {
      characterIcon.src = "assets/LVL_2_Animated_Flower.png";
    } else if (level >= 2) {
      characterIcon.src = "assets/LVL_1_Animated_Flower.png";
    } else {
      characterIcon.src = "assets/Animated_Flower.png";
    }
  }
}

function load() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (res?.ok) render(res.state);
  });
}

// Open the options/settings page
document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Listen for live state updates from the service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATE_UPDATED") render(msg.state);
});

load();