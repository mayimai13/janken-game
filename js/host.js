import { activePlayers, transactRoom } from "./room.js";
import { modeLabel } from "./rules.js";

export function renderHostControls({ roomData, isHost }) {
  if (!isHost) return;

  const closeBtn = document.getElementById("closeJoinBtn");
  const modePanel = document.getElementById("modePanel");
  const startBtn = document.getElementById("startRoundBtn");
  const endBtn = document.getElementById("endRoundBtn");
  const nextBtn = document.getElementById("nextRoundBtn");
  const winnerModeBtn = document.getElementById("winnerModeBtn");
  const loserModeBtn = document.getElementById("loserModeBtn");

  startBtn.style.display = "none";
  endBtn.style.display = "none";
  nextBtn.style.display = "none";
  modePanel.style.display = "none";

  closeBtn.disabled = roomData.joinOpen === false || roomData.status === "finished";
  closeBtn.innerText = roomData.joinOpen === false ? "🔒 已停止加入" : "🔒 結束加入";

  winnerModeBtn.classList.toggle("selected", roomData.tournamentMode === "winner");
  loserModeBtn.classList.toggle("selected", roomData.tournamentMode === "loser");

  if (roomData.status === "finished" || roomData.stage === "group") return;
  if (roomData.joinOpen !== false) return;

  if (roomData.round === 1 && roomData.roundStatus === "waiting" && !roomData.tournamentModeLocked) {
    modePanel.style.display = "block";
  }

  if (roomData.roundStatus === "waiting") {
    startBtn.style.display = "inline-block";
    startBtn.innerText = roomData.round === 1 ? "▶️ 開始淘汰賽" : "▶️ 開始本輪";
    startBtn.disabled = !roomData.tournamentMode;
  } else if (roomData.roundStatus === "playing") {
    endBtn.style.display = "inline-block";
  } else if (roomData.roundStatus === "ended" && activePlayers(roomData.players).length > 1) {
    nextBtn.style.display = "inline-block";
  }
}

export async function closeJoining({ roomRef, playerId }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以停止加入");
    if (activePlayers(data.players).length < 2) throw new Error("至少需要 2 位參賽者");
    transaction.update(roomRef, { joinOpen: false });
  });
}

export async function selectTournamentMode({ roomRef, playerId, mode }) {
  if (!["winner", "loser"].includes(mode)) throw new Error("規則錯誤");

  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以選擇規則");
    if (data.tournamentModeLocked) throw new Error("淘汰賽已開始，規則不能再更改");
    if (data.joinOpen !== false) throw new Error("請先結束加入");
    transaction.update(roomRef, { tournamentMode: mode });
  });
}

export async function startRound({ roomRef, playerId }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以開始本輪");
    if (data.joinOpen !== false) throw new Error("請先結束加入");
    if (!data.tournamentMode) throw new Error("請先選擇「贏的人晉級」或「輸的人晉級」");
    if (data.roundStatus !== "waiting") throw new Error("目前不能開始本輪");
    if (activePlayers(data.players).length < 2) throw new Error("至少需要 2 位參賽者");

    transaction.update(roomRef, {
      roundStatus: "playing",
      tournamentModeLocked: true
    });
  });
}

export function renderMode(roomData) {
  document.getElementById("modeDisplay").innerText =
    `🎯 淘汰規則：${modeLabel(roomData.tournamentMode)}`;
}
