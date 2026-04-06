export function createCommandInterpreter({
  state,
  nodes,
  edges,
  logLine,
  openContracts,
  assignContract,
  sendShip,
  shipReport,
  showShipsList,
  showShipMenu,
  showContractsForSelectedShip,
  showDestinationsForSelectedShip,
  basilSpeak,
  formatRoute,
  tutorialGoal,
  activeCommsContacts,
  resolveActiveContactName,
  hailContact,
}) {
  function tryNumericSelection(numericInput) {
    const n = Number(numericInput);
    if (!Number.isInteger(n) || n < 1) return false;

    if (state.selection.pending === "await_ship") {
      const ship = state.ships[n - 1];
      if (!ship) return logLine("Invalid ship number.", "error");
      state.selection.selectedShipId = ship.id;
      state.selection.pending = "ship_menu";
      return showShipMenu(ship.id);
    }

    if (state.selection.pending === "await_contract") {
      const contract = openContracts()[n - 1];
      if (!contract) return logLine("Invalid contract number.", "error");
      const assigned = assignContract(contract.id, state.selection.selectedShipId);
      if (assigned) {
        state.selection.selectedShipId = null;
        state.selection.pending = "await_ship";
        logLine("Assignment uplinked. Returning to ship list.", "sys");
        return showShipsList();
      }
      return true;
    }

    if (state.selection.pending === "await_destination") {
      const nodeId = Object.keys(nodes)[n - 1];
      if (!nodeId) return logLine("Invalid destination number.", "error");
      sendShip(state.selection.selectedShipId, nodeId);
      state.selection.pending = "ship_menu";
      return showShipMenu(state.selection.selectedShipId);
    }

    return false;
  }

  function handleShipMenuLetter(letter) {
    const shipId = state.selection.selectedShipId;
    if (!shipId) return false;

    if (letter === "a") {
      state.selection.pending = "await_contract";
      showContractsForSelectedShip();
      return true;
    }
    if (letter === "s") {
      state.selection.pending = "await_destination";
      showDestinationsForSelectedShip();
      return true;
    }
    if (letter === "r") {
      shipReport(shipId);
      showShipMenu(shipId);
      return true;
    }
    if (letter === "b") {
      state.selection.selectedShipId = null;
      state.selection.pending = "await_ship";
      showShipsList();
      return true;
    }

    return false;
  }

  function handleLongForm(parts) {
    if (parts[0] === "help") {
      logLine("help | status | lore | factions | comms | hail <name> | ships | select <ship> | assign <contract> <ship> | send <ship> <destination> | escort on/off | pause", "sys");
      return true;
    }

    if (parts[0] === "status") {
      logLine(`Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Tutorial ${state.completedContracts}/${tutorialGoal}`, "sys");
      basilSpeak("neutral", "Status mirrors manageable instability.", "basil");
      return true;
    }

    if (parts[0] === "lore") {
      logLine(state.loreSummary, "sys");
      return true;
    }

    if (parts[0] === "factions") {
      logLine("Factions: bluFreight, UFP, Arcworks, Blister, civilian authorities.", "sys");
      return true;
    }

    if (parts[0] === "comms") {
      const names = activeCommsContacts();
      if (!names.length) return logLine("Comms directory unavailable.", "error");
      logLine(`Comms directory: ${names.join(" | ")}`, "sys");
      return true;
    }

    if (parts[0] === "hail" && parts.length >= 2) {
      const query = resolveActiveContactName(parts.slice(1).join(" "));
      if (!query) return logLine("Usage: hail <character-name>", "error");
      hailContact(query);
      return true;
    }

    if (parts[0] === "map") {
      logLine(edges.map((e) => `${e[0]}<->${e[1]}:${e[2]}s`).join(" | "), "sys");
      return true;
    }

    if (parts[0] === "ships") {
      state.selection.pending = "await_ship";
      showShipsList();
      return true;
    }

    if (parts[0] === "select" && parts[1]) {
      const shipId = parts[1];
      const ship = state.ships.find((s) => s.id === shipId);
      if (!ship) logLine(`Unknown ship ${shipId}.`, "error");
      else {
        state.selection.selectedShipId = shipId;
        state.selection.pending = "ship_menu";
        showShipMenu(shipId);
      }
      return true;
    }

    if (parts[0] === "contracts") {
      openContracts().forEach((c, idx) => logLine(`${idx + 1}. ${c.id} ${formatRoute(c.from, c.to)}, $${c.payout}`, "sys"));
      return true;
    }

    if (parts[0] === "assign" && parts.length >= 3) {
      const assigned = assignContract(parts[1], parts[2]);
      if (assigned) {
        state.selection.selectedShipId = null;
        state.selection.pending = "await_ship";
        logLine("Assignment uplinked. Returning to ship list.", "sys");
        showShipsList();
      }
      return true;
    }

    if (parts[0] === "send" && parts.length >= 3) {
      sendShip(parts[1], parts[2]);
      return true;
    }

    if (parts[0] === "escort" && parts[1] === "on") {
      state.escort = true;
      logLine("Escort posture enabled.", "sys");
      return true;
    }

    if (parts[0] === "escort" && parts[1] === "off") {
      state.escort = false;
      logLine("Escort posture disabled.", "sys");
      return true;
    }

    if (parts[0] === "pause") {
      state.running = !state.running;
      logLine(state.running ? "Simulation resumed." : "Simulation paused.", "sys");
      return true;
    }

    return false;
  }

  function handleCommand(raw) {
    const input = raw.trim();
    if (!input) return;

    logLine(`> ${raw}`, "cmd", { immediate: true });
    const lower = input.toLowerCase();
    const parts = lower.split(/\s+/);
    state.respondingToCommand = true;

    if (tryNumericSelection(lower) !== false) {
      state.respondingToCommand = false;
      return;
    }

    if (state.selection.pending === "ship_menu" && lower.length === 1 && handleShipMenuLetter(lower)) {
      state.respondingToCommand = false;
      return;
    }

    if (state.selection.pending === "await_contract") {
      const contract = openContracts().find((c) => c.id.toLowerCase() === lower);
      if (contract) {
        const assigned = assignContract(contract.id, state.selection.selectedShipId);
        if (assigned) {
          state.selection.selectedShipId = null;
          state.selection.pending = "await_ship";
          logLine("Assignment uplinked. Returning to ship list.", "sys");
          showShipsList();
          state.respondingToCommand = false;
          return;
        }
        state.respondingToCommand = false;
        return true;
      }
    }

    if (state.selection.pending === "await_destination") {
      if (nodes[lower]) {
        sendShip(state.selection.selectedShipId, lower);
        state.selection.pending = "ship_menu";
        showShipMenu(state.selection.selectedShipId);
        state.respondingToCommand = false;
        return;
      }
    }

    if (!handleLongForm(parts)) logLine("Unknown input. Try: ships or help", "error");
    state.respondingToCommand = false;
  }

  return { handleCommand };
}
