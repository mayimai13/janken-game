import { getGameSession } from "./session.js";
import { makeRoomRef, subscribeRoom, transactRoom, activePlayers } from "./room.js";
import { GROUP_NAMES, modeLabel, applyElimination } from "./rules.js";
import { closeJoining, selectTournamentMode, startRound, renderHostControls, renderMode } from "./host.js";
import { choose } from "./player.js";
import {
  renderGroupDecision, continueWithoutGroups, enableGroupMode,
  renderGroupControl, startGroup, endGroup, finishGroupStage
} from "./groups.js";
import { buildFinishedUpdate, renderWinner } from "./winner.js";
import { makeHistoryRecord, appendHistory, renderHistory } from "./history.js";
import { initChat } from "./chat.js";

const { playerId, nickname, roomCode } = getGameSession();

if (!playerId || !nickname || !roomCode) {
  alert("資料不存在，請重新加入");
  location.href = "index.html";
  throw new Error("Missing game session");
}

const roomRef = makeRoomRef(roomCode);

let roomData = null;
let isHost = false;
let players = {};

// 用來判斷「房主剛按下開始」的即時狀態轉換。
// 第一次載入頁面只記錄，不跳 alert，避免重新整理時重複通知。
let previousRoundStatus = null;
let previousActiveGroup = null;
let hasInitializedRealtimeState = false;

document.getElementById("roomNumber").innerText = roomCode;

const chat = initChat({
  roomCode,
  playerId,
  nickname,
  getIsHost: () => isHost
});

window.sendMessage = chat.sendMessage;

window.copyInviteLink = async function () {
  const url = `https://mayimai13.github.io/janken-game/?room=${roomCode}`;
  try {
    await navigator.clipboard.writeText(url);
    document.getElementById("copyMessage").innerText = "✅ 邀請連結已複製";
  } catch {
    prompt("請複製邀請連結", url);
  }
};

window.closeJoining = () => safely(() => closeJoining({ roomRef, playerId }));
window.selectTournamentMode = mode => safely(() => selectTournamentMode({ roomRef, playerId, mode }));
window.startRound = () => safely(() => startRound({ roomRef, playerId }));
window.choose = choice => safely(() => choose({ roomRef, playerId, choice }));
window.continueWithoutGroups = () => safely(() => continueWithoutGroups({ roomRef, playerId }));
window.enableGroupMode = () => safely(() => enableGroupMode({ roomRef, playerId }));
window.startGroup = group => safely(() => startGroup({ roomRef, playerId, group }));
window.endGroup = group => safely(() => endGroup({ roomRef, playerId, group }));
window.finishGroupStage = () => safely(() => finishGroupStage({ roomRef, playerId }));
window.endRound = () => safely(endRound);
window.prepareNextRound = () => safely(prepareNextRound);

subscribeRoom(roomRef, snapshot => {
  if (!snapshot.exists()) return;

  roomData = snapshot.data();
  players = roomData.players || {};
  isHost = roomData.hostId === playerId;

  handleRealtimeStartNotice();

  document.getElementById("hostControls").style.display = isHost ? "block" : "none";
  document.getElementById("hostBox").innerText = `👑 房主：${roomData.hostNickname || "主持人"}`;
  document.getElementById("roundNumber").innerText = `第 ${roomData.round || 1} 輪`;

  renderMode(roomData);
  renderRoundState();
  renderLiveStatus();
  renderJoinStatus();
  renderPlayers();
  renderMainUI();
  renderHostControls({ roomData, isHost });
  renderGroupDecision({ roomData, players, isHost });
  renderGroupControl({
    roomData,
    players,
    isHost,
    onStartGroup: group => window.startGroup(group),
    onEndGroup: group => window.endGroup(group)
  });
  renderWinner(roomData, players);
  renderHistory(roomData);
});

async function safely(fn) {
  try {
    await fn();
  } catch (error) {
    alert(error.message || String(error));
  }
}

function renderRoundState() {
  const box = document.getElementById("roundState");

  if (roomData.status === "finished") {
    box.innerText = "🏆 比賽已結束";
  } else if (roomData.stage === "group") {
    box.innerText = roomData.activeGroup
      ? `⚔️ ${GROUP_NAMES[roomData.activeGroup]} 比賽中`
      : "👥 分組淘汰進行中";
  } else if (roomData.joinOpen !== false) {
    box.innerText = "🟢 等待參賽者加入";
  } else if (roomData.roundStatus === "waiting") {
    box.innerText = roomData.round === 1
      ? "🔒 報名截止，等待房主開始淘汰賽"
      : "⏳ 等待房主開始本輪";
  } else if (roomData.roundStatus === "playing") {
    box.innerText = `🔥 第 ${roomData.round || 1} 輪進行中`;
  } else if (roomData.roundStatus === "firstDecision") {
    box.innerText = "📊 等待房主決定是否分組";
  } else if (roomData.roundStatus === "ended") {
    box.innerText = "🏁 本輪已結束";
  }
}

