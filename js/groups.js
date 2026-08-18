import { transactRoom, activePlayers } from "./room.js";
import { applyElimination, GROUP_NAMES } from "./rules.js";
import { buildFinishedUpdate } from "./winner.js";
import { makeHistoryRecord, appendHistory } from "./history.js";

const GROUPS = ["rock", "scissors", "paper"];

export function renderGroupDecision({ roomData, players, isHost }) {
  const area = document.getElementById("groupDecisionArea");
  if (!isHost || roomData.status === "finished" || roomData.roundStatus !== "firstDecision") {
    area.style.display = "none";
    return;
  }

  area.style.display = "block";
  const counts = { rock: 0, scissors: 0, paper: 0 };
  Object.values(players).filter(p => p.status === "active").forEach(p => {
    if (p.group) counts[p.group]++;
  });

  document.getElementById("firstRoundGroupSummary").innerHTML =
    `<p>✊ 石頭組：${counts.rock} 人</p>
     <p>✌️ 剪刀組：${counts.scissors} 人</p>
     <p>🖐️ 布組：${counts.paper} 人</p>`;
}

export async function continueWithoutGroups({ roomRef, playerId }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以操作");
    if (!data.tournamentMode) throw new Error("尚未設定淘汰規則");

    const players = { ...(data.players || {}) };
    const before = JSON.parse(JSON.stringify(players));
    const elimination = applyElimination(players, data.tournamentMode);

    const historyRecord = makeHistoryRecord({
      round: data.round || 1,
      mode: data.tournamentMode,
      playersBefore: before,
      playersAfter: players,
      title: `第 ${data.round || 1} 輪・直接判定`,
      tie: elimination.tie,
      note: elimination.tie ? "本輪沒有淘汰，需進入下一輪重新比賽。" : null
    });

    const active = activePlayers(players);
    if (active.length === 1) {
      transaction.update(roomRef, {
        ...buildFinishedUpdate(players),
        firstRoundDecision: true,
        groupMode: false,
        stage: "normal",
        roundHistory: appendHistory(data, historyRecord)
      });
      return;
    }

    transaction.update(roomRef, {
      players,
      firstRoundDecision: true,
      groupMode: false,
      stage: "normal",
      roundStatus: "ended",
      roundHistory: appendHistory(data, historyRecord)
    });
  });
}

export async function enableGroupMode({ roomRef, playerId }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以操作");

    const players = { ...(data.players || {}) };
    const statuses = {};

    GROUPS.forEach(group => {
      const count = Object.values(players).filter(
        p => p.status === "active" && p.group === group
      ).length;

      statuses[group] = count === 0 ? "empty" : count === 1 ? "completed" : "waiting";
    });

    Object.keys(players).forEach(id => {
      if (players[id].status === "active") {
        players[id] = { ...players[id], choice: null, ready: false };
      }
    });

    transaction.update(roomRef, {
      players,
      firstRoundDecision: true,
      groupMode: true,
      stage: "group",
      activeGroup: null,
      groupStatuses: statuses,
      roundStatus: "groupWaiting"
    });
  });
}

export function renderGroupControl({ roomData, players, isHost, onStartGroup, onEndGroup }) {
  const area = document.getElementById("groupControlArea");
  if (roomData.status === "finished" || roomData.stage !== "group") {
    area.style.display = "none";
    return;
  }

  area.style.display = isHost ? "block" : "none";
  if (!isHost) return;

  const list = document.getElementById("groupList");
  list.innerHTML = "";
  const statuses = roomData.groupStatuses || {};

  GROUPS.forEach(group => {
    const members = Object.values(players).filter(
      p => p.status === "active" && p.group === group
    );

    const box = document.createElement("div");
    box.className = "group-box";

    const title = document.createElement("div");
    title.className = "group-title";
    title.innerText = `${GROUP_NAMES[group]}　${members.length} 人`;
    box.appendChild(title);

    const status = statuses[group] || "empty";
    const text = document.createElement("div");
    text.className = "group-status";

    if (status === "empty") text.innerText = "無參賽者";
    else if (status === "completed") text.innerText = members.length === 1 ? "✅ 1 人，自動晉級" : "✅ 本組已完成";
    else if (status === "playing") text.innerText = "🔥 本組比賽中";
    else if (status === "replay") text.innerText = "🤝 本組平手，需要重賽";
    else text.innerText = "⏳ 等待房主安排";

    box.appendChild(text);

    if ((status === "waiting" || status === "replay") && !roomData.activeGroup) {
      const btn = document.createElement("button");
      btn.className = "group-btn";
      btn.innerText = status === "replay" ? "🔁 本組重賽" : "▶️ 讓這組先比";
      btn.onclick = () => onStartGroup(group);
      box.appendChild(btn);
    }

    if (status === "playing" && roomData.activeGroup === group) {
      const btn = document.createElement("button");
      btn.className = "end-round-btn";
      btn.innerText = "🛑 結束本組比賽";
      btn.onclick = () => onEndGroup(group);
      box.appendChild(btn);
    }

    list.appendChild(box);
  });

  const allDone = GROUPS.every(group =>
    statuses[group] === "completed" || statuses[group] === "empty"
  );

  document.getElementById("finishGroupsBtn").style.display =
    allDone && !roomData.activeGroup ? "inline-block" : "none";
}

