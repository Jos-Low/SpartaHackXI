// gameConfig.js
// Single source of truth for level-based content.

export const GAME_CONFIG = {
  // If a level isn't explicitly listed, we clamp to last entry.
  levels: [
    {
      level: 1,
      characterIcon: "assets/character/Animated_Flower.png",
      xpToNext: 10,

      upgradeMinigame: "minigames/game_1/game_1.html",
      upgradeIntroVideo: "assets/videos/CutSceneOne.mp4",
      upgradeHowTo: {
        title: "How to play: Flower Run",
        bullets: [
          "Press space to jump over the flowers,",
          "But be careful to not jump into the butterflies...",
          "Use the SPACE key to jump."
        ]
      }
    },
    {
      level: 2,
      characterIcon: "assets/character/LVL_2_Animated_Flower.png",
      xpToNext: 100,

      // when upgrading FROM level 2 TO 3, use this minigame
      // (your actual file is game2.html, NOT game_2.html)

      upgradeMinigame: "minigames/game_2/game_2.html",
      upgradeIntroVideo: "assets/videos/CutScene2.mp4",
      upgradeHowTo: {
        title: "How to play: Cloud Jump",
        bullets: [
          "You can't stop jumping!",
          "Make sure to land on clouds to not fall to your death...",
          "Move using the 'A' and 'D' keys."
        ]
      }
    },
    {
      level: 3,
      characterIcon: "assets/character/LVL_3_Animated_Flower.png",
      xpToNext: 200,
      upgradeMinigame: "minigames/game_3/game_3.html",
      upgradeIntroVideo: "assets/videos/CutScene3.mp4",
      upgradeHowTo: {
        title: "How to play: Wire Match",
        bullets: [
          "Connect the same colored dots to eachother.",
          "Make sure that you fill up every empty space!",
          "Drag lines using your mouse and left click.",
          "Complete 3 challenges and pass the test."
        ]
      }
    },
    {
      level: 4,
      characterIcon: "assets/character/LVL_4_Animated_Flower.png",
      xpToNext: 300,
      upgradeMinigame: "minigames/game_4/game_4.html",
      upgradeIntroVideo: "assets/videos/CutScene4.mp4",
      upgradeHowTo: {
        title: "How to play: Memory",
        bullets: [
          "The cards will be shown for a short time,",
          "Pay attention before they flip over..",
          "Click on the corresponding images to get them all up.",
          "But be careful, 3 wrong guesses and it's all over..."
        ]
      }
    },
    {
      level: 5,
      characterIcon: "assets/character/LVL_5_Animated_Flower.png",
      xpToNext: 400,
      upgradeMinigame: "minigames/game_5/game_5.html",
      upgradeIntroVideo: "assets/videos/CutScene5.mp4",
      upgradeHowTo: {
        title: "How to play: Dumpster Diving",
        bullets: [
          "WARNING: DO NOT HARM THE RACCOONS",
          "Hit the evil sloth to wear out his health.",
          "Get him 10 times to scare him out of the trash.",
          "Make sure that you get him before he hides!"
        ]
      }
    },
    {
      level: 6,
      characterIcon: "assets/character/LVL_6_Animated_Flower.png",
      xpToNext: 500
      // upgradeMinigame: "minigames/game_5/game_5.html"
    }
  ],

  // fallback if you outgrow config
  defaultXpToNext: (level) => 100 + level * 100
};

export function getLevelDef(level) {
  const arr = GAME_CONFIG.levels;

  // exact match
  const exact = arr.find((x) => x.level === level);
  if (exact) return exact;

  // clamp to last configured level (easy for MVP)
  const max = arr[arr.length - 1];
  if (level > max.level) {
    return {
      level,
      characterIcon: max.characterIcon,
      xpToNext: GAME_CONFIG.defaultXpToNext(level),
      upgradeMinigame: max.upgradeMinigame,
      upgradeIntroVideo: max.upgradeIntroVideo,
      upgradeHowTo: max.upgradeHowTo
    };
  }

  // below min level
  return arr[0];
}
