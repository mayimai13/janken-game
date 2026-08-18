import {
  db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp
} from "./firebase.js";

export function initChat({ roomCode, playerId, nickname, getIsHost }) {
  const chatRef = collection(db, "rooms", roomCode, "messages");
  const chatQuery = query(chatRef, orderBy("createdAt", "desc"), limit(50));

  onSnapshot(chatQuery, snapshot => {
    const messages = [];
    snapshot.forEach(item => messages.push(item.data()));
    messages.reverse();
    renderChat(messages);
  }, error => console.error("聊天監聽失敗", error));

  const input = document.getElementById("chatInput");

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener("input", updateCount);

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 100) return alert("訊息最多 100 字");

    try {
      await addDoc(chatRef, {
        playerId,
        nickname,
        role: getIsHost() ? "host" : "player",
        text,
        createdAt: serverTimestamp()
      });
      input.value = "";
      updateCount();
    } catch (error) {
      alert("送出失敗：" + error.message);
    }
  }

  function updateCount() {
    document.getElementById("chatCount").innerText = `${input.value.length} / 100`;
  }

  return { sendMessage };
}

function renderChat(messages) {
  const box = document.getElementById("chatMessages");
  box.innerHTML = "";

  if (!messages.length) {
    box.innerHTML = "<div class='hint'>尚無訊息</div>";
    return;
  }

  messages.forEach(message => {
    const wrapper = document.createElement("div");
    wrapper.className = "chat-message";

    const name = document.createElement("div");
    name.className = "chat-name";
    name.innerText = message.role === "host"
      ? `👑 ${message.nickname || "房主"}`
      : (message.nickname || "匿名玩家");

    const text = document.createElement("div");
    text.className = "chat-text";
    text.innerText = message.text || "";

    wrapper.append(name, text);
    box.appendChild(wrapper);
  });

  box.scrollTop = box.scrollHeight;
}
