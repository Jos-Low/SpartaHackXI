function linesToList(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(list) {
  return (list || []).join("\n");
}

async function load() {
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
    if (!res?.ok) return;

    const s = res.settings;
    document.getElementById("goodSites").value = listToLines(s.goodSites);
    document.getElementById("badSites").value = listToLines(s.badSites);
    
    // users select values of xp awarded
    //document.getElementById("xpGood").value = s.xpPerMinuteGood ?? 10;
    //document.getElementById("xpBad").value = s.xpPerMinuteBad ?? 15;
  });
}

async function save() {
  const status = document.getElementById("status");
  status.textContent = "Saving...";

  const patch = {
    goodSites: linesToList(document.getElementById("goodSites").value),
    badSites: linesToList(document.getElementById("badSites").value),
    
    // users select values of xp awarded
    //xpPerMinuteGood: Number(document.getElementById("xpGood").value || 0),
    //xpPerMinuteBad: Number(document.getElementById("xpBad").value || 0)
  };

  chrome.runtime.sendMessage({ type: "SET_SETTINGS", settingsPatch: patch }, (res) => {
    status.textContent = res?.ok ? "Saved ✅" : `Error: ${res?.err || "unknown"}`;
    setTimeout(() => (status.textContent = ""), 2000);
  });
}

document.getElementById("save").addEventListener("click", save);
load();
