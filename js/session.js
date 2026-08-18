function createAnonymousId() {
  if (crypto.randomUUID) return "p_" + crypto.randomUUID();
  return "p_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

export function getOrCreatePlayerId() {
  let id = sessionStorage.getItem("jankenPlayerId");
  if (!id) {
    id = createAnonymousId();
    sessionStorage.setItem("jankenPlayerId", id);
  }
  return id;
}

export function saveSession({ nickname, roomCode, role }) {
  sessionStorage.setItem("jankenNickname", nickname);
  sessionStorage.setItem("jankenRoom", roomCode);
  sessionStorage.setItem("jankenRole", role);
}

export function getGameSession() {
  const params = new URLSearchParams(location.search);
  return {
    playerId: sessionStorage.getItem("jankenPlayerId"),
    nickname: sessionStorage.getItem("jankenNickname"),
    role: sessionStorage.getItem("jankenRole"),
    roomCode: params.get("room")
  };
}
