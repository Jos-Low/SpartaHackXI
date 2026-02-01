# 🦕 Slacker - Chrome Extension Game

**SpartaHack XI Project**  
*Where your browsing habits become your adventure*

## 🌸 Overview

Slacker is a unique Chrome Extension that gamifies your browsing experience. Transform your productivity into progress as you level up your character through a compelling storyline across 5 mini-games. Visit productive sites to gain XP, avoid distractions, and watch your character grow!

---

## 🎮 Features

### ✅ Core Features
- **Smart XP System**: Earn XP based on time spent on productive websites
- **Penalty System**: Lose XP when visiting distracting "bad" sites
- **Level Progression**: Level up your character with visual growth
- **Story-Driven**: 5 unique mini-games tied to an unfolding storyline
- **Progress Tracking**: Real-time XP progress bar and level display

### ⚙️ Customization
- **Customizable Categories**: Define your own productive/distracting sites in Options
- **Flexible Settings**: Adjust what counts as "good" or "bad" for your workflow

### 🕹️ Game Mechanics
- **Active Tracking**: Only counts time when browser is focused and user is active
- **Level-Up Rewards**: Each level unlocks a new mini-game segment
- **Visual Progression**: Character sprite evolves with each level

---

## 🧠 How It Works

### 📊 XP System
Your XP changes based on:
- **Site Category**: Good / Bad / Neutral
- **Time Spent**: Minutes actively spent on site
- **Activity Status**: Only counts when browser is focused and user is active

### ⬆️ Leveling Up
1. Earn XP through productive browsing
2. When XP reaches the threshold, click **Upgrade** in the popup
3. Level increases + character sprite updates
4. **NEW**: Extension launches the level-up mini-game for that level!

### 🎮 Mini-Games & Storyline
Each level unlocks a new chapter in the story:

| Level | Unlocks | Mini-Game |
|-------|---------|-----------|
| 1 → 2 | Chapter 1 | `minigames/game_1/game_1.html` |
| 2 → 3 | Chapter 2 | `minigames/game_2/game_2.html` |
| 3 → 4 | Chapter 3 | `minigames/game_3/game_3.html` |
| 4 → 5 | Chapter 4 | `minigames/game_4/game_4.html` |
| 5 → 6 | Chapter 5 | `minigames/game_5/game_5.html` |

*Each level also updates your character's appearance visually!*

---

## 🧱 Tech Stack

- **JavaScript** (Vanilla)
- **HTML and CSS**
- **Chrome Extensions API** (Manifest V3)
- **Service Worker** for background processing
- **Chrome APIs Used**:
  - `chrome.tabs` - Tab tracking
  - `chrome.storage` - Data persistence
  - `chrome.idle` - User activity detection
  - `chrome.runtime` - Extension communication

---

## 📦 Installation (Local Development)

### Clone & Setup
1. **Clone this repository**:
   ```bash
   git clone https://github.com/Jos-Low/SpartaHackXI.git
   cd SpartaHackXI
2. Open Chrome Extensions:
  -  Navigate to: chrome://extensions/

3. Enable Developer Mode:
  -  Toggle the switch in the top-right corner

4. Load the extension:
  -  Click "Load unpacked"
  -  Select the project folder

5. Start playing! 🎉
