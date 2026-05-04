export function createCommandRuntime({
  state,
  getNodes,
  getEdges,
  logLine,
  normalizeConsoleInput,
  normalizeContractIdToken,
  normalizeShipIdToken,
  openContracts,
  contractNumber,
  assignContract,
  sendShip,
  dockUtilityShip,
  undockUtilityShip,
  shipReport,
  showShipsList,
  showShipMenu,
  showContractsForSelectedShip,
  showDestinationsForSelectedShip,
  dockableShipsForUtility,
  isPlayerBankrupt,
  checkScenarioCompletion,
  nodeLabel,
  normalizeNodeInput,
  activeCommsContacts,
  isContactPresent,
  contactProfiles,
  oneWaySignalToNode,
  basilInform,
  basilSpeak,
  scheduleMessage,
  speakerContext,
  pickLine,
  speakerMessageType,
  characterSpeak,
  buddeInform,
  buildBuddeRouteBrief,
  playerHailFlow,
  tutorialGoal,
}) {
  function resolveShipToken(token) {
    const raw = String(token || "").trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric > 0) {
      const byIndex = state.ships[numeric - 1];
      if (!byIndex) return null;
      return {
        shipId: byIndex.id,
        interpretation: raw !== byIndex.id ? `Interpreting "${raw}" as "${byIndex.id}".` : null,
      };
    }

    const normalized = normalizeShipIdToken(raw) || raw.toLowerCase();
    const ship = state.ships.find((s) => s.id === normalized || s.id === raw.toLowerCase());
    if (!ship) return null;
    return {
      shipId: ship.id,
      interpretation: raw.toLowerCase() !== ship.id ? `Interpreting "${raw}" as "${ship.id}".` : null,
    };
  }

  function resolveContractToken(token) {
    const raw = String(token || "").trim();
    if (!raw) return null;
    const contracts = openContracts();
    if (!contracts.length) return null;

    const contractLike = normalizeContractIdToken(raw);
    if (contractLike) {
      const byId = contracts.find((c) => c.id.toUpperCase() === contractLike);
      if (!byId) return null;
      return {
        contractId: byId.id,
        interpretation: contractLike !== raw.toUpperCase() ? `Interpreting "${raw}" as "${byId.id}".` : null,
      };
    }

    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric > 0) {
      const byIdNumber = contracts.find((c) => contractNumber(c.id) === numeric);
      if (byIdNumber) {
        return {
          contractId: byIdNumber.id,
          interpretation: raw !== byIdNumber.id ? `Interpreting "${raw}" as "${byIdNumber.id}".` : null,
        };
      }
      const byVisibleIndex = contracts[numeric - 1];
      if (!byVisibleIndex) return null;
      return {
        contractId: byVisibleIndex.id,
        interpretation: `Interpreting "${raw}" as visible list item "${byVisibleIndex.id}".`,
      };
    }

    const byLoose = contracts.find((c) => c.id.toLowerCase() === raw.toLowerCase());
    if (!byLoose) return null;
    return {
      contractId: byLoose.id,
      interpretation: raw !== byLoose.id ? `Interpreting "${raw}" as "${byLoose.id}".` : null,
    };
  }

  function normalizeCommandWord(word) {
    const lower = String(word || "").toLowerCase();
    const aliases = {
      contract: "contracts",
      contracts: "contracts",
      ship: "ships",
      ships: "ships",
      sel: "select",
      select: "select",
      stat: "status",
      status: "status",
      h: "help",
      c: "contracts",
      m: "map",
      p: "pause",
    };
    return aliases[lower] || lower;
  }

  function inputToName(input) {
    const candidates = activeCommsContacts();
    if (!candidates.length) return null;
    const exact = candidates.find((n) => n.toLowerCase() === input.toLowerCase());
    if (exact) return exact;
    const lowered = input.toLowerCase();
    return candidates.find((n) => n.toLowerCase().includes(lowered) || lowered.includes(n.toLowerCase())) || null;
  }

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
      const resolved = resolveContractToken(String(n));
      if (!resolved) return logLine("Invalid contract number. Use a visible number or contract ID like C-2.", "error");
      if (resolved.interpretation) logLine(resolved.interpretation, "sys");
      const assigned = assignContract(resolved.contractId, state.selection.selectedShipId);
      if (assigned) {
        state.selection.selectedShipId = null;
        state.selection.pending = "await_ship";
        logLine("Assignment uplinked. Returning to ship list.", "sys");
        return showShipsList();
      }
      return true;
    }

    if (state.selection.pending === "await_destination") {
      const nodeId = state.selection.allowedDestinationIds[n - 1];
      if (!nodeId) return logLine("Invalid destination number.", "error");
      sendShip(state.selection.selectedShipId, nodeId);
      state.selection.pending = "ship_menu";
      return showShipMenu(state.selection.selectedShipId);
    }

    if (state.selection.pending === "await_dock_target") {
      const targetId = state.selection.dockableShipIds[n - 1];
      if (!targetId) return logLine("Invalid dock target number.", "error");
      dockUtilityShip(state.selection.selectedShipId, targetId);
      state.selection.pending = "ship_menu";
      return showShipMenu(state.selection.selectedShipId);
    }

    if (state.selection.pending === "await_route_from") {
      const fromNodeId = state.selection.routeSelectableNodeIds?.[n - 1];
      if (!fromNodeId) return logLine("Invalid origin number.", "error");
      state.selection.routeFromNodeId = fromNodeId;
      state.selection.pending = "await_route_to";
      buddeInform(`Origin set: ${nodeLabel(fromNodeId)}. Select destination by number.`);
      (state.selection.routeSelectableNodeIds || [])
        .filter((nodeId) => nodeId !== fromNodeId)
        .forEach((nodeId, idx) => {
          const node = getNodes()[nodeId];
          logLine(`${idx + 1}. ${nodeLabel(nodeId)} | approach ${node?.approach ?? "n/a"}`, "sys");
        });
      return true;
    }

    if (state.selection.pending === "await_route_to") {
      const options = (state.selection.routeSelectableNodeIds || []).filter((nodeId) => nodeId !== state.selection.routeFromNodeId);
      const toNodeId = options[n - 1];
      if (!toNodeId) return logLine("Invalid destination number.", "error");
      const fromNodeId = state.selection.routeFromNodeId;
      buddeInform(buildBuddeRouteBrief(fromNodeId, toNodeId));
      state.selection.pending = null;
      state.selection.routeFromNodeId = null;
      return true;
    }

    return false;
  }

  function handleShipMenuLetter(letter) {
    const shipId = state.selection.selectedShipId;
    if (!shipId) return false;
    const ship = state.ships.find((s) => s.id === shipId);
    if (!ship) return false;

    if (letter === "a") {
      if (ship.utility) {
        logLine(`${shipId} cannot take cargo contracts. Use dock/send operations instead.`, "error");
        return true;
      }
      state.selection.pending = "await_contract";
      showContractsForSelectedShip();
      return true;
    }
    if (letter === "s") {
      if (ship.utility && ship.status === "docked") {
        logLine(`${shipId} is currently docked. Undock first.`, "error");
        return true;
      }
      state.selection.pending = "await_destination";
      showDestinationsForSelectedShip();
      return true;
    }
    if (letter === "d") {
      if (!ship.utility || ship.status === "docked") return true;
      const dockable = dockableShipsForUtility(shipId);
      state.selection.dockableShipIds = dockable.map((entry) => entry.id);
      if (!state.selection.dockableShipIds.length) {
        logLine("No dockable ship available at current location.", "sys");
        return true;
      }
      state.selection.pending = "await_dock_target";
      logLine(`Dock ${shipId} to which ship?`, "sys");
      state.selection.dockableShipIds.forEach((targetId, idx) => {
        logLine(`${idx + 1}. ${targetId}`, "sys");
      });
      return true;
    }
    if (letter === "u") {
      if (!ship.utility || ship.status !== "docked") return true;
      undockUtilityShip(shipId);
      showShipMenu(shipId);
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

  function forceCompleteCurrentScenario() {
    if (isPlayerBankrupt()) {
      state.cash = Math.max(state.cash, 0);
      state.rep = Math.max(state.rep, 1);
      logLine("Cheat override: insolvency gate temporarily cleared for scenario completion testing.", "sys");
    }

    const scenarioBefore = state.currentScenario;
    state.completedContracts = tutorialGoal;
    checkScenarioCompletion();

    if (scenarioBefore === state.currentScenario) {
      logLine(`Cheat applied: Scenario ${scenarioBefore} marked complete.`, "sys");
    } else {
      logLine(`Cheat applied: Scenario ${scenarioBefore} completed. Advanced to Scenario ${state.currentScenario}.`, "sys");
    }
  }

  function handleLongForm(parts) {
    let command = normalizeCommandWord(parts[0]);
    if (parts[0] === "h" && parts.length >= 2) command = "hail";

    if (command === "help") {
      logLine("help | status | comms | hail <name> | map [routes] | ships | select <ship|number> | assign <contract> <ship> (either order; IDs or numbers) | send <ship> <destination> | pause", "sys");
      logLine("Aliases: contract/contracts, ship/ships, sel/select, C1/C-1, hauler1/hauler-1. Extra spaces and case are ignored.", "sys");
      return true;
    }

    if (command === "status") {
      logLine(`Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Scenario ${state.currentScenario}: ${state.completedContracts}/${tutorialGoal}`, "sys");
      basilSpeak("neutral", "Status mirrors manageable instability.", "basil");
      return true;
    }

    if (command === "comms") {
      const names = activeCommsContacts();
      if (!names.length) return logLine("Comms directory unavailable.", "error");
      logLine(`Comms directory: ${names.join(" | ")}`, "sys");
      return true;
    }

    if (command === "hail" && parts.length >= 2) {
      const hailText = parts.slice(1).join(" ");
      const query = inputToName(hailText);
      if (!query) return logLine("Usage: hail <character-name>", "error");
      if (!isContactPresent(query)) return logLine(`${query} is not currently present on the network.`, "error");
      const targetNode = contactProfiles[query]?.nodeId;
      if (targetNode && getNodes()[targetNode]) {
        const uplink = oneWaySignalToNode(targetNode);
        const rtt = uplink * 2;
        basilInform(`Hailing ${query} at ${nodeLabel(targetNode)}. Uplink ${uplink}s, expected reply in ~${rtt}s.`);
        scheduleMessage(
          rtt,
          () => {
            playerHailFlow.enable(query);
            return `${query} ${speakerContext(query)}: ${pickLine(query, "greetings") || "Channel open."} Select a hail response from the dropdown menu.`;
          },
          speakerMessageType(query)
        );
      } else {
        characterSpeak(query, "greetings", "Channel open.", "comms");
        playerHailFlow.enable(query);
        logLine("Select a hail response from the dropdown menu.", "sys");
      }
      return true;
    }

    if (command === "map" || command === "routes") {
      const mapSubPrompt = (parts[1] || "").toLowerCase();
      if (command === "routes" || mapSubPrompt === "routes" || mapSubPrompt === "") {
        const nodeIds = Object.keys(getNodes());
        state.selection.pending = "await_route_from";
        state.selection.routeSelectableNodeIds = nodeIds;
        state.selection.routeFromNodeId = null;
        buddeInform("Route planner online. Select origin by number. Approach indicates local distance from the parent moon.");
        nodeIds.forEach((id, idx) => {
          const node = getNodes()[id];
          logLine(`${idx + 1}. ${nodeLabel(id)} | approach ${node.approach ?? "n/a"}`, "sys");
        });
        return true;
      }
      buddeInform("Use map or routes to start route planning.");
      return true;
    }

    if (command === "ships") {
      state.selection.pending = "await_ship";
      showShipsList();
      return true;
    }

    if (command === "select" && parts[1]) {
      const resolvedShip = resolveShipToken(parts[1]);
      if (!resolvedShip) logLine(`Could not resolve ship "${parts[1]}". Try a ship ID like hauler-1 or list number.`, "error");
      else {
        if (resolvedShip.interpretation) logLine(resolvedShip.interpretation, "sys");
        state.selection.selectedShipId = resolvedShip.shipId;
        state.selection.pending = "ship_menu";
        showShipMenu(resolvedShip.shipId);
      }
      return true;
    }

    if (command === "contracts") {
      openContracts().forEach((c, idx) => {
        const displayNumber = contractNumber(c.id) || (idx + 1);
        const scenarioFlavor = state.currentScenario >= 2 && c.client && c.cargoType
          ? ` | ${c.client} | ${c.cargoType}`
          : "";
        const cargoRequirementLabel = state.currentScenario >= 3 && Number.isInteger(c.cargoRequirement)
          ? ` | cargo ${c.cargoRequirement}T`
          : "";
        logLine(`${displayNumber}. ${c.id} ${nodeLabel(c.from)} -> ${nodeLabel(c.to)}${scenarioFlavor}${cargoRequirementLabel}, $${c.payout}`, "sys");
      });
      return true;
    }

    if (command === "assign" && parts.length >= 3) {
      const firstShip = resolveShipToken(parts[1]);
      const firstContract = resolveContractToken(parts[1]);
      const secondShip = resolveShipToken(parts[2]);
      const secondContract = resolveContractToken(parts[2]);

      let shipId = null;
      let contractId = null;

      if (firstContract && secondShip) {
        contractId = firstContract.contractId;
        shipId = secondShip.shipId;
      } else if (firstShip && secondContract) {
        shipId = firstShip.shipId;
        contractId = secondContract.contractId;
      } else {
        return logLine(
          `Could not resolve assign arguments "${parts[1]}" and "${parts[2]}". Use assign <contract> <ship> or assign <ship> <contract>.`,
          "error"
        );
      }

      [firstShip?.interpretation, firstContract?.interpretation, secondShip?.interpretation, secondContract?.interpretation]
        .filter(Boolean)
        .forEach((msg) => logLine(msg, "sys"));

      const assigned = assignContract(contractId, shipId);
      if (assigned) {
        state.selection.selectedShipId = null;
        state.selection.pending = "await_ship";
        logLine("Assignment uplinked. Returning to ship list.", "sys");
        showShipsList();
      }
      return true;
    }

    if (command === "send" && parts.length >= 3) {
      const resolvedShip = resolveShipToken(parts[1]);
      if (!resolvedShip) return logLine(`Could not resolve ship "${parts[1]}". Try ship ID or visible ship number.`, "error");
      if (resolvedShip.interpretation) logLine(resolvedShip.interpretation, "sys");
      sendShip(resolvedShip.shipId, parts[2]);
      return true;
    }

    if (command === "pause") {
      state.running = !state.running;
      logLine(state.running ? "Simulation resumed." : "Simulation paused.", "sys");
      return true;
    }

    if (command === "cheat") {
      forceCompleteCurrentScenario();
      return true;
    }

    return false;
  }

  function handleCommand(raw) {
    const input = normalizeConsoleInput(raw);
    if (!input) return;

    logLine(`> ${input}`, "cmd");
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
      const resolved = resolveContractToken(lower);
      if (resolved) {
        if (resolved.interpretation) logLine(resolved.interpretation, "sys");
        const assigned = assignContract(resolved.contractId, state.selection.selectedShipId);
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

    if (state.selection.pending === "await_dock_target") {
      const resolvedShip = resolveShipToken(lower);
      if (resolvedShip?.shipId) {
        const targetId = resolvedShip.shipId;
        if (!state.selection.dockableShipIds.includes(targetId)) {
          logLine("Selected ship is not dockable from current position.", "error");
          state.respondingToCommand = false;
          return;
        }
        dockUtilityShip(state.selection.selectedShipId, targetId);
        state.selection.pending = "ship_menu";
        showShipMenu(state.selection.selectedShipId);
        state.respondingToCommand = false;
        return;
      }
    }

    if (state.selection.pending === "await_destination") {
      const normalized = normalizeNodeInput(lower);
      if (normalized) {
        if (!state.selection.allowedDestinationIds.includes(normalized)) {
          logLine("Destination unavailable for current ship. Pick one from the listed options.", "error");
          state.respondingToCommand = false;
          return;
        }
        sendShip(state.selection.selectedShipId, normalized);
        state.selection.pending = "ship_menu";
        showShipMenu(state.selection.selectedShipId);
        state.respondingToCommand = false;
        return;
      }
    }

    if (!handleLongForm(parts)) logLine("Unknown input. Try: ships or help", "error");
    state.respondingToCommand = false;
  }

  return {
    handleCommand,
  };
}
