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
    div.className = "line";

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

  function logLine(text, type = "sys", options = {}) {
    const { immediate = false } = options;
    if (immediate) {
      appendLine(text, type);
      state.consoleReadyAtMs = Math.max(state.consoleReadyAtMs, Date.now() + messageGapMs);
      return;
    }

    if (state.respondingToCommand && type !== "cmd") {
      const inputAt = Date.now();
      let bodyNode = null;
      const placeholderAt = queueConsoleTask(() => {
        bodyNode = appendLine(". . .", type);
      }, inputAt + dotsDelayMs);
      const revealAt = Math.max(
        inputAt + revealDelayMs,
        placeholderAt + messageGapMs
      );
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
