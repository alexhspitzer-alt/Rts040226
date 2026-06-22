export function createPlayerHailFlow({
  ui,
  logLine,
  speakerContext,
  speakerMessageType,
  pickResponse,
}) {
  return {
    activeTarget: null,
    awaitingPlayerChoice: false,
    options: ["request", "threaten", "thank_you", "negotiate", "insult", "goodbye"],
    enable(targetName) {
      this.activeTarget = targetName;
      this.awaitingPlayerChoice = true;
      if (!ui.hailAction) return;
      ui.cmdInput.hidden = true;
      ui.cmdInput.disabled = true;
      ui.hailAction.hidden = false;
      ui.hailAction.disabled = false;
      ui.hailAction.value = this.options[0];
      ui.hailAction.focus();
    },
    disable() {
      this.activeTarget = null;
      this.awaitingPlayerChoice = false;
      if (!ui.hailAction) return;
      ui.hailAction.hidden = true;
      ui.hailAction.disabled = true;
      ui.cmdInput.hidden = false;
      ui.cmdInput.disabled = false;
      ui.cmdInput.focus();
    },
    isAwaitingChoice() {
      return this.awaitingPlayerChoice && Boolean(this.activeTarget);
    },
    submitSelection(action) {
      if (!this.isAwaitingChoice()) return false;
      const normalized = this.options.includes(action) ? action : this.options[0];
      const targetName = this.activeTarget;
      logLine(`> ${normalized.replace("_", " ")}`, "cmd");
      const responseText = pickResponse(targetName, normalized);
      logLine(`${targetName} ${speakerContext(targetName)}: ${responseText}`, speakerMessageType(targetName));
      this.disable();
      return true;
    },
  };
}

export function pickHailResponse(state, targetName, action, randomProvider = { pick: (pool) => pool[0] }) {
  const dialogue = state.playerRequestDialogue || {};
  const byCharacter = dialogue?.byCharacter?.[targetName]?.[action];
  const byFaction = dialogue?.byFaction?.[String(state.dialogueDb?.[targetName]?.faction || "").toLowerCase()]?.[action];
  const fallback = dialogue?.default?.[action];
  const modernPool = byCharacter || byFaction || fallback || [];
  const actionToneMap = {
    request: "positive",
    negotiate: "positive",
    thank_you: "positive",
    threaten: "rude",
    insult: "rude",
    goodbye: "negative",
  };
  const legacyTone = actionToneMap[action] || "negative";
  const legacyPool = dialogue?.[targetName]?.player_request?.[legacyTone]
    || dialogue?.default?.player_request?.[legacyTone]
    || [];
  const pool = modernPool.length ? modernPool : legacyPool;
  if (Array.isArray(pool) && pool.length) {
    return randomProvider.pick(pool);
  }
  return `${targetName} acknowledged your ${action.replace("_", " ")}.`;
}
