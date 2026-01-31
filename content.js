(function () {
  // avoid duplicate injection
  if (document.getElementById("xp-buddy-character")) return;

  const img = document.createElement("img");
  img.id = "xp-buddy-character";
  img.src = chrome.runtime.getURL("assets/character.png");
  img.alt = "XP Buddy";

  const bubble = document.createElement("div");
  bubble.id = "xp-buddy-bubble";
  bubble.textContent = "XP Buddy ready!";

  document.documentElement.appendChild(img);
  document.documentElement.appendChild(bubble);

  let hideTimer = null;
  function showBubble(text) {
    bubble.textContent = text;
    bubble.style.display = "block";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (bubble.style.display = "none"), 2500);
  }

  // Update bubble occasionally based on XP (optional)
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
    if (res?.ok) {
      const { xp, level, xpToNext } = res.state;
      showBubble(`Level ${level} • XP ${Math.floor(xp)}/${xpToNext}`);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATED" && msg.state) {
      const { xp, level, xpToNext } = msg.state;
      showBubble(`Level ${level} • XP ${Math.floor(xp)}/${xpToNext}`);
    }
  });
})();
