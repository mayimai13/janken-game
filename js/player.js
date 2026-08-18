import { transactRoom } from "./room.js";

export async function choose({ roomRef, playerId, choice }) {
  return transactRoom(roomRef, (transaction, data) => {
    if (data.status === "finished") throw new Error("比賽已結束");

    const players = { ...(data.players || {}) };
    const me = players[playerId];
    if (!me || me.status !== "active") throw new Error("你目前不能參賽");
    if (me.ready) return;

    if (data.stage === "group") {
      if (data.roundStatus !== "groupPlaying" || data.activeGroup !== me.group) {
        throw new Error("目前不是你的組別");
      }
    } else if (data.roundStatus !== "playing") {
      throw new Error("本輪尚未開始");
    }

    players[playerId] = { ...me, choice, ready: true };
    transaction.update(roomRef, { players });
  });
}
