// options.js

function linesToList(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(list) {
  return (list || []).join("\n");
}

function showStatus(text) {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = text;
  status.classList.add("show");
}

function hideStatusSoon(ms = 1500) {
  const status = document.getElementById("status");
  if (!status) return;
  setTimeout(() => status.classList.remove("show"), ms);
}

let saveTimeout = null;

document.addEventListener("DOMContentLoaded", () => {
  const goodEl = document.getElementById("goodSites");
  const badEl = document.getElementById("badSites");
  const backBtn = document.getElementById("backBtn");

  if (!goodEl || !badEl) {
    console.error("[Options] Missing textarea elements.");
    return;
  }

  // Load settings from service worker (source of truth)
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
    if (!res?.ok) {
      console.error("[Options] GET_SETTINGS failed:", chrome.runtime.lastError);
      return;
    }

    const s = res.settings || {};

    // IMPORTANT: do NOT fall back to defaults based on .length
    // Empty arrays should stay empty if the user saved them that way.
    const goodSites = Array.isArray(s.goodSites) ? s.goodSites : [];
    const badSites = Array.isArray(s.badSites) ? s.badSites : [];

    goodEl.value = listToLines(goodSites);
    badEl.value = listToLines(badSites);
  });

  function autoSave() {
    clearTimeout(saveTimeout);
    showStatus("⏳ Saving...");

    saveTimeout = setTimeout(() => {
      const goodSites = linesToList(goodEl.value);
      const badSites = linesToList(badEl.value);

      chrome.runtime.sendMessage(
        { type: "SET_SETTINGS", settingsPatch: { goodSites, badSites } },
        (res) => {
          if (!res?.ok) {
            console.error("[Options] SET_SETTINGS failed:", chrome.runtime.lastError, res);
            showStatus("⚠️ Save failed (see console)");
            hideStatusSoon(2500);
            return;
          }

          showStatus("✓ Changes saved automatically");
          hideStatusSoon(1500);
        }
      );
    }, 600);
  }

  goodEl.addEventListener("input", autoSave);
  badEl.addEventListener("input", autoSave);

  if (backBtn) backBtn.addEventListener("click", () => window.close());
});
