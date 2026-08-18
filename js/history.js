import { modeLabel, GROUP_NAMES } from "./rules.js";

const CHOICE_LABEL = {
  rock: "✊ 石頭",
  scissors: "✌️ 剪刀",
  paper: "🖐️ 布"
};

/**
 * 建立一筆「本輪歷史紀錄」
 *
 * 核心原則：
 * 1. 只記錄「本輪開始時仍是 active」的玩家
 * 2. 只記錄「本輪真的有出拳」或「本輪因未出拳而被淘汰」的人
 * 3. 前一輪已淘汰的 spectator，就算 Firebase 裡還殘留舊 choice，也完全不列入
 */
export function makeHistoryRecord({
  round,
  mode,
  playersBefore,
  playersAfter,
  title = null,
  group = null,
  tie = false,
  note = null
}) {
  const results = [];

  const beforeMap = playersBefore || {};
  const afterMap = playersAfter || {};

  Object.entries(beforeMap).forEach(([id, before]) => {
    const after = afterMap[id] || before;

    // ★ 最重要：前一輪已淘汰者，不屬於本輪參賽者
    if (before.status !== "active") return;

    const didPlayThisRound = before.ready === true && !!before.choice;

    const eliminatedThisRound =
      before.status === "active" &&
      after.status === "spectator";

    // 沒出拳、也沒有在本輪被淘汰，就不屬於本輪結果
    if (!didPlayThisRound && !eliminatedThisRound) return;

    let outcome = "other";

    if (tie && didPlayThisRound) {
      outcome = "tie";
    } else if (eliminatedThisRound) {
      outcome = "eliminated";
    } else if (after.status === "active") {
      outcome = "advanced";
    }

    results.push({
      id,
      nickname: after.nickname || before.nickname || "匿名玩家",
      choice: didPlayThisRound ? before.choice : null,
      outcome,
      reason: after.eliminatedReason || null
    });
  });

  return {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAtMs: Date.now(),
    round: round || 1,
    group: group || null,
    title:
      title ||
      (group
        ? `第 ${round || 1} 輪・${GROUP_NAMES[group]}`
        : `第 ${round || 1} 輪`),
    mode: mode || null,
    tie: !!tie,
    note: note || null,
    results
  };
}

export function appendHistory(data, record) {
  return [...(data.roundHistory || []), record];
}

export function renderHistory(roomData) {
  const box = document.getElementById("roundHistory");
  if (!box) return;

  const history = [...(roomData.roundHistory || [])].reverse();

  if (!history.length) {
    box.innerHTML =
      '<div class="hint" style="text-align:center">尚無比賽結果</div>';
    return;
  }

  box.innerHTML = "";

  history.forEach(item => {
    const card = document.createElement("div");
    card.className = "history-item";

    const title = document.createElement("div");
    title.className = "history-title";
    title.innerText = item.title || `第 ${item.round || 1} 輪`;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.innerText = item.mode
      ? `🎯 規則：${modeLabel(item.mode)}`
      : "🎯 本輪尚未進行淘汰判定";

    const results = document.createElement("div");
    results.className = "history-results";

    const advanced = [];
    const eliminated = [];
    const tied = [];

    (item.results || []).forEach(r => {
      const line = document.createElement("div");

      const choiceText = r.choice
        ? (CHOICE_LABEL[r.choice] || r.choice)
        : "未出拳";

      let outcomeText = "";

      if (r.outcome === "tie") {
        outcomeText = "🤝 平手";
        tied.push(r.nickname);
      } else if (r.outcome === "eliminated") {
        outcomeText = "❌ 淘汰";
        eliminated.push(r.nickname);
      } else if (r.outcome === "advanced") {
        outcomeText = "✅ 晉級";
        advanced.push(r.nickname);
      }

      line.innerText =
        `${r.nickname}：${choiceText}` +
        (outcomeText ? `　${outcomeText}` : "");

      results.appendChild(line);
    });

    card.append(title, meta, results);

    if (item.tie) {
      const tie = document.createElement("div");
      tie.className = "history-tie";
      tie.innerText = tied.length
        ? `🤝 本輪平手：${tied.join("、")}，需要重新比賽`
        : "🤝 本輪平手，需要重新比賽";
      card.appendChild(tie);
    } else {
      const adv = document.createElement("div");
      adv.className = "history-advanced";
      adv.innerText = advanced.length
        ? `✅ 本輪晉級：${advanced.join("、")}`
        : "✅ 本輪沒有產生新的晉級名單";
      card.appendChild(adv);

      if (eliminated.length) {
        const elim = document.createElement("div");
        elim.className = "history-eliminated";
        elim.innerText = `❌ 本輪淘汰：${eliminated.join("、")}`;
        card.appendChild(elim);
      }
    }

    if (item.note) {
      const note = document.createElement("div");
      note.className = "history-meta";
      note.innerText = `ℹ️ ${item.note}`;
      card.appendChild(note);
    }

    box.appendChild(card);
  });
}
