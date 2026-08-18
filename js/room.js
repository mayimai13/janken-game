import { db, doc, onSnapshot, runTransaction } from "./firebase.js";

export function makeRoomRef(roomCode) {
  return doc(db, "rooms", roomCode);
}

export function subscribeRoom(roomRef, callback, errorCallback = console.error) {
  return onSnapshot(roomRef, callback, errorCallback);
}

export async function transactRoom(roomRef, callback) {
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(roomRef);
    if (!snap.exists()) throw new Error("房間不存在");
    return callback(transaction, snap.data());
  });
}

export function activeEntries(players) {
  return Object.entries(players || {}).filter(([, p]) => p.status === "active");
}

export function activePlayers(players) {
  return activeEntries(players).map(([, p]) => p);
}