function renderJoinStatus() {
  const box = document.getElementById("joinStatus");
  box.innerText = roomData.status === "finished"
    ? "🏆 比賽已結束"
    : roomData.joinOpen !== false
      ? "🟢 開放加入"
      : "🔒 已停止加入";
}

function renderPlayers() {
  const box = document.getElementById("playerList");
  box.innerHTML = "";

  const entries = Object.entries(players);
  if (!entries.length) {
    box.innerHTML = "<div class='player'>目前沒有參賽玩家</div>";
    return;
  }

  entries.forEach(([id, p]) => {
    const row = document.createElement("div");
    row.className = "player";
    let text = p.nickname + (id === playerId ? "（你）" : "");

    if (roomData.status === "finished" && p.status === "active") {
      text += "　🏆 最後留下";
    } else if (p.status === "spectator") {
      row.classList.add("spectator");
      text += "　❌ 已淘汰";
    } else if (roomData.stage === "group") {
      if (p.group) text += `　${GROUP_NAMES[p.group]}`;

      if (roomData.activeGroup && p.group !== roomData.activeGroup) {
        row.classList.add("temp-watch");
        text += "　👀 觀賽中";
      } else if (p.group === roomData.activeGroup) {
        text += p.ready ? "　✅ 已出拳" : "　⏳ 尚未出拳";
      } else {
        text += "　⏳ 等待組別";
      }
    } else if (roomData.roundStatus === "playing") {
      text += p.ready ? "　✅ 已出拳" : "　⏳ 尚未出拳";
    } else {
      text += "　🎮 等待";
    }

    row.innerText = text;
    box.appendChild(row);
  });
}

function renderMainUI() {
  const choiceArea = document.querySelector(".choice-area");
  const buttons = document.querySelectorAll(".choice");
  const me = players[playerId];
  const title = document.getElementById("gameTitle");
  const watch = document.getElementById("watchMessage");

  if (roomData.status === "finished") {
    choiceArea.style.display = "none";
    watch.style.display = "block";
    title.innerText = !isHost && me?.status === "active" ? "🏆 你是最後留下的人！" : "🏆 比賽已結束";
    watch.innerText = `🏆 最後留下：${roomData.winner || ""}`;
    buttons.forEach(b => b.disabled = true);
    renderStatus();
    return;
  }

  if (isHost) {
    choiceArea.style.display = "none";
    watch.style.display = "none";
    title.innerText = "👑 房主主持模式";
    renderStatus();
    return;
  }

  if (!me) {
    choiceArea.style.display = "none";
    renderStatus();
    return;
  }

  if (me.status === "spectator") {
    choiceArea.style.display = "none";
    watch.style.display = "block";
    title.innerText = "👀 已淘汰";
    watch.innerText = "👀 你已淘汰，目前為觀看模式";
    renderStatus();
    return;
  }

  if (roomData.stage === "group") {
    if (roomData.activeGroup !== me.group) {
      choiceArea.style.display = "none";
      watch.style.display = "block";
      title.innerText = "👀 目前觀賽中";
      watch.innerText = roomData.activeGroup
        ? `目前由 ${GROUP_NAMES[roomData.activeGroup]} 進行比賽`
        : "等待房主選擇下一組比賽";
    } else {
      choiceArea.style.display = "flex";
      watch.style.display = "none";
      title.innerText = me.ready ? "✅ 你已出拳" : "⚔️ 輪到你的組別";
      buttons.forEach(b => b.disabled = roomData.roundStatus !== "groupPlaying" || me.ready);
    }
    renderStatus();
    return;
  }

  choiceArea.style.display = "flex";
  watch.style.display = "none";

  if (roomData.joinOpen !== false) {
    title.innerText = "🟢 等待其他參賽者加入";
  } else if (roomData.roundStatus === "waiting") {
    title.innerText = roomData.round === 1 ? "⏳ 等待房主開始淘汰賽" : "⏳ 等待房主開始本輪";
  } else if (roomData.roundStatus === "playing") {
    title.innerText = me.ready ? "✅ 你已出拳" : "請選擇你的出拳";
  } else if (roomData.roundStatus === "firstDecision") {
    title.innerText = "⏳ 等待房主決定下一階段";
  } else {
    title.innerText = "🏁 本輪已結束";
  }

  buttons.forEach(b => b.disabled = roomData.roundStatus !== "playing" || me.ready);
  renderStatus();
}

