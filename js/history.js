import { modeLabel, GROUP_NAMES } from "./rules.js";

const CHOICE_LABEL = {
  rock: "✊ 石頭",
  scissors: "✌️ 剪刀",
  paper: "🖐️ 布"
};

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

  const ids = new Set([
    ...Object.keys(playersBefore || {}),
    ...Object.keys(playersAfter || {})
  ]);

  ids.forEach(id => {
    const before = playersBefore?.[id];
    const after = playersAfter?.[id];
    if (!before && !after) return;

    // 只記錄這次有出拳/被截止淘汰的人
    const choice = before?.choice ?? after?.choice ?? null;
    const becameEliminated =
      before?.status === "active" && after?.status === "spectator";
    const wasActive = before?.status === "active";

    if (!choice && !becameEliminated) return;

    results.push({
      id,
      nickname: after?.nickname || before?.nickname || "匿名玩家",
      choice,
      outcome: becameEliminated ? "eliminated" : (wasActive ? "advanced" : "other"),
      reason: after?.eliminatedReason || null
    });
  });

  return {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAtMs: Date.now(),
    round: round || 1,
    group: group || null,
    title:
      title ||
      (group ? `第 ${round || 1} 輪・${GROUP_NAMES[group]}` : `第 ${round || 1} 輪`),
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
    box.innerHTML = '<div class="hint" style="text-align:center">尚無比賽結果</div>';
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

    (item.results || []).forEach(r => {
      const line = document.createElement("div");
      const choiceText = r.choice ? (CHOICE_LABEL[r.choice] || r.choice) : "未出拳";
      const outcomeText =
        item.tie ? "🤝 平手" :
        r.outcome === "eliminated" ? "❌ 淘汰" :
        r.outcome === "advanced" ? "✅ 晉級" : "";

      line.innerText = `${r.nickname}：${choiceText}${outcomeText ? "　" + outcomeText : ""}`;
      results.appendChild(line);

      if (!item.tie) {
        if (r.outcome === "advanced") advanced.push(r.nickname);
        if (r.outcome === "eliminated") eliminated.push(r.nickname);
      }
    });

    card.append(title, meta, results);

    if (item.tie) {
      const tie = document.createElement("div");
      tie.className = "history-tie";
      tie.innerText = "🤝 本輪平手，需要重新比賽";
      card.appendChild(tie);
    } else {
      const adv = document.createElement("div");
      adv.className = "history-advanced";
      adv.innerText = advanced.length
        ? `✅ 本輪晉級：${advanced.join("、")}`
        : (item.note || "本輪尚未產生晉級者");
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
