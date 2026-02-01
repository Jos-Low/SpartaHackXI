// gameConfig.js
// Single source of truth for level-based content.

export const GAME_CONFIG = {
  // If a level isn't explicitly listed, we clamp to last entry.
  levels: [
    {
      level: 1,
      characterIcon: "assets/character/Animated_Flower.png",
      xpToNext: 10,

      // when upgrading FROM level 1 TO 2, use this minigame
      // upgradeMinigame: "minigames/dino.html"
    },
    {
      level: 2,
      characterIcon: "assets/character/LVL_2_Animated_Flower.png",
      xpToNext: 100,
      // upgradeMinigame: "minigames/game_1/game_1.html"
    },
    {
      level: 3,
      characterIcon: "assets/character/LVL_3_Animated_Flower.png",
      xpToNext: 200,
      //upgradeMinigame: "minigames/game_2/game_2.html"
    },
    {
      level: 4,
      characterIcon: "assets/character/LVL_4_Animated_Flower.png",
      xpToNext: 300,
      upgradeMinigame: "minigames/game_3/game_3.html"
    },
    {
      level: 5,
      characterIcon: "assets/character/LVL_5_Animated_Flower.png",
      xpToNext: 400,
      upgradeMinigame: "minigames/game_4/game_4.html"
    },
    {
      level: 6,
      characterIcon: "assets/character/LVL_6_Animated_Flower.png",
      xpToNext: 500,
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
      upgradeMinigame: max.upgradeMinigame
    };
  }

  // below min level
  return arr[0];
}
