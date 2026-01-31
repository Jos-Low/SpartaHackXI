(function () {
  // avoid duplicate injection
  if (document.getElementById("xp-buddy-container")) return;

  // container
  const container = document.createElement("div");
  container.id = "xp-buddy-container";

  // character
  const img = document.createElement("img");
  img.id = "xp-buddy-character";
  img.src = chrome.runtime.getURL("assets/character.png");
  img.alt = "XP Buddy";

  // xp label
  const xpLabel = document.createElement("div");
  xpLabel.id = "xp-buddy-xp";
  xpLabel.textContent = "Loading XP...";

  container.appendChild(img);
  container.appendChild(xpLabel);

  // attach to page
  document.documentElement.appendChild(container);

  function render(state) {
    const xp = Math.floor(state?.xp ?? 0);
    const level = state?.level ?? 1;
    const xpToNext = state?.xpToNext ?? 100;

    xpLabel.textContent = `Lvl ${level} • XP ${xp}/${xpToNext}`;
  }

  // initial load
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (res?.ok) render(res.state);
    else xpLabel.textContent = "XP unavailable";
  });

  // live updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATED" && msg.state) {
      render(msg.state);
    }
  });
})();
