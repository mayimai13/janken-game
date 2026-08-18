import { db, doc, getDoc, setDoc, runTransaction, serverTimestamp } from "./firebase.js";
import { getOrCreatePlayerId, saveSession } from "./session.js";

const playerId = getOrCreatePlayerId();
const params = new URLSearchParams(location.search);
const invitedRoom = params.get("room");

function showClosed(text) {
  document.getElementById("createArea").style.display = "none";
  document.getElementById("inviteArea").style.display = "none";
  document.getElementById("closedArea").style.display = "block";
  document.getElementById("closedText").innerText = text;
}

async function initializePage() {
  if (!invitedRoom || !/^\d{4}$/.test(invitedRoom)) return;

  document.getElementById("createArea").style.display = "none";

  try {
    const ref = doc(db, "rooms", invitedRoom);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showClosed("找不到這個房間");

    const data = snap.data();
    const players = data.players || {};

    if (players[playerId]) {
      saveSession({ nickname: players[playerId].nickname, roomCode: invitedRoom, role: "player" });
      location.href = `game.html?room=${invitedRoom}`;
      return;
    }

    if (data.status === "finished") return showClosed("這場比賽已經結束");
    if (data.joinOpen === false) return showClosed("房主已停止新玩家加入");

    document.getElementById("inviteArea").style.display = "block";
    document.getElementById("inviteRoomNumber").innerText = invitedRoom;
  } catch (error) {
    console.error(error);
    showClosed("讀取房間失敗");
  }
}

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

window.createRoom = async function () {
  const nickname = document.getElementById("hostNickname").value.trim();
  if (!nickname) return alert("請輸入房主暱稱");

  try {
    let roomCode, ref, snap;
    do {
      roomCode = generateRoomCode();
      ref = doc(db, "rooms", roomCode);
      snap = await getDoc(ref);
    } while (snap.exists());

    await setDoc(ref, {
      hostId: playerId,
      hostNickname: nickname,
      status: "playing",
      joinOpen: true,
      round: 1,
      roundStatus: "waiting",
      stage: "normal",
      firstRoundDecision: false,
      groupMode: false,
      activeGroup: null,
      groupStatuses: {},
      tournamentMode: null,
      tournamentModeLocked: false,
      roundHistory: [],
      createdAt: serverTimestamp(),
      players: {}
    });

    saveSession({ nickname, roomCode, role: "host" });
    location.href = `game.html?room=${roomCode}`;
  } catch (error) {
    console.error(error);
    alert("建立遊戲失敗：" + error.message);
  }
};

window.joinRoom = async function () {
  const nickname = document.getElementById("playerNickname").value.trim();
  if (!nickname) return alert("請輸入匿名暱稱");
  if (!invitedRoom) return alert("沒有房間號碼");

  const ref = doc(db, "rooms", invitedRoom);

  try {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("找不到這個遊戲");

      const data = snap.data();
      if (data.status === "finished") throw new Error("這場遊戲已結束");

      const players = { ...(data.players || {}) };
      const old = players[playerId];
      const alreadyJoined = !!old;

      if (data.joinOpen === false && !alreadyJoined) {
        throw new Error("此房間已停止加入");
      }

      players[playerId] = {
        nickname,
        status: alreadyJoined ? old.status : "active",
        choice: alreadyJoined ? old.choice ?? null : null,
        ready: alreadyJoined ? !!old.ready : false,
        group: alreadyJoined ? old.group ?? null : null,
        eliminatedReason: alreadyJoined ? old.eliminatedReason ?? null : null
      };

      transaction.update(ref, { players });
    });

    saveSession({ nickname, roomCode: invitedRoom, role: "player" });
    location.href = `game.html?room=${invitedRoom}`;
  } catch (error) {
    alert(error.message);
  }
};

initializePage();