export async function startGroup({ roomRef, playerId, group }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以操作");
    if (data.activeGroup) throw new Error("目前已有組別正在比賽");

    const players = { ...(data.players || {}) };
    const members = Object.values(players).filter(
      p => p.status === "active" && p.group === group
    );
    if (members.length <= 1) throw new Error("此組不需要比賽");

    Object.keys(players).forEach(id => {
      if (players[id].status === "active" && players[id].group === group) {
        players[id] = { ...players[id], choice: null, ready: false };
      }
    });

    const statuses = { ...(data.groupStatuses || {}) };
    statuses[group] = "playing";

    transaction.update(roomRef, {
      players,
      activeGroup: group,
      groupStatuses: statuses,
      roundStatus: "groupPlaying"
    });
  });
}

export async function endGroup({ roomRef, playerId, group }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以操作");
    if (!data.tournamentMode) throw new Error("尚未設定淘汰規則");

    const players = { ...(data.players || {}) };
    const before = JSON.parse(JSON.stringify(players));
    const statuses = { ...(data.groupStatuses || {}) };

    const members = Object.entries(players).filter(
      ([, p]) => p.status === "active" && p.group === group
    );
    const ready = members.filter(([, p]) => p.ready);

    if (ready.length < 2) throw new Error("至少需要 2 位玩家出拳");

    members.forEach(([id, p]) => {
      if (!p.ready) {
        players[id] = { ...p, status: "spectator", eliminatedReason: "未出拳" };
      }
    });

    const choices = [...new Set(ready.map(([, p]) => p.choice))];

    if (choices.length === 1 || choices.length === 3) {
      const historyRecord = makeHistoryRecord({
        round: data.round || 1,
        mode: data.tournamentMode,
        playersBefore: before,
        playersAfter: players,
        title: `第 ${data.round || 1} 輪・${GROUP_NAMES[group]}`,
        group,
        tie: true,
        note: "本組平手，需要重賽。"
      });

      ready.forEach(([id]) => {
        players[id] = { ...players[id], choice: null, ready: false };
      });

      statuses[group] = "replay";
      transaction.update(roomRef, {
        players,
        activeGroup: null,
        groupStatuses: statuses,
        roundStatus: "groupWaiting",
        roundHistory: appendHistory(data, historyRecord)
      });
      return;
    }

    applyElimination(players, data.tournamentMode, p => p.group === group);

    const historyRecord = makeHistoryRecord({
      round: data.round || 1,
      mode: data.tournamentMode,
      playersBefore: before,
      playersAfter: players,
      title: `第 ${data.round || 1} 輪・${GROUP_NAMES[group]}`,
      group
    });

    statuses[group] = "completed";

    transaction.update(roomRef, {
      players,
      activeGroup: null,
      groupStatuses: statuses,
      roundStatus: "groupWaiting",
      roundHistory: appendHistory(data, historyRecord)
    });
  });
}

export async function finishGroupStage({ roomRef, playerId }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以操作");

    const statuses = data.groupStatuses || {};
    const allDone = GROUPS.every(group =>
      statuses[group] === "completed" || statuses[group] === "empty"
    );
    if (!allDone) throw new Error("還有組別尚未完成");

    const players = { ...(data.players || {}) };
    const active = activePlayers(players);

    Object.keys(players).forEach(id => {
      if (players[id].status === "active") {
        players[id] = { ...players[id], group: null, choice: null, ready: false };
      }
    });

    if (active.length === 1) {
      transaction.update(roomRef, {
        ...buildFinishedUpdate(players),
        groupMode: false,
        stage: "normal",
        activeGroup: null,
        groupStatuses: {}
      });
      return;
    }

    transaction.update(roomRef, {
      players,
      groupMode: false,
      stage: "normal",
      activeGroup: null,
      groupStatuses: {},
      round: 2,
      roundStatus: "waiting"
    });
  });
}
