export function createGameUi(doc = document) {
  return {
    clock: doc.getElementById("clock"),
    cash: doc.getElementById("cash"),
    rep: doc.getElementById("rep"),
    risk: doc.getElementById("risk"),
    escort: doc.getElementById("escort"),
    contracts: doc.getElementById("contracts"),
    fleet: doc.getElementById("fleet"),
    feed: doc.getElementById("feed"),
    copyConsole: doc.getElementById("copy-console-link"),
    consoleFollowToggle: doc.getElementById("console-follow-toggle"),
    cmdForm: doc.getElementById("cmd-form"),
    cmdInput: doc.getElementById("cmd"),
    hailAction: doc.getElementById("hail-action"),
    almanacRoot: doc.getElementById("almanac-root"),
    inboxList: doc.getElementById("inbox-list"),
    inboxUnread: doc.getElementById("inbox-unread"),
    newsList: doc.getElementById("news-list"),
    tabButtons: Array.from(doc.querySelectorAll(".tab-btn")),
    tabPanels: Array.from(doc.querySelectorAll(".tab-panel")),
  };
}

export function createGameBootstrap({
  state,
  ui,
  loadReferenceData,
  renderAlmanac,
  playerHailFlow,
  handleCommand,
  render,
  activateTab,
  copyConsoleToClipboard,
  hasActiveNodes,
  installFallbackMap,
  syncDockConditionsToActiveLocations,
  fillContractBoard,
  basilInform,
  playScenarioIntro,
  logLine,
  showShipsList,
  updateSimulation,
  tickMs = 1000,
}) {
  function bindControls() {
    ui.cmdForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (playerHailFlow.isAwaitingChoice()) {
        playerHailFlow.submitSelection(ui.hailAction?.value || "request");
      } else {
        handleCommand(ui.cmdInput.value);
        ui.cmdInput.value = "";
      }
      render();
    });

    ui.copyConsole?.addEventListener("click", (event) => {
      event.preventDefault();
      copyConsoleToClipboard();
    });

    ui.tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activateTab(button.dataset.tab || "contracts");
      });
    });
  }

  async function init() {
    bindControls();
    await loadReferenceData();
    renderAlmanac();
    playerHailFlow.disable();
    if (!hasActiveNodes()) {
      installFallbackMap();
    }
    syncDockConditionsToActiveLocations();
    fillContractBoard({ forceNewTarget: true });
    state.selection.pending = "await_ship";
    basilInform("Dispatch online. I've sent operating instructions to your inbox because management has asked me to stop spamming the console with monologues.", "basil");
    playScenarioIntro();
    logLine("Tutorial online. Select ship by typing its number or ID.", "sys");
    showShipsList();
    render();

    setInterval(() => {
      if (!state.running) return;
      state.tick += 1;
      updateSimulation();
      render();
    }, tickMs);
  }

  return { bindControls, init };
}
