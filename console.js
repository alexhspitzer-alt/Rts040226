export function createConsoleLogger({
  state,
  ui,
  fmtTime,
  stylizeConsoleText,
  messageGapMs,
  dotsDelayMs,
  revealDelayMs,
}) {
  function appendLine(text, type = "sys") {
    const div = document.createElement("div");
    const safeType = String(type || "sys").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    div.className = `line type-${safeType}`;

    const stamp = document.createElement("span");
    stamp.className = "stamp";
    stamp.textContent = `[${fmtTime(state.tick)}][${type.toUpperCase()}]`;

    const body = document.createElement("span");
    body.className = "body";
    body.innerHTML = ` ${stylizeConsoleText(text)}`;

    div.appendChild(stamp);
    div.appendChild(body);
    ui.feed.appendChild(div);
    ui.feed.scrollTop = ui.feed.scrollHeight;
    return body;
  }

  function queueConsoleTask(task, earliestAt = Date.now()) {
    const runAt = Math.max(state.consoleReadyAtMs, earliestAt);
    const delay = Math.max(0, runAt - Date.now());
    setTimeout(task, delay);
    state.consoleReadyAtMs = runAt + messageGapMs;
    return runAt;
  }

  function logLine(text, type = "sys") {
    if (state.respondingToCommand && type !== "cmd") {
      const inputAt = Date.now();
      let bodyNode = null;
      const placeholderAt = queueConsoleTask(() => {
        bodyNode = appendLine(". . .", type);
      }, inputAt + dotsDelayMs);
      const revealAt = Math.max(inputAt + revealDelayMs, placeholderAt + messageGapMs);
      setTimeout(() => {
        if (!bodyNode) return;
        bodyNode.innerHTML = ` ${stylizeConsoleText(text)}`;
      }, Math.max(0, revealAt - Date.now()));
      return;
    }

    queueConsoleTask(() => {
      appendLine(text, type);
    });
  }

  return { logLine };
}

export function normalizeConsoleInput(raw) {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

export function normalizeContractIdToken(token) {
  const clean = String(token || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = clean.match(/^C-?(\d+)$/);
  if (!m) return null;
  return `C-${Number(m[1])}`;
}

export function normalizeShipIdToken(token) {
  const clean = String(token || "").trim().toLowerCase().replace(/\s+/g, "");
  const m = clean.match(/^([a-z_]+)-?(\d+)$/);
  if (!m) return null;
  return `${m[1]}-${Number(m[2])}`;
}
