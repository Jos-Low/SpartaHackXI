// Default websites
const DEFAULT_GOOD_SITES = [
  'wikipedia.org',
  'docs.google.com',
  'github.com',
  'stackoverflow.com',
  'w3schools.com',
  'khanacademy.org',
  'leetcode.com',
];

const DEFAULT_BAD_SITES = [
  'x.com',
  'reddit.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'netflix.com',
  'twitch.tv',
];

// ✅ Add default XP rates
const DEFAULT_XP_GOOD = 15;
const DEFAULT_XP_BAD = 10;

// Load settings on page load
chrome.storage.sync.get(['goodSites', 'badSites', 'xpPerMinuteGood', 'xpPerMinuteBad'], (data) => {
  // If no saved data, use defaults
  const goodSites = data.goodSites && data.goodSites.length > 0 
    ? data.goodSites 
    : DEFAULT_GOOD_SITES;
  
  const badSites = data.badSites && data.badSites.length > 0 
    ? data.badSites 
    : DEFAULT_BAD_SITES;
  
  // ✅ Load XP rates
  const xpGood = data.xpPerMinuteGood ?? DEFAULT_XP_GOOD;
  const xpBad = data.xpPerMinuteBad ?? DEFAULT_XP_BAD;
  
  document.getElementById('goodSites').value = goodSites.join('\n');
  document.getElementById('badSites').value = badSites.join('\n');
  document.getElementById('xpGood').value = xpGood;
  document.getElementById('xpBad').value = xpBad;
  
  // Save defaults if this is first time
  if (!data.goodSites || data.goodSites.length === 0) {
    chrome.storage.sync.set({
      goodSites: DEFAULT_GOOD_SITES,
      badSites: DEFAULT_BAD_SITES,
      xpPerMinuteGood: DEFAULT_XP_GOOD,
      xpPerMinuteBad: DEFAULT_XP_BAD
    });
  }
});

// Auto-save function with debounce
let saveTimeout;
function autoSave() {
  clearTimeout(saveTimeout);
  
  // Show saving status
  const status = document.getElementById('status');
  status.textContent = '⏳ Saving...';
  status.classList.add('show');
  
  saveTimeout = setTimeout(() => {
    const goodSites = document.getElementById('goodSites').value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s);
    
    const badSites = document.getElementById('badSites').value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s);
    
    // ✅ Get XP rates from inputs
    const xpGood = parseInt(document.getElementById('xpGood').value) || DEFAULT_XP_GOOD;
    const xpBad = parseInt(document.getElementById('xpBad').value) || DEFAULT_XP_BAD;
    
    chrome.storage.sync.set({
      goodSites: goodSites,
      badSites: badSites,
      xpPerMinuteGood: xpGood,
      xpPerMinuteBad: xpBad
    }, () => {
      status.textContent = '✓ Changes saved automatically';
      setTimeout(() => {
        status.classList.remove('show');
      }, 2000);
    });
  }, 1000); // Wait 1 second after user stops typing
}

// Add auto-save listeners
document.getElementById('goodSites').addEventListener('input', autoSave);
document.getElementById('badSites').addEventListener('input', autoSave);
document.getElementById('xpGood').addEventListener('input', autoSave); // ✅ New
document.getElementById('xpBad').addEventListener('input', autoSave);  // ✅ New

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  window.close();
});