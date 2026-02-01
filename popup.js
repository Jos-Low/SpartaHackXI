const MAX_LEVEL = 6;

function render(state) {
  if (!state) return;

  const xp = Math.floor(state.xp ?? 0);
  const level = state.level ?? 1;
  const xpToNext = state.xpToNext ?? 100;

  const levelTextEl = document.getElementById("levelText");
  const xpTextEl = document.getElementById("xpText");
  const xpFillEl = document.getElementById("xpFill");
  const upgradeBtn = document.getElementById("upgrade");

  if (levelTextEl) levelTextEl.textContent = `Level ${level}`;

  const isMax = level >= MAX_LEVEL;

  // --- XP text + bar ---
  if (xpTextEl) {
    if (isMax) {
      xpTextEl.textContent = "XP: MAX";
    } else {
      xpTextEl.textContent = `XP: ${xp}/${xpToNext}`;
    }
  }

  if (xpFillEl) {
    if (isMax) {
      // show full bar OR hide it — pick your preference:
      xpFillEl.style.width = "100%";
      // If you prefer to hide it entirely, use:
      // xpFillEl.style.width = "0%";
      // xpFillEl.parentElement?.classList.add("hidden"); // if you have a wrapper
    } else {
      const pct = xpToNext > 0 ? Math.max(0, Math.min(100, (xp / xpToNext) * 100)) : 0;
      xpFillEl.style.width = `${pct}%`;
    }
  }

  // --- Upgrade button ---
  if (upgradeBtn) {
    if (isMax) {
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "Max Level";
    } else {
      const canUpgrade = !state.pendingUpgrade && xp >= xpToNext;
      upgradeBtn.disabled = !canUpgrade;
      upgradeBtn.textContent = state.pendingUpgrade ? "Upgrading..." : "Upgrade";
    }
  }
}


function load() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (res?.ok) render(res.state);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const openOptionsEl = document.getElementById("openOptions");
  if (openOptionsEl) {
    openOptionsEl.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
  
  // Reuse for maps button??
  
  const openBook = document.getElementById("openBookBtn");
  if (openBook) {
    openBook.addEventListener("click", (e) => {
      e.preventDefault();

      chrome.tabs.create({
        url: chrome.runtime.getURL("books/comic1.html"),
      });

      window.close();
    });
  }


  // const openMinigame3El = document.getElementById("openMinigame3");
  // if (openMinigame3El) {
  //   openMinigame3El.addEventListener("click", (e) => {
  //     e.preventDefault();

  //     chrome.tabs.create({
  //       url: chrome.runtime.getURL("minigames/game_3/game_3.html"),
  //     });

  //     window.close();
  //   });
  // }

  // const openMinigame2El = document.getElementById("openMinigame2");
  // if (openMinigame2El) {
  //   openMinigame2El.addEventListener("click", (e) => {
  //     e.preventDefault();

  //     chrome.tabs.create({
  //       url: chrome.runtime.getURL("minigames/game_2/game_2.html"),
  //     });

  //     window.close();
  //   });
  // }

  const openMinigame5El = document.getElementById("openMinigame5");
    if (openMinigame5El) {
      openMinigame5El.addEventListener("click", (e) => {
        e.preventDefault();

        chrome.tabs.create({
          url: chrome.runtime.getURL("minigames/game_5/game_5.html"),
        });

        window.close();
      });
    }



  // ✅ Upgrade button click handler
  const upgradeBtn = document.getElementById("upgrade");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (st) => {
        const level = st?.state?.level ?? 1;
        if (level >= MAX_LEVEL) return; // 🚫 do nothing at max

        // Optimistic UI
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = "Upgrading...";

        chrome.runtime.sendMessage({ type: "START_UPGRADE" }, (res) => {
          if (!res?.ok) {
            console.warn("START_UPGRADE failed:", res?.err);
            load();
            return;
          }

          if (res.upgradeMinigame) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(res.upgradeMinigame),
            });
            window.close();
          }
        });
      });
    });
  }


  document.getElementById('launch-game-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('minigames/game_1/game_1.html') });
  });

  const iconEl = document.getElementById("characterIcon");
  if (!iconEl) return;

  function updateCharacterIcon() {
    chrome.runtime.sendMessage({ type: "GET_CHARACTER_ICON" }, (res) => {
      if (!res?.ok || !res.icon) return;

      // res.icon should be like: "assets/character/LVL_2_Animated_Flower.png"
      iconEl.src = chrome.runtime.getURL(res.icon);
    });
  }

  // initial
  updateCharacterIcon();

  // optional: keep popup in sync if state changes while it's open
  chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "STATE_UPDATED") {
    render(msg.state);
    updateCharacterIcon();
  }
});

  document.getElementById("reset")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "RESET_STATE" }, (res) => {
      if (!res?.ok) {
        console.warn("RESET_STATE failed:", res?.err);
        load();
        return;
      }

      // If your sw.js returns the updated state, render it
      if (res.state) render(res.state);

      // Also update character icon (level 1)
      const iconEl = document.getElementById("characterIcon");
      if (iconEl && res.icon) {
        iconEl.src = chrome.runtime.getURL(res.icon);
      }
    });
  });
  load(); // call after DOM is ready
});