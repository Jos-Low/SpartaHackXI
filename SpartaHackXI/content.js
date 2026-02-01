(function () {
  // avoid duplicate injection
  if (document.getElementById("xp-buddy-container")) return;

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

  // ✅ UPDATED: Now accepts an optional level to query specifically
  function setCharacterIcon(level) {
    // Note: If level is undefined, the SW will default to the current info via GET_CHARACTER_ICON
    const message = level ? { type: "GET_CHARACTER_ICON_FOR_LEVEL", level: level } : { type: "GET_CHARACTER_ICON" };

    chrome.runtime.sendMessage(message, (res) => {
      if (!res?.ok || !res.icon) return;

      // res.icon is like "assets/LVL_2_Animated_Flower.png"
      if (res.icon === lastIconPath) return; // no change
      lastIconPath = res.icon;

      img.src = chrome.runtime.getURL(res.icon);
      console.log('[XP Buddy] Updated character icon to:', res.icon);
    });
  }

  function render(state) {
    const xp = Math.floor(state?.xp ?? 0);
    const level = state?.level ?? 1;
    const xpToNext = state?.xpToNext ?? 100;

    xpLabel.textContent = `Lvl ${level} • XP ${xp}/${xpToNext}`;

    // ✅ UPDATED: Pass the new level from the state update
    setCharacterIcon(level);
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
      console.log('[XP Buddy] State update received in content script:', msg.state);
      render(msg.state);
    }
  });
})();