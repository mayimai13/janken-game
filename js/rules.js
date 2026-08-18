export const GROUP_NAMES = {
  rock: "✊ 石頭組",
  scissors: "✌️ 剪刀組",
  paper: "🖐️ 布組"
};

export function modeLabel(mode) {
  if (mode === "winner") return "🏆 贏的人晉級";
  if (mode === "loser") return "😈 輸的人晉級";
  return "尚未選擇";
}

export function getWinningChoice(choices) {
  if (choices.includes("rock") && choices.includes("scissors")) return "rock";
  if (choices.includes("scissors") && choices.includes("paper")) return "scissors";
  return "paper";
}

export function getLosingChoice(choices) {
  if (choices.includes("rock") && choices.includes("scissors")) return "scissors";
  if (choices.includes("scissors") && choices.includes("paper")) return "paper";
  return "rock";
}

export function applyElimination(players, mode, filterFn = () => true) {
  const participants = Object.entries(players).filter(
    ([, p]) => p.status === "active" && p.ready && filterFn(p)
  );

  const choices = [...new Set(participants.map(([, p]) => p.choice))];

  // 全同拳或三種都有：平手，不淘汰
  if (choices.length !== 2) {
    return { changed: false, tie: true, participants };
  }

  const survivorChoice =
    mode === "loser" ? getLosingChoice(choices) : getWinningChoice(choices);

  participants.forEach(([id, p]) => {
    if (p.choice !== survivorChoice) {
      players[id] = {
        ...p,
        status: "spectator",
        eliminatedReason: mode === "loser" ? "猜拳獲勝" : "猜拳落敗"
      };
    }
  });

  return { changed: true, tie: false, survivorChoice, participants };
}
