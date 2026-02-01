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

// Load settings on page load
chrome.storage.sync.get(['goodSites', 'badSites'], (data) => {
  // If no saved data, use defaults
  const goodSites = data.goodSites && data.goodSites.length > 0 
    ? data.goodSites 
    : DEFAULT_GOOD_SITES;
  
  const badSites = data.badSites && data.badSites.length > 0 
    ? data.badSites 
    : DEFAULT_BAD_SITES;
  
  document.getElementById('goodSites').value = goodSites.join('\n');
  document.getElementById('badSites').value = badSites.join('\n');
  
  // Save defaults if this is first time
  if (!data.goodSites || data.goodSites.length === 0) {
    chrome.storage.sync.set({
      goodSites: DEFAULT_GOOD_SITES,
      badSites: DEFAULT_BAD_SITES
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
    
    chrome.storage.sync.set({
      goodSites: goodSites,
      badSites: badSites
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

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  window.close();
});