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
  if (xpTextEl) xpTextEl.textContent = `XP: ${xp}/${xpToNext}`;

  if (xpFillEl) {
    const pct = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
    xpFillEl.style.width = `${pct}%`;
  }

  if (upgradeBtn) {
    const canUpgrade = !state.pendingUpgrade && xp >= xpToNext;
    upgradeBtn.disabled = !canUpgrade;
    upgradeBtn.textContent = state.pendingUpgrade ? "Upgrading..." : "Upgrade";
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

  // ✅ Upgrade button click handler
  const upgradeBtn = document.getElementById("upgrade");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", () => {
      // Optimistic UI (optional, but feels responsive)
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "Upgrading...";

      chrome.runtime.sendMessage({ type: "START_UPGRADE" }, (res) => {
        if (!res?.ok) {
          console.warn("START_UPGRADE failed:", res?.err);

          // Re-render from canonical state to restore correct UI
          load();
          return;
        }

        // If success: background will broadcast STATE_UPDATED and render() will run.
        // No need to do anything else here.
      });
    });
  }

  document.getElementById("reset")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "RESET_STATE" }, (res) => {
    console.log("reset:", res);
    });
  });


  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATED") render(msg.state);
  });

  load(); // call after DOM is ready
});