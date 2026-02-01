// comicNav.js
(() => {
  // Get comic number from filename, e.g. "comic2.html" -> 2
  const file = location.pathname.split("/").pop() || "";
  const match = file.match(/comic(\d+)\.html$/i);
  const comicNum = match ? parseInt(match[1], 10) : NaN;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const playBtn = document.getElementById("playBtn");

  // ---- Navigation between comics ----
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (!Number.isFinite(comicNum)) return;
      const prev = Math.max(1, comicNum - 1);
      window.location.href = `comic${prev}.html`;
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!Number.isFinite(comicNum)) return;
      const next = comicNum + 1; // if you want a max cap, add it here
      window.location.href = `comic${next}.html`;
    });
  }

  // ---- Launch the matching minigame ----
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (!Number.isFinite(comicNum)) {
        alert("Couldn't detect comic number from filename.");
        return;
      }

      // ✅ Your required mapping:
      // comic2 -> ../minigames/game_2/game_2.html
      // comic1 -> ../minigames/game_1/game_1.html
      const gamePath = `../minigames/game_${comicNum}/game_${comicNum}.html`;

      // If this is an extension page, this is safest:
      const url = chrome?.runtime?.getURL
        ? chrome.runtime.getURL(gamePath.replace(/^\.\.\//, "")) // convert to extension-root path
        : gamePath; // fallback if not in extension context

      window.open(url, "_blank");
    });
  }
})();
