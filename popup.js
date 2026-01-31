function render(state) {
  const xp = Math.floor(state.xp || 0);
  const level = state.level || 1;
  const xpToNext = state.xpToNext || 100;

  document.getElementById("levelText").textContent = `Level ${level}`;
  document.getElementById("xpText").textContent = `XP: ${xp}/${xpToNext}`;

  const pct = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
  document.getElementById("xpFill").style.width = `${pct}%`;
}

function load() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (res?.ok) render(res.state);
  });
}

document.getElementById("reset").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET_XP" }, (res) => {
    if (res?.ok) load();
  });
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATE_UPDATED") render(msg.state);
});

load();