function renderStatus() {
  const active = activePlayers(players);

  if (roomData.status === "finished") {
    document.getElementById("status").innerText = `🏆 最後留下：${roomData.winner || ""}`;
    return;
  }

  if (roomData.stage === "group" && roomData.activeGroup) {
    const current = active.filter(p => p.group === roomData.activeGroup);
    const ready = current.filter(p => p.ready);
    document.getElementById("status").innerText =
      `${GROUP_NAMES[roomData.activeGroup]}：${ready.length} / ${current.length} 已出拳`;
    return;
  }

  const ready = active.filter(p => p.ready);
  document.getElementById("status").innerText =
    `目前 ${active.length} 位參賽者，${ready.length} 位已出拳`;
}


function getCurrentModeNoticeText() {
  if (roomData.tournamentMode === "loser") return "😈 輸家獲勝";
  if (roomData.tournamentMode === "winner") return "🏆 贏家獲勝";
  return "尚未選擇";
}

function handleRealtimeStartNotice() {
  const currentStatus = roomData.roundStatus ?? null;
  const currentGroup = roomData.activeGroup ?? null;

  // 首次載入或重新整理：只建立基準狀態，不跳通知。
  if (!hasInitializedRealtimeState) {
    previousRoundStatus = currentStatus;
    previousActiveGroup = currentGroup;
    hasInitializedRealtimeState = true;
    return;
  }

  // 一般輪次：waiting -> playing
  if (
    previousRoundStatus === "waiting" &&
    currentStatus === "playing"
  ) {
    const round = roomData.round || 1;

    if (round === 1) {
      alert(
        "🔒 房間已鎖定\n\n" +
        `🎯 本局淘汰賽為「${getCurrentModeNoticeText()}」\n\n` +
        "🔥 即將開始猜拳大賽！"
      );
    } else {
      alert(
        `🔔 第 ${round} 輪開始！\n\n` +
        `🎯 本局規則：${getCurrentModeNoticeText()}\n\n` +
        "✊✌️🖐️ 請參賽玩家出拳！"
      );
    }
  }

  // 分組：groupWaiting -> groupPlaying
  if (
    previousRoundStatus !== "groupPlaying" &&
    currentStatus === "groupPlaying" &&
    currentGroup
  ) {
    alert(
      `🔔 ${GROUP_NAMES[currentGroup]} 比賽開始！\n\n` +
      `🎯 本局規則：${getCurrentModeNoticeText()}\n\n` +
      `${GROUP_NAMES[currentGroup]} 玩家請出拳\n` +
      "👀 其他玩家請觀賽"
    );
  }

  previousRoundStatus = currentStatus;
  previousActiveGroup = currentGroup;
}

function renderLiveStatus() {
  const main = document.getElementById("liveStatusMain");
  const details = document.getElementById("liveStatusDetails");
  if (!main || !details) return;

  const active = activePlayers(players);
  const mode = getCurrentModeNoticeText();
  let rows = [];

  if (roomData.status === "finished") {
    main.innerText = "🏆 比賽已結束";
    rows = [
      `🎯 淘汰規則：${mode}`,
      `🏆 最後留下：${roomData.winner || "—"}`,
      "💬 討論區仍可繼續使用"
    ];
  } else if (roomData.stage === "group") {
    if (roomData.activeGroup) {
      const current = active.filter(p => p.group === roomData.activeGroup);
      const ready = current.filter(p => p.ready);

      main.innerText = `⚔️ ${GROUP_NAMES[roomData.activeGroup]} 比賽中`;
      rows = [
        `🎯 淘汰規則：${mode}`,
        `👥 本組參賽：${current.length} 人`,
        `✅ 已出拳：${ready.length} / ${current.length}`,
        "👀 其他組別目前觀賽中"
      ];
    } else {
      main.innerText = "👥 分組淘汰進行中";
      rows = [
        `🎯 淘汰規則：${mode}`,
        `👥 目前仍在場：${active.length} 人`,
        "⏳ 等待房主選擇下一組比賽"
      ];
    }
  } else if (roomData.joinOpen !== false) {
    main.innerText = "🟢 等待參賽者加入";
    rows = [
      `👥 目前參賽：${active.length} 人`,
      "🔓 房間目前開放加入",
      "⏳ 等待房主結束加入"
    ];
  } else if (roomData.roundStatus === "waiting") {
    const round = roomData.round || 1;
    main.innerText = round === 1
      ? "🔒 報名截止，等待開始淘汰賽"
      : `⏳ 第 ${round} 輪準備中`;

    rows = [
      `🎯 淘汰規則：${mode}`,
      `👥 本輪參賽：${active.length} 人`,
      round === 1
        ? "▶️ 等待房主按「開始淘汰賽」"
        : `▶️ 等待房主開始第 ${round} 輪`
    ];
  } else if (roomData.roundStatus === "playing") {
    const round = roomData.round || 1;
    const ready = active.filter(p => p.ready);

    main.innerText = `🔥 第 ${round} 輪進行中`;
    rows = [
      `🎯 淘汰規則：${mode}`,
      `👥 本輪參賽：${active.length} 人`,
      `✅ 已出拳：${ready.length} / ${active.length}`,
      "✊✌️🖐️ 請尚未出拳的玩家完成出拳"
    ];
  } else if (roomData.roundStatus === "firstDecision") {
    main.innerText = "📊 第一輪出拳完成";
    rows = [
      `🎯 淘汰規則：${mode}`,
      `👥 目前仍在場：${active.length} 人`,
      "⏳ 等待房主決定「依拳種分組」或「不分組直接判定」"
    ];
  } else if (roomData.roundStatus === "ended") {
    const round = roomData.round || 1;
    main.innerText = `✅ 第 ${round} 輪結束`;
    rows = [
      `🎯 淘汰規則：${mode}`,
      `✅ 目前晉級／仍在場：${active.length} 人`,
      `⏳ 等待房主準備第 ${round + 1} 輪`
    ];
  } else if (roomData.roundStatus === "groupWaiting") {
    main.innerText = "👥 分組淘汰等待中";
    rows = [
      `🎯 淘汰規則：${mode}`,
      `👥 目前仍在場：${active.length} 人`,
      "⏳ 等待房主安排下一組"
    ];
  } else {
    main.innerText = "📢 比賽狀態更新中";
    rows = [`🎯 淘汰規則：${mode}`];
  }

  details.innerHTML = "";
  rows.forEach(text => {
    const row = document.createElement("div");
    row.className = "live-status-row";
    row.innerText = text;
    details.appendChild(row);
  });
}

