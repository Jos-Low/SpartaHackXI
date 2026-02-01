import { getLevelDef } from "../../gameConfig.js";

/**
 * We open this page with ?fromLevel=#
 * That means: the minigame being introduced is the one used when upgrading FROM that level.
 * Example: fromLevel=2 -> show the video/instructions for the Level 2 -> 3 upgrade minigame.
 */
function getFromLevel() {
  const p = new URLSearchParams(location.search);
  const n = Number(p.get("fromLevel"));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function setList(ul, bullets = []) {
  ul.innerHTML = "";
  for (const b of bullets) {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  }
}

function showHowTo(def) {
  const overlay = document.getElementById("overlay");
  const title = document.getElementById("howTitle");
  const list = document.getElementById("howList");

  const how = def?.upgradeHowTo ?? { title: "How to play", bullets: [] };
  title.textContent = how.title || "How to play";
  setList(list, how.bullets || []);

  overlay.classList.remove("hidden");
}

function startMinigame(def) {
  const path = def?.upgradeMinigame;
  if (!path) {
    // If missing, just close or do nothing
    window.close();
    return;
  }

  // Navigate within the same window/tab
  // Using runtime URL makes it robust even if folder depth changes
  const url = chrome.runtime.getURL(path);
  location.replace(url);
}

async function main() {
  const fromLevel = getFromLevel();
  const def = getLevelDef(fromLevel);

  const videoEl = document.getElementById("introVideo");
  const skipBtn = document.getElementById("skipBtn");
  const okBtn = document.getElementById("okBtn");

  const videoPath = def?.upgradeIntroVideo;

  // If no video configured, go straight to instructions.
  if (!videoPath) {
    showHowTo(def);
  } else {
    videoEl.src = chrome.runtime.getURL(videoPath);
    videoEl.controls = false;

    // Autoplay can fail sometimes; we still proceed to how-to on user interaction.
    try {
      await videoEl.play();
    } catch {
      // If autoplay blocked, show controls so the user can start it
      videoEl.controls = true;
    }

    videoEl.addEventListener("ended", () => showHowTo(def), { once: true });
  }

  skipBtn.addEventListener("click", () => showHowTo(def));

  okBtn.addEventListener("click", () => startMinigame(def));
}

main();
