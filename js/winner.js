import { activeEntries, activePlayers } from "./room.js";

export function buildFinishedUpdate(players) {
  const active = activePlayers(players);
  const entry = activeEntries(players)[0];
  if (active.length !== 1 || !entry) return null;

  return {
    players,
    status: "finished",
    roundStatus: "finished",
    winner: active[0].nickname,
    winnerPlayerId: entry[0]
  };
}

export function renderWinner(roomData, players) {
  const area = document.getElementById("winnerArea");
  const active = activePlayers(players);

  if (roomData.status === "finished" && active.length === 1) {
    area.style.display = "block";
    document.getElementById("finalWinner").innerText =
      `🏆 ${roomData.winner || active[0].nickname} 最後留下！`;
  } else {
    area.style.display = "none";
  }
}
