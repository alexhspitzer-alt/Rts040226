export function createCommandRuntime({
  state,
  getNodes,
  getEdges,
  logLine,
  normalizeConsoleInput,
  normalizeContractIdToken,
  normalizeShipIdToken,
  playerShipDisplayId,
  openContracts,
  contractNumber,
  assignContract,
  sendShip,
  recallShip,
  canRecallShip,
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
  formatNpcShipIdentity,
  pickLine,
  speakerMessageType,
  characterSpeak,
  buddeInform,
  buildBuddeRouteBrief,
  playerHailFlow,
  tutorialGoal,
  npcConflictDebugLines,
  bumpNpcConflictStress,
  factionHeatDebugLines,
  dockDebugLines,
  warmFactionHeat,
  launchFactionCampaign,
  debugKillPlayerShip,
  debugKillNpc,
}) {

  function titleCaseWords(value) {
    return String(value || "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  function playerShipType(shipOrId) {
    const id = typeof shipOrId === "string" ? shipOrId : shipOrId?.id;
    return titleCaseWords(String(id || "ship").split("-")[0]);
  }

  function playerShipCallsign(ship) {
    const shipNumber = Math.max(1, state.ships.findIndex((entry) => entry.id === ship?.id) + 1);
    return `${playerShipType(ship)} Blue-${shipNumber}`;
  }

  function visibleShipId(ship) {
    return typeof playerShipDisplayId === "function" ? playerShipDisplayId(ship) : null;
  }

  function visibleShipIdById(shipId) {
    const ship = state.ships.find((entry) => entry.id === shipId);
    return visibleShipId(ship) || shipId;
  }

  function normalizeFleetIdToken(token) {
    const clean = String(token || "").trim().toUpperCase().replace(/\s+/g, "");
    const match = clean.match(/^B-?(\d+)$/);
    if (!match) return null;
    return `B-${Number(match[1])}`;
  }

  function shipDestroyed(ship) {
    return ship?.status === "destroyed" || ship?.combatStatus === "killed";
  }

  function resolveShipToken(token, options = {}) {
    const includeDestroyed = Boolean(options.includeDestroyed);
    const raw = String(token || "").trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric > 0) {
      const byIndex = state.ships[numeric - 1];
      if (!byIndex || (!includeDestroyed && shipDestroyed(byIndex))) return null;
      const displayId = visibleShipId(byIndex) || byIndex.id;
      return {
        shipId: byIndex.id,
        interpretation: raw !== displayId ? `Interpreting "${raw}" as "${displayId}".` : null,
      };
    }

    const fleetId = normalizeFleetIdToken(raw);
    if (fleetId) {
      const byFleetId = state.ships[Number(fleetId.slice(2)) - 1];
      if (!byFleetId || (!includeDestroyed && shipDestroyed(byFleetId))) return null;
      return {
        shipId: byFleetId.id,
        interpretation: raw.toUpperCase() !== fleetId ? `Interpreting "${raw}" as "${fleetId}".` : null,
      };
    }

    const normalized = normalizeShipIdToken(raw) || raw.toLowerCase();
    const normalizedCallsign = raw.toLowerCase().replace(/\s+/g, " ").trim();
    const compactCallsign = normalizedCallsign.replace(/[-\s]/g, "");
    const ship = state.ships.find((s) => {
      const fullCallsign = playerShipCallsign(s).toLowerCase();
      const shortCallsign = fullCallsign.replace(`${playerShipType(s).toLowerCase()} `, "");
      const displayId = String(visibleShipId(s) || "").toLowerCase();
      return s.id === normalized
        || s.id === raw.toLowerCase()
        || displayId === normalizedCallsign
        || displayId.replace(/-/g, "") === compactCallsign
        || fullCallsign === normalizedCallsign
        || shortCallsign === normalizedCallsign
        || shortCallsign.replace(/[-\s]/g, "") === compactCallsign;
    });
    if (!ship || (!includeDestroyed && shipDestroyed(ship))) return null;
    return {
      shipId: ship.id,
      interpretation: raw.toLowerCase() !== ship.id ? `Interpreting "${raw}" as "${visibleShipId(ship) || ship.id}".` : null,
    };
  }

  function npcKillLabel(npc) {
    if (!npc) return "unknown NPC";
    const location = npc.at ? ` @ ${nodeLabel(npc.at)}` : "";
    return `${npc.callsign || npc.id} (${npc.id})${location}`;
  }

  function resolveNpcToken(token) {
    const raw = String(token || "").trim();
    if (!raw) return null;
    const lowered = raw.toLowerCase();
    const compact = lowered.replace(/[-\s]/g, "");
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric > 0) {
      const byIndex = (state.civilianNpcs || [])[numeric - 1];
      if (byIndex) return { npcId: byIndex.id, label: npcKillLabel(byIndex), alreadyKilled: byIndex.combatStatus === "killed" };
    }
    const npc = (state.civilianNpcs || []).find((entry) => {
      const id = String(entry.id || "").toLowerCase();
      const callsign = String(entry.callsign || "").toLowerCase();
      const captain = String(entry.captainName || "").toLowerCase();
      return id === lowered
        || id.replace(/[-\s]/g, "") === compact
        || callsign === lowered
        || callsign.replace(/[-\s]/g, "") === compact
        || captain === lowered;
    });
    if (!npc) return null;
    return { npcId: npc.id, label: npcKillLabel(npc), alreadyKilled: npc.combatStatus === "killed" };
  }

  function resolveKillTarget(token) {
    const playerShip = resolveShipToken(token, { includeDestroyed: true });
    if (playerShip) {
      const ship = state.ships.find((entry) => entry.id === playerShip.shipId);
      return {
        type: "player",
        id: playerShip.shipId,
        label: visibleShipIdById(playerShip.shipId),
        alreadyKilled: shipDestroyed(ship),
      };
    }
    const npc = resolveNpcToken(token);
    if (npc) return { type: "npc", id: npc.npcId, label: npc.label, alreadyKilled: npc.alreadyKilled };
    return null;
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
      a: "assign",
      assign: "assign",
      f: "fleet",
      fleet: "fleet",
      ship: "fleet",
      ships: "fleet",
      s: "send",
      send: "send",
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

  function displayShipToken(shipId) {
    return visibleShipIdById(shipId);
  }

  function displayContractToken(contractId) {
    return String(contractId || "").toUpperCase();
  }

  function logInterpretedCommand(commandText) {
    logLine(`Interpreted command: ${commandText}`, "sys");
  }

  function resolveAssignArgs(firstToken, secondToken) {
    const firstShip = resolveShipToken(firstToken);
    const firstContract = resolveContractToken(firstToken);
    const secondShip = resolveShipToken(secondToken);
    const secondContract = resolveContractToken(secondToken);

    if (firstContract && secondShip) {
      return {
        shipId: secondShip.shipId,
        contractId: firstContract.contractId,
        interpretations: [firstContract.interpretation, secondShip.interpretation].filter(Boolean),
      };
    }
    if (firstShip && secondContract) {
      return {
        shipId: firstShip.shipId,
        contractId: secondContract.contractId,
        interpretations: [firstShip.interpretation, secondContract.interpretation].filter(Boolean),
      };
    }
    return null;
  }

  function completeAssignment(contractId, shipId) {
    const assigned = assignContract(contractId, shipId);
    if (!assigned) return false;
    state.selection.selectedShipId = null;
    state.selection.pending = "await_ship";
    logLine("Assignment uplinked. Returning to fleet.", "sys");
    showShipsList();
    return true;
  }

  function tryFlexibleCommandSequence(parts) {
    if (!Array.isArray(parts) || parts.length < 2) return false;
    const firstCommand = normalizeCommandWord(parts[0]);

    if (firstCommand === "assign") {
      if (parts.length >= 3) {
        const resolved = resolveAssignArgs(parts[1], parts[2]);
        if (!resolved) return false;
        logInterpretedCommand(`assign ${displayShipToken(resolved.shipId)} ${displayContractToken(resolved.contractId)}.`);
        resolved.interpretations.forEach((msg) => logLine(msg, "sys"));
        completeAssignment(resolved.contractId, resolved.shipId);
        return true;
      }
      if (parts.length >= 2 && state.selection.selectedShipId) {
        const resolvedContract = resolveContractToken(parts[1]);
        if (!resolvedContract) return false;
        logInterpretedCommand(`assign ${displayShipToken(state.selection.selectedShipId)} ${displayContractToken(resolvedContract.contractId)}.`);
        if (resolvedContract.interpretation) logLine(resolvedContract.interpretation, "sys");
        completeAssignment(resolvedContract.contractId, state.selection.selectedShipId);
        return true;
      }
    }

    if ((firstCommand === "fleet" || firstCommand === "select") && parts.length >= 2) {
      const shipTokenIndex = firstCommand === "fleet" ? 1 : 1;
      const resolvedShip = resolveShipToken(parts[shipTokenIndex]);
      if (!resolvedShip) return false;
      const shipId = resolvedShip.shipId;
      const selectedShip = displayShipToken(shipId);
      const nextCommandIndex = shipTokenIndex + 1;
      const nextCommand = normalizeCommandWord(parts[nextCommandIndex]);

      if (!parts[nextCommandIndex]) {
        logInterpretedCommand(`${firstCommand === "fleet" ? "fleet; " : ""}select ${selectedShip}.`);
        if (resolvedShip.interpretation) logLine(resolvedShip.interpretation, "sys");
        state.selection.selectedShipId = shipId;
        state.selection.pending = "ship_menu";
        showShipMenu(shipId);
        return true;
      }

      if (nextCommand === "assign" && parts[nextCommandIndex + 1]) {
        const resolvedContract = resolveContractToken(parts[nextCommandIndex + 1]);
        if (!resolvedContract) return false;
        logInterpretedCommand(`${firstCommand === "fleet" ? "fleet; " : ""}select ${selectedShip}; assign ${selectedShip} ${displayContractToken(resolvedContract.contractId)}.`);
        [resolvedShip.interpretation, resolvedContract.interpretation].filter(Boolean).forEach((msg) => logLine(msg, "sys"));
        completeAssignment(resolvedContract.contractId, shipId);
        return true;
      }

      if (nextCommand === "send" && parts[nextCommandIndex + 1]) {
        const destinationToken = parts[nextCommandIndex + 1];
        logInterpretedCommand(`${firstCommand === "fleet" ? "fleet; " : ""}select ${selectedShip}; send ${selectedShip} ${destinationToken}.`);
        if (resolvedShip.interpretation) logLine(resolvedShip.interpretation, "sys");
        sendShip(shipId, destinationToken);
        state.selection.selectedShipId = shipId;
        state.selection.pending = "ship_menu";
        showShipMenu(shipId);
        return true;
      }
    }

    if (firstCommand === "contracts" && parts.length >= 4) {
      const contractToken = parts[1];
      const nextCommand = normalizeCommandWord(parts[2]);
      if (nextCommand !== "assign") return false;
      const resolvedContract = resolveContractToken(contractToken);
      const resolvedShip = resolveShipToken(parts[3]);
      if (!resolvedContract || !resolvedShip) return false;
      logInterpretedCommand(`contracts; assign ${displayShipToken(resolvedShip.shipId)} ${displayContractToken(resolvedContract.contractId)}.`);
      [resolvedContract.interpretation, resolvedShip.interpretation].filter(Boolean).forEach((msg) => logLine(msg, "sys"));
      completeAssignment(resolvedContract.contractId, resolvedShip.shipId);
      return true;
    }

    return false;
  }

  function tryNumericSelection(numericInput) {
    const n = Number(numericInput);
    if (!Number.isInteger(n) || n < 1) return false;

    if (state.selection.pending === "await_ship") {
      const ship = state.ships[n - 1];
      if (!ship || shipDestroyed(ship)) return logLine("Invalid ship number.", "error");
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
        logLine("Assignment uplinked. Returning to fleet.", "sys");
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
    if (shipDestroyed(ship)) {
      logLine(`${visibleShipIdById(shipId)} is destroyed and unavailable.`, "error");
      state.selection.selectedShipId = null;
      state.selection.pending = "await_ship";
      return true;
    }

    if (letter === "a") {
      if (ship.utility) {
        logLine(`${visibleShipIdById(shipId)} cannot take cargo contracts. Use dock/send operations instead.`, "error");
        return true;
      }
      state.selection.pending = "await_contract";
      showContractsForSelectedShip();
      return true;
    }
    if (letter === "s") {
      if (ship.utility && ship.status === "docked") {
        logLine(`${visibleShipIdById(shipId)} is currently docked. Undock first.`, "error");
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
      logLine(`Dock ${visibleShipIdById(shipId)} to which ship?`, "sys");
      state.selection.dockableShipIds.forEach((targetId, idx) => {
        logLine(`${idx + 1}. ${visibleShipIdById(targetId)}`, "sys");
      });
      return true;
    }
    if (letter === "u") {
      if (!ship.utility || ship.status !== "docked") return true;
      undockUtilityShip(shipId);
      showShipMenu(shipId);
      return true;
    }
    if (letter === "i") {
      shipReport(shipId);
      showShipMenu(shipId);
      return true;
    }
    if (letter === "r") {
      if (typeof canRecallShip === "function" && !canRecallShip(shipId)) return false;
      recallShip(shipId);
      showShipMenu(shipId);
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
      logLine("help | status | comms | hail <name> | map [routes] | fleet | select <ship|number> | assign <contract> <ship> (either order; IDs or numbers) | send <ship> <destination> | pause", "sys");
      logLine("Global shortcuts: F fleet, C contracts, M map, H help.", "sys");
      logLine("Flexible chains: a B1 c3 or F 1 a 3. Console prints the interpreted command before executing.", "sys");
      logLine("Aliases: A assign, S send, contract/contracts, sel/select, B1/B-1, C1/C-1, Blue-1. Extra spaces and case are ignored.", "sys");
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
      logLine("Comms directory:", "sys");
      names.forEach((name) => {
        const factionRaw = state.dialogueDb?.[name]?.faction;
        const faction = String(factionRaw || "Independent").trim();
        logLine(`- ${name} [${faction}]`, speakerMessageType(name));
      });
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

    if (command === "fleet") {
      state.selection.selectedShipId = null;
      state.selection.pending = "await_ship";
      showShipsList();
      return true;
    }

    if (command === "select" && parts[1]) {
      const resolvedShip = resolveShipToken(parts[1]);
      if (!resolvedShip) logLine(`Could not resolve ship "${parts[1]}". Try a ship ID like B-1 or list number.`, "error");
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
      const resolved = resolveAssignArgs(parts[1], parts[2]);
      if (!resolved) {
        return logLine(
          `Could not resolve assign arguments "${parts[1]}" and "${parts[2]}". Use assign <contract> <ship> or assign <ship> <contract>.`,
          "error"
        );
      }

      resolved.interpretations.forEach((msg) => logLine(msg, "sys"));
      completeAssignment(resolved.contractId, resolved.shipId);
      return true;
    }

    if (command === "send" && parts.length >= 3) {
      const resolvedShip = resolveShipToken(parts[1]);
      if (!resolvedShip) return logLine(`Could not resolve ship "${parts[1]}". Try ship ID like B-1 or visible ship number.`, "error");
      if (resolvedShip.interpretation) logLine(resolvedShip.interpretation, "sys");
      sendShip(resolvedShip.shipId, parts[2]);
      return true;
    }

    if (command === "dbstress") {
      const index = Number(parts[1]);
      if (!Number.isInteger(index) || index <= 0) return logLine('Usage: dbStress [dbConflict pair number]', "error");
      const lines = typeof bumpNpcConflictStress === "function" ? bumpNpcConflictStress(index) : [];
      if (!lines?.length) return logLine("dbStress: stress debug feed unavailable.", "error");
      lines.forEach((line) => logLine(line, "sys"));
      return true;
    }

    if (command === "dbnpc") {
      const npcs = Array.isArray(state.civilianNpcs) ? state.civilianNpcs : [];
      if (!npcs.length) {
        logLine("dbNPC: no NPCs currently tracked.", "sys");
        return true;
      }
      logLine("dbNPC: NPC positions", "sys");
      npcs.forEach((npc, idx) => {
        const destinationLabel = npc.destination ? ` -> ${nodeLabel(npc.destination)}` : "";
        const ambient = npc.ambientLocationSpawn ? ` | local ${npc.registryKey || npc.role || "traffic"}` : "";
        const identity = typeof formatNpcShipIdentity === "function"
          ? formatNpcShipIdentity(npc)
          : `${npc.captainName || "Capt. Unassigned"} [${npc.callsign}, ${nodeLabel(npc.at)} (${npc.status})]`;
        logLine(`${idx + 1}. ${identity}${destinationLabel}${ambient}`, "sys");
      });
      return true;
    }
    if (command === "dbconflict") {
      const lines = typeof npcConflictDebugLines === "function" ? npcConflictDebugLines() : [];
      if (!lines?.length) {
        logLine("dbConflict: conflict debug feed unavailable.", "sys");
        return true;
      }
      lines.forEach((line) => logLine(line, "sys"));
      logLine('Debug: type "dbStress [number]" to add +0.40 stress to a listed pair.', "sys");
      return true;
    }

    if (command === "dbdock") {
      const lines = typeof dockDebugLines === "function" ? dockDebugLines() : [];
      if (!lines?.length) {
        logLine("dbDock: dock debug feed unavailable.", "sys");
        return true;
      }
      lines.forEach((line) => logLine(line, "sys"));
      return true;
    }

    if (command === "dbheat") {
      const lines = typeof factionHeatDebugLines === "function" ? factionHeatDebugLines() : [];
      if (!lines?.length) {
        logLine("dbHeat: faction heat debug feed unavailable.", "sys");
        return true;
      }
      lines.forEach((line) => logLine(line, "sys"));
      return true;
    }

    if (command === "dbkill") {
      if (typeof debugKillPlayerShip !== "function" && typeof debugKillNpc !== "function") {
        logLine("dbKill: debug ship killer unavailable.", "error");
        return true;
      }
      const target = resolveKillTarget(parts.slice(1).join(" "));
      if (!target) {
        logLine('Usage: dbKill [ship ID or NPC ID]', "error");
        return true;
      }
      if (target.alreadyKilled) {
        logLine(`dbKill: ${target.label} is already destroyed/killed or unavailable.`, "sys");
        return true;
      }
      state.selection.pending = "confirm_dbkill";
      state.selection.debugKillTarget = target;
      logLine(`dbKill: kill ${target.label}? Type y to confirm or n to cancel.`, "alert");
      return true;
    }

    if (command === "dbcamp") {
      if (typeof launchFactionCampaign !== "function") {
        logLine("dbCamp: campaign debug launcher unavailable.", "error");
        return true;
      }
      launchFactionCampaign().forEach((line) => logLine(line, "sys"));
      return true;
    }

    if (command === "dbwarm") {
      if (typeof warmFactionHeat !== "function") {
        logLine("dbWarm: faction heat debug feed unavailable.", "error");
        return true;
      }
      const args = parts.slice(1);
      if (!args.length) {
        logLine('Usage: dbwarm [faction] [amount] (example: dbwarm blister 25)', "error");
        return true;
      }
      const firstAmount = Number(args[0]);
      const lastAmount = Number(args[args.length - 1]);
      const amountFirst = Number.isFinite(firstAmount);
      const amountLast = args.length > 1 && Number.isFinite(lastAmount);
      const faction = amountFirst
        ? args.slice(1).join(" ")
        : amountLast
          ? args.slice(0, -1).join(" ")
          : args.join(" ");
      const amount = amountFirst ? firstAmount : amountLast ? lastAmount : 25;
      if (!faction || !Number.isFinite(amount)) {
        logLine('Usage: dbwarm [faction] [amount] (example: dbwarm blister 25)', "error");
        return true;
      }
      warmFactionHeat(faction, amount).forEach((line) => logLine(line, "sys"));
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

    if (state.selection.pending === "confirm_dbkill") {
      if (lower === "y" || lower === "yes") {
        const target = state.selection.debugKillTarget;
        state.selection.pending = "await_ship";
        state.selection.debugKillTarget = null;
        const lines = target?.type === "npc"
          ? (typeof debugKillNpc === "function" ? debugKillNpc(target.id) : ["dbKill: NPC debug killer unavailable."])
          : (typeof debugKillPlayerShip === "function" ? debugKillPlayerShip(target?.id) : ["dbKill: player ship debug killer unavailable."]);
        lines.forEach((line) => logLine(line, "sys"));
        state.respondingToCommand = false;
        return;
      }
      if (lower === "n" || lower === "no") {
        state.selection.pending = "await_ship";
        state.selection.debugKillTarget = null;
        logLine("dbKill cancelled.", "sys");
        state.respondingToCommand = false;
        return;
      }
      logLine("dbKill: type y to confirm or n to cancel.", "error");
      state.respondingToCommand = false;
      return;
    }

    if (tryFlexibleCommandSequence(parts)) {
      state.respondingToCommand = false;
      return;
    }

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
          logLine("Assignment uplinked. Returning to fleet.", "sys");
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

    if (!handleLongForm(parts)) logLine("Unknown input. Try: fleet or help", "error");
    state.respondingToCommand = false;
  }

  return {
    handleCommand,
  };
}