async function endRound() {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以結束本輪");
    if (data.roundStatus !== "playing") throw new Error("本輪尚未開始");
    if (!data.tournamentMode) throw new Error("尚未設定淘汰規則");

    const ps = { ...(data.players || {}) };
    const before = JSON.parse(JSON.stringify(ps));
    const activeEntries = Object.entries(ps).filter(([, p]) => p.status === "active");
    const ready = activeEntries.filter(([, p]) => p.ready);

    if (ready.length < 2) throw new Error("至少需要 2 位玩家出拳");

    // 未出拳者在截止時淘汰
    activeEntries.forEach(([id, p]) => {
      if (!p.ready) {
        ps[id] = { ...p, status: "spectator", eliminatedReason: "未出拳" };
      }
    });

    // 第一輪先只記錄出拳結果，之後由房主決定分組或直接判定
    if ((data.round || 1) === 1 && !data.firstRoundDecision) {
      ready.forEach(([id, p]) => {
        if (ps[id].status === "active") {
          ps[id] = { ...ps[id], group: p.choice };
        }
      });

      const historyRecord = makeHistoryRecord({
        round: data.round || 1,
        mode: null,
        playersBefore: before,
        playersAfter: ps,
        title: "第 1 輪・分組依據",
        note: "已公布第一輪出拳，等待房主決定「依拳種分組」或「不分組直接判定」。"
      });

      transaction.update(roomRef, {
        players: ps,
        roundStatus: "firstDecision",
        roundHistory: appendHistory(data, historyRecord)
      });
      return;
    }

    const elimination = applyElimination(ps, data.tournamentMode);

    const historyRecord = makeHistoryRecord({
      round: data.round || 1,
      mode: data.tournamentMode,
      playersBefore: before,
      playersAfter: ps,
      tie: elimination.tie,
      note: elimination.tie ? "本輪沒有淘汰，所有仍在場玩家進入重賽。" : null
    });

    const active = activePlayers(ps);
    if (active.length === 1) {
      transaction.update(roomRef, {
        ...buildFinishedUpdate(ps),
        roundHistory: appendHistory(data, historyRecord)
      });
      return;
    }

    transaction.update(roomRef, {
      players: ps,
      roundStatus: "ended",
      roundHistory: appendHistory(data, historyRecord)
    });
  });
}

async function prepareNextRound() {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.hostId !== playerId) throw new Error("只有房主可以操作");

    const ps = { ...(data.players || {}) };
    const active = activePlayers(ps);

    if (active.length === 1) {
      transaction.update(roomRef, buildFinishedUpdate(ps));
      return;
    }
    if (active.length < 2) throw new Error("沒有足夠參賽者進入下一輪");

    // 清掉所有人的上一輪出拳資料，避免舊 choice 殘留到下一輪
    Object.keys(ps).forEach(id => {
      ps[id] = {
        ...ps[id],
        choice: null,
        ready: false
      };
    });

    transaction.update(roomRef, {
      players: ps,
      round: (data.round || 1) + 1,
      roundStatus: "waiting"
    });
  });
}
