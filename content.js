(function () {
  // avoid duplicate injection
  if (document.getElementById("xp-buddy-container")) return;

  const MAX_LEVEL = 6;

  // container
  const container = document.createElement("div");
  container.id = "xp-buddy-container";

  // character
  const img = document.createElement("img");
  img.id = "xp-buddy-character";
  img.alt = "XP Buddy";

  // xp label
  const xpLabel = document.createElement("div");
  xpLabel.id = "xp-buddy-xp";
  xpLabel.textContent = "Loading XP...";

  container.appendChild(img);
  container.appendChild(xpLabel);

  // attach to page
  document.documentElement.appendChild(container);

  // Track last icon to avoid unnecessary DOM updates
  let lastIconPath = null;

  function setCharacterIconFromSW() {
    chrome.runtime.sendMessage({ type: "GET_CHARACTER_ICON" }, (res) => {
      if (!res?.ok || !res.icon) return;

      // res.icon is like "assets/LVL_2_Animated_Flower.png"
      if (res.icon === lastIconPath) return; // no change
      lastIconPath = res.icon;

      img.src = chrome.runtime.getURL(res.icon);
    });
  }

  function render(state) {
    const xp = Math.floor(state?.xp ?? 0);
    const level = state?.level ?? 1;
    const xpToNext = state?.xpToNext ?? 100;

    const isMax = level >= MAX_LEVEL;

    if (isMax) {
      xpLabel.textContent = `Lvl ${level} • XP MAX`;
    } else {
      xpLabel.textContent = `Lvl ${level} • XP ${xp}/${xpToNext}`;
    }

    // ✅ Always pull icon from SW (single source of truth)
    setCharacterIconFromSW();
  }


  // initial load
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (res?.ok) {
      render(res.state);
    } else {
      xpLabel.textContent = "XP unavailable";
    }
  });

  // ✅ live updates (A.1): service worker broadcasts to tabs -> content script re-renders immediately
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "STATE_UPDATED" && msg.state) {
      render(msg.state);
    }
  });
})();
