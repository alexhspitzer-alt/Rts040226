export function createPlayerHailFlow({
  state,
  ui,
  arcworksExecName,
  handleScenario2DetainmentHailResolution,
  basilInform,
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
      if (targetName === arcworksExecName && state.currentScenario >= 2 && (normalized === "request" || normalized === "negotiate")) {
        state.onionSkinInspectionWaived = true;
        basilInform(`${arcworksExecName} has approved your request. Onion Skin inspection holds are now waived for current operations.`);
      }
      handleScenario2DetainmentHailResolution(targetName, normalized);
      logLine(`> ${normalized.replace("_", " ")}`, "cmd");
      const responseText = pickResponse(targetName, normalized);
      logLine(`${targetName} ${speakerContext(targetName)}: ${responseText}`, speakerMessageType(targetName));
      this.disable();
      return true;
    },
  };
}

export function pickHailResponse(state, targetName, action) {
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
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return `${targetName} acknowledged your ${action.replace("_", " ")}.`;
}
