export const CONSOLE_MESSAGE_IMPORTANCE = {
  PLAYER_TRIGGERED: 1,
  ENVIRONMENT_AFFECTING_PLAYER: 2,
  AMBIENT_GAME_STATE: 3,
  AMBIENT_FLAVOR: 4,
};

export const DEFAULT_CONSOLE_THROTTLE_THRESHOLDS = {
  ambientFlavor: 8,
  ambientGameState: 14,
  essentialOnly: 22,
};

export function classifyConsoleMessage({ type = "sys", respondingToCommand = false } = {}) {
  const normalizedType = String(type || "sys").toLowerCase();
  if (respondingToCommand || normalizedType === "cmd" || normalizedType === "dispatch" || normalizedType === "error") {
    return CONSOLE_MESSAGE_IMPORTANCE.PLAYER_TRIGGERED;
  }
  if (normalizedType === "alert" || normalizedType === "report") {
    return CONSOLE_MESSAGE_IMPORTANCE.ENVIRONMENT_AFFECTING_PLAYER;
  }
  if (normalizedType.startsWith("comms-")) {
    return CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_FLAVOR;
  }
  if (normalizedType === "comms") {
    return CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_FLAVOR;
  }
  return CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_GAME_STATE;
}

export function shouldThrottleConsoleMessage({
  importance,
  recentCount,
  thresholds = DEFAULT_CONSOLE_THROTTLE_THRESHOLDS,
} = {}) {
  if (importance <= CONSOLE_MESSAGE_IMPORTANCE.PLAYER_TRIGGERED) return false;
  if (recentCount >= thresholds.essentialOnly) {
    return importance > CONSOLE_MESSAGE_IMPORTANCE.ENVIRONMENT_AFFECTING_PLAYER;
  }
  if (recentCount >= thresholds.ambientGameState) {
    return importance >= CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_GAME_STATE;
  }
  if (recentCount >= thresholds.ambientFlavor) {
    return importance >= CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_FLAVOR;
  }
  return false;
}

export function consoleMessageThrottleWeight({ type = "sys", respondingToCommand = false } = {}) {
  const normalizedType = String(type || "sys").toLowerCase();
  if (respondingToCommand && normalizedType !== "cmd") return 0.5;
  return 1;
}

export function createConsoleLogger({
  state,
  ui,
  fmtTime,
  stylizeConsoleText,
  messageGapMs,
  dotsDelayMs,
  revealDelayMs,
  responseBatchRevealMs = 1000,
  messageRateWindowMs = 10000,
  throttleThresholds = DEFAULT_CONSOLE_THROTTLE_THRESHOLDS,
}) {
  let followConsole = true;
  const FOLLOW_THRESHOLD_PX = 24;
  const pendingResponseLines = [];
  const recentConsoleMessages = [];
  let responseFlushQueued = false;

  function feedIsNearBottom() {
    if (!ui.feed) return true;
    return ui.feed.scrollTop + ui.feed.clientHeight >= ui.feed.scrollHeight - FOLLOW_THRESHOLD_PX;
  }

  function syncFollowToggleLabel() {
    if (!ui.consoleFollowToggle) return;
    ui.consoleFollowToggle.textContent = followConsole ? "★" : "↓";
    ui.consoleFollowToggle.classList.toggle("is-off", !followConsole);
  }

  ui.feed?.addEventListener("scroll", () => {
    followConsole = feedIsNearBottom();
    syncFollowToggleLabel();
  });

  ui.consoleFollowToggle?.addEventListener("click", () => {
    followConsole = !followConsole;
    syncFollowToggleLabel();
    if (followConsole) pinFeedToBottom(true);
  });
  syncFollowToggleLabel();

  function pinFeedToBottom(force = false) {
    if (!ui.feed) return;
    if (!force && !followConsole) return;
    const maxScrollTop = Math.max(0, ui.feed.scrollHeight - ui.feed.clientHeight);
    ui.feed.scrollTop = maxScrollTop;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        const refreshedMax = Math.max(0, ui.feed.scrollHeight - ui.feed.clientHeight);
        ui.feed.scrollTop = refreshedMax;
      });
    }
  }

  function appendLine(text, type = "sys", stampedTick = state.tick) {
    const div = document.createElement("div");
    const safeType = String(type || "sys").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    div.className = `line type-${safeType}`;

    const stamp = document.createElement("span");
    stamp.className = "stamp";
    stamp.textContent = `[${fmtTime(stampedTick)}][${type.toUpperCase()}]`;

    const body = document.createElement("span");
    body.className = "body";
    body.innerHTML = ` ${stylizeConsoleText(text)}`;

    div.appendChild(stamp);
    div.appendChild(body);
    ui.feed.appendChild(div);
    pinFeedToBottom();
    return body;
  }

  function queueConsoleTask(task, earliestAt = Date.now()) {
    const runAt = Math.max(state.consoleReadyAtMs, earliestAt);
    const delay = Math.max(0, runAt - Date.now());
    setTimeout(task, delay);
    state.consoleReadyAtMs = runAt + messageGapMs;
    return runAt;
  }

  function recordAndCheckThrottle(type, respondingToCommand = state.respondingToCommand) {
    const now = Date.now();
    while (recentConsoleMessages.length && now - recentConsoleMessages[0].at > messageRateWindowMs) {
      recentConsoleMessages.shift();
    }
    const importance = classifyConsoleMessage({ type, respondingToCommand });
    const recentLoad = recentConsoleMessages.reduce((sum, message) => sum + message.weight, 0);
    if (shouldThrottleConsoleMessage({ importance, recentCount: recentLoad, thresholds: throttleThresholds })) {
      return false;
    }
    recentConsoleMessages.push({
      at: now,
      importance,
      weight: consoleMessageThrottleWeight({ type, respondingToCommand }),
    });
    return true;
  }

  function flushPendingResponseLines() {
    responseFlushQueued = false;
    const entries = pendingResponseLines.splice(0);
    if (!entries.length) return;

    const inputAt = Date.now();
    const placeholderAt = Math.max(state.consoleReadyAtMs, inputAt + dotsDelayMs);
    const revealStartAt = Math.max(inputAt + revealDelayMs, placeholderAt + messageGapMs);
    const revealStepMs = entries.length > 1 ? responseBatchRevealMs / (entries.length - 1) : 0;
    const batchEndAt = revealStartAt + (entries.length > 1 ? responseBatchRevealMs : 0);

    entries.forEach((entry, index) => {
      let bodyNode = null;
      setTimeout(() => {
        bodyNode = appendLine(". . .", entry.type, entry.queuedTick);
      }, Math.max(0, placeholderAt - Date.now()));

      const revealAt = revealStartAt + revealStepMs * index;
      setTimeout(() => {
        if (!bodyNode) return;
        bodyNode.innerHTML = ` ${stylizeConsoleText(entry.text)}`;
        pinFeedToBottom();
      }, Math.max(0, revealAt - Date.now()));
    });

    state.consoleReadyAtMs = Math.max(state.consoleReadyAtMs, batchEndAt + messageGapMs);
  }

  function queueResponseLine(text, type, queuedTick) {
    pendingResponseLines.push({ text, type, queuedTick });
    if (responseFlushQueued) return;
    responseFlushQueued = true;
    Promise.resolve().then(flushPendingResponseLines);
  }

  function logLine(text, type = "sys") {
    const queuedTick = state.tick;
    if (!recordAndCheckThrottle(type)) return;

    if (state.respondingToCommand && type !== "cmd") {
      queueResponseLine(text, type, queuedTick);
      return;
    }

    queueConsoleTask(() => {
      appendLine(text, type, queuedTick);
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
