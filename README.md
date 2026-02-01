🌸 Slacker (SpartaHack XI)

Slacker is a Chrome Extension game where your browsing habits turn into progress.
Visit productive sites to gain XP over time, avoid distracting sites (or lose XP), and level up your character through a storyline told across 5 mini-games.

🎮 Features

✅ Earn XP based on time spent on websites

⚠️ Lose XP on “bad” sites

🌱 Level up your character

🧠 5 mini-games tied to a storyline

📈 XP progress bar + level display in popup

⚙️ Customizable site categories in Options page

🕹️ How It Works
XP System

Your XP changes based on:

What site you’re on (good / bad / neutral)

How long you stay on it

Only counts time when:

the browser window is focused

the user is not idle

Leveling Up

When your XP reaches the required amount:

Click Upgrade in the popup

Your level increases

The extension launches the level-up mini-game for that level

Mini-games are configured in gameConfig.js.

🧩 Mini-Games + Storyline

There are 5 mini-games, each tied to a level-up milestone:

Level Up	Mini-game
1 → 2	minigames/game_1/game_1.html
2 → 3	minigames/game_2/game_2.html
3 → 4	minigames/game_3/game_3.html
4 → 5	minigames/game_4/game_4.html
5 → 6	minigames/game_5/game_5.html

Each level also updates the character sprite so you can visually see progress.

🧱 Tech Stack

JavaScript

Chrome Extensions Manifest V3

Background logic via Service Worker

Chrome APIs:

chrome.tabs

chrome.storage

chrome.idle

📦 Installation (Local Development)

Clone this repo:

git clone https://github.com/Jos-Low/SpartaHackXI.git


Open Chrome and go to:

chrome://extensions


Enable Developer Mode

Click Load unpacked

Select the project folder

⚙️ Configuration
Good / Bad Sites

You can configure which sites give XP or remove XP through the Options page.

Good sites → gain XP/minute

Bad sites → lose XP/minute

Neutral sites → no XP change

🗂️ Project Structure (Important Files)

manifest.json — Chrome extension setup + permissions

sw.js — background service worker (XP tracking, sessions, leveling)

popup.html / popup.js — popup UI (level, XP bar, upgrade button)

gameConfig.js — level config, XP requirements, mini-game unlocks

minigames/ — all mini-games + storyline content

assets/ — character sprites and art

🧠 Gameplay Tips

Add school/work sites to Good Sites

Add distractions to Bad Sites

Keep Chrome focused and stay active to earn XP

When XP is full, hit Upgrade to unlock the next story segment

🚀 Future Improvements

More mini-games and branching story choices

Better balancing for XP rates

Achievements + daily streak system

Map / world screen showing progress through the story

Sound effects + animations

👥 Team / Credits

Built for SpartaHack XI as a productivity + game hybrid Chrome extension.
