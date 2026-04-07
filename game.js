let nodes = {};
let edges = [];

const TUTORIAL_GOAL = 3;
const BASIL_NAME = "BASIL";
const BUDDE_NAME = "BUDDE";
const PLAYER_NODE = "anchor_station";
const LEGACY_NODE_ALIASES = {
  anchor: "anchor_station",
  cinder_hub: "refinery",
  mirrorgate: "ufp_outpost_delta",
  ninth_moon: "yard",
  frostline: "indigo_station",
  driftbay: "deep_space_transfer_lane",
};
const DEFAULT_LORE_SUMMARY =
  "Indigo is a deuterium-rich war-zone logistics system. bluFreight profits from stable volatility while juggling UFP pressure, Arcworks inspections, Blister deals, and insurance-driven risk management.";

const SHIP_CAPTAINS = {
  "hauler-1": "Capt. Soren Nnadi",
  "hauler-2": "Capt. Tamsin Rook",
  "courier-1": "Capt. Laleh Mercer",
};
const DEFAULT_SPEAKER_STATUS = "on-station";
const SPEAKER_PROFILES = {
  BASIL: { location: "Dispatch Core", status: "active" },
  BUDDE: { location: "Navigation Layer", status: "active" },
  "Cmdr. Elias Thorne": { location: "UFP Patrol Group", status: DEFAULT_SPEAKER_STATUS },
  "Capt. Hadrik Venn": { location: "Blister Trade Lane", status: DEFAULT_SPEAKER_STATUS },
  "Port Marshal Celia Wren": { location: "Anchor Station Docks", status: DEFAULT_SPEAKER_STATUS },
  "Inspector Dey Arcos": { location: "Arcworks Transit Authority", status: DEFAULT_SPEAKER_STATUS },
};

const state = {
  tick: 0,
  running: true,
  cash: 2200,
  rep: 58,
  risk: 22,
  escort: false,
  contracts: [],
  completedContracts: 0,
  tutorialDone: false,
  ships: [
    { id: "hauler-1", at: "anchor_station", status: "idle", busyUntil: 0, departAt: 0, lastKnownAt: "anchor_station", lastContactTick: 0 },
    { id: "hauler-2", at: "refinery", status: "idle", busyUntil: 0, departAt: 0, lastKnownAt: "refinery", lastContactTick: 0 },
    { id: "courier-1", at: "indigo_station", status: "idle", busyUntil: 0, departAt: 0, lastKnownAt: "indigo_station", lastContactTick: 0 },
  ],
  delayedMessages: [],
  nextContract: 1,
  selection: {
    selectedShipId: null,
    pending: null,
  },
  loreSummary: DEFAULT_LORE_SUMMARY,
  dialogueDb: {},
  latencyBriefed: false,
  lastAmbientLine: null,
  mapData: null,
  buddeData: null,
};

const ui = {
  clock: document.getElementById("clock"),
  cash: document.getElementById("cash"),
  rep: document.getElementById("rep"),
  risk: document.getElementById("risk"),
  escort: document.getElementById("escort"),
  contracts: document.getElementById("contracts"),
  fleet: document.getElementById("fleet"),
  feed: document.getElementById("feed"),
  cmdForm: document.getElementById("cmd-form"),
  cmdInput: document.getElementById("cmd"),
};

let adjacency = {};

function buildGraph() {
  const graph = {};
  Object.keys(nodes).forEach((k) => {
    graph[k] = [];
  });
  edges.forEach(([a, b, w]) => {
    graph[a].push({ to: b, cost: w });
    graph[b].push({ to: a, cost: w });
  });
  return graph;
}


function angleDelta(a, b) {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

function estimateRouteCost(fromNode, toNode, layer0) {
  if (fromNode.id === toNode.id) return 0;
  if (fromNode.moon === toNode.moon) {
    return Math.max(1, 2 + Math.round((fromNode.approach + toNode.approach) / 3));
  }

  const moonA = layer0.moons[fromNode.moon];
  const moonB = layer0.moons[toNode.moon];
  const orbitBands = layer0.orbits;
  const orbitDelta = Math.abs((orbitBands[moonA.orbit] || 1) - (orbitBands[moonB.orbit] || 1));
  const arc = angleDelta(moonA.angle, moonB.angle);
  const arcCost = Math.max(1, Math.round(arc / 30));
  const approachVariance = Math.round((fromNode.approach + toNode.approach) / 4);
  return Math.max(2, arcCost + orbitDelta * 2 + approachVariance);
}

function buildCanonicalTutorialMap(mapData) {
  const scenario = mapData?.layer1?.tutorialScenario;
  const layer0 = mapData?.layer0;
  if (!scenario || !layer0) return false;

  const builtNodes = {};
  const locationEntries = [];
  Object.entries(scenario.activeMoons || {}).forEach(([moonId, moon]) => {
    Object.entries(moon.locations || {}).forEach(([locId, location]) => {
      builtNodes[locId] = {
        label: location.name,
        moon: moonId,
        moonName: moon.name,
        approach: location.approach,
      };
      locationEntries.push({ id: locId, moon: moonId, approach: location.approach });
    });
  });

  if (!Object.keys(builtNodes).length) return false;

  const builtEdges = [];
  for (let i = 0; i < locationEntries.length; i += 1) {
    for (let j = i + 1; j < locationEntries.length; j += 1) {
      const a = locationEntries[i];
      const b = locationEntries[j];
      const cost = estimateRouteCost(a, b, layer0);
      builtEdges.push([a.id, b.id, cost]);
    }
  }

  nodes = builtNodes;
  edges = builtEdges;
  adjacency = buildGraph();
  return true;
}

function nodeLabel(nodeId) {
  const node = nodes[nodeId];
  if (!node) return nodeId;
  return `${node.label}${node.moonName ? ` (${node.moonName})` : ""}`;
}

function normalizeNodeInput(rawNodeId) {
  if (!rawNodeId) return null;
  if (nodes[rawNodeId]) return rawNodeId;
  const alias = LEGACY_NODE_ALIASES[rawNodeId];
  if (alias && nodes[alias]) return alias;
  return null;
}

function pickBuddeLine(bucket) {
  const lines = state.buddeData?.budde?.sampleLines?.[bucket];
  if (!lines?.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

function buddeSpeak(bucket, fallback, type = "budde") {
  const text = pickBuddeLine(bucket) || fallback;
  const context = speakerContext(BUDDE_NAME);
  logLine(`${BUDDE_NAME} ${context}: ${text}`, type);
}

function buddeInform(text, type = "budde") {
  const context = speakerContext(BUDDE_NAME);
  logLine(`${BUDDE_NAME} ${context}: ${text}`, type);
}

function adviseContractOptions(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  const contracts = openContracts();
  if (!ship || contracts.length < 1) return;

  const scored = contracts.map((c) => {
    const reposition = routeDistance(ship.at, c.from);
    const delivery = routeDistance(c.from, c.to);
    return { contract: c, total: reposition + delivery, reposition, delivery };
  }).sort((a, b) => a.total - b.total);

  const best = scored[0];
  const alt = scored[1];
  const bestLabel = `${best.contract.id} (${nodeLabel(best.contract.from)} → ${nodeLabel(best.contract.to)})`;
  if (alt) {
    const savings = Math.max(1, Math.round(((alt.total - best.total) / alt.total) * 100));
    buddeInform(`Contract routing options available. Recommend ${bestLabel}. Fastest mission profile by ${savings}% versus ${alt.contract.id}.`);
  } else {
    buddeInform(`Only one contract route available: ${bestLabel}. No alternate optimization path.`);
  }

  const destinationApproach = nodes[best.contract.to]?.approach || 0;
  if (destinationApproach >= 7) {
    buddeSpeak("highVarianceApproach", "Destination approach variance is high. Treat ETA as an estimate, not a promise.");
  }
}

function adviseDestinationOptions(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return;

  const choices = Object.keys(nodes)
    .filter((nodeId) => nodeId !== ship.at)
    .map((nodeId) => ({ nodeId, distance: routeDistance(ship.at, nodeId) }))
    .sort((a, b) => a.distance - b.distance);

  if (!choices.length) return;
  const best = choices[0];
  const alt = choices[1];
  if (alt) {
    const savings = Math.max(1, Math.round(((alt.distance - best.distance) / alt.distance) * 100));
    buddeInform(`Destination options available. Recommend ${nodeLabel(best.nodeId)}. Transit is ${savings}% shorter than ${nodeLabel(alt.nodeId)}.`);
  } else {
    buddeInform(`Single reachable destination candidate: ${nodeLabel(best.nodeId)}.`);
  }

  if ((nodes[best.nodeId]?.approach || 0) >= 7) {
    buddeSpeak("highVarianceApproach", "Local approach spread is high at this destination. Expect variable final timing.");
  }
}

function fmtTime(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stylizeConsoleText(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/(^|\s)(\d+\.)/g, '$1<span class="choice">$2</span>')
    .replace(/(^|\s)([ASRB]\.)/g, '$1<span class="choice">$2</span>')
    .replace(/(^|\s)(A|S|R|B)(?=\s|$)/g, '$1<span class="choice">$2</span>');
}

function logLine(text, type = "sys") {
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
}

function pickLine(characterName, bucket) {
  const actor = state.dialogueDb[characterName];
  const choices = actor?.dialogue?.[bucket];
  if (!choices?.length) return null;
  return choices[Math.floor(Math.random() * choices.length)];
}

function formatShipId(shipId) {
  return shipId
    .split("-")
    .map((chunk) => (Number.isNaN(Number(chunk)) ? `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}` : chunk))
    .join("-");
}

function speakerContext(name, statusOverride) {
  const shipId = Object.keys(SHIP_CAPTAINS).find((id) => SHIP_CAPTAINS[id] === name);
  if (shipId) {
    const ship = state.ships.find((s) => s.id === shipId);
    if (!ship) return "";
    const status = statusOverride || (ship.status === "enroute" ? "in transit" : DEFAULT_SPEAKER_STATUS);
    const location = ship.status === "enroute" && ship.destination ? nodeLabel(ship.destination) : nodeLabel(ship.at);
    if (status === DEFAULT_SPEAKER_STATUS) return `[${formatShipId(shipId)}, ${location}]`;
    return `[${formatShipId(shipId)}, ${location} (${status})]`;
  }

  const profile = SPEAKER_PROFILES[name];
  if (!profile) return "";
  const status = statusOverride || profile.status || DEFAULT_SPEAKER_STATUS;
  if (status === DEFAULT_SPEAKER_STATUS) return `[${profile.location}]`;
  return `[${profile.location} (${status})]`;
}

function basilSpeak(bucket, fallback, type = "basil") {
  const text = pickLine(BASIL_NAME, bucket) || fallback;
  const context = speakerContext(BASIL_NAME);
  logLine(`${BASIL_NAME} ${context}: ${text}`, type);
}

function basilInform(text, type = "basil") {
  const context = speakerContext(BASIL_NAME);
  logLine(`${BASIL_NAME} ${context}: ${text}`, type);
}

function characterSpeak(characterName, bucket, fallback, type = "comms", statusOverride = null) {
  const text = pickLine(characterName, bucket) || fallback;
  const context = speakerContext(characterName, statusOverride);
  logLine(`${characterName} ${context}: ${text}`, type);
}

function queueCharacterMessage(delay, characterName, bucket, fallback, type = "comms", statusOverride = null) {
  scheduleMessage(delay, () => {
    const context = speakerContext(characterName, statusOverride);
    const text = pickLine(characterName, bucket) || fallback;
    return `${characterName} ${context}: ${text}`;
  }, type);
}

async function loadReferenceData() {
  try {
    const [loreResponse, dialogueResponse, mapResponse, buddeResponse] = await Promise.all([
      fetch("./bluFreight%20text%20RTS.txt"),
      fetch("./indigo_dialogue_characters.json"),
      fetch("./map.json"),
      fetch("./budde.json"),
    ]);

    if (loreResponse.ok) {
      const loreText = await loreResponse.text();
      const condensed = loreText.replace(/\s+/g, " ").trim();
      if (condensed.length) state.loreSummary = condensed.slice(0, 340);
    }

    if (dialogueResponse.ok) {
      state.dialogueDb = await dialogueResponse.json();
    }

    if (mapResponse.ok) {
      state.mapData = await mapResponse.json();
      const loaded = buildCanonicalTutorialMap(state.mapData);
      if (!loaded) logLine("Map load warning: tutorial layer unavailable. Using fallback graph.", "error");
    }

    if (buddeResponse.ok) {
      state.buddeData = await buddeResponse.json();
    }
  } catch (err) {
    logLine(`Reference load fallback active (${err?.message || "unknown error"}).`, "sys");
  }
}

function routeDistance(from, to, visited = new Set()) {
  if (from === to) return 0;
  visited.add(from);
  const choices = (adjacency[from] || [])
    .filter((n) => !visited.has(n.to))
    .map((n) => {
      const sub = routeDistance(n.to, to, new Set(visited));
      return sub === Infinity ? Infinity : n.cost + sub;
    });
  return choices.length ? Math.min(...choices) : Infinity;
}

function scheduleMessage(delay, textOrFactory, type = "report") {
  state.delayedMessages.push({ at: state.tick + delay, text: textOrFactory, type });
}

function oneWaySignalToNode(nodeId) {
  return Math.max(1, routeDistance(PLAYER_NODE, nodeId));
}

function oneWaySignalToShip(ship) {
  return oneWaySignalToNode(ship.lastKnownAt || ship.at);
}

function basilShipIntel(ship) {
  const knownNode = ship.lastKnownAt || ship.at;
  const knownLabel = nodeLabel(knownNode);
  const age = state.tick - (ship.lastContactTick || 0);
  const heading = ship.destination ? `Presumed heading: ${nodeLabel(ship.destination)}.` : "No active heading.";
  return `${formatShipId(ship.id)} last confirmed at ${knownLabel} (${age}s ago). ${heading}`;
}

function basilCommsLatencyLine(ship, commandNoun = "orders") {
  if (!ship) return;
  const captain = SHIP_CAPTAINS[ship.id] || "the assigned captain";
  const uplink = oneWaySignalToShip(ship);
  const rtt = uplink * 2;
  basilInform(
    `Contacting ${captain}. They will receive these ${commandNoun} in ${uplink} seconds. We can expect an acknowledgement in ${rtt} seconds... unless something has happened to their squishy and unreliable human body.`,
    "basil"
  );
  if (!state.tutorialDone) state.latencyBriefed = true;
}

function generateContract() {
  const origins = Object.keys(nodes);
  if (origins.length < 2) return;
  const from = origins[Math.floor(Math.random() * origins.length)];
  let to = from;
  while (to === from) to = origins[Math.floor(Math.random() * origins.length)];

  state.contracts.push({
    id: `C-${state.nextContract++}`,
    from,
    to,
    payout: 300 + Math.floor(Math.random() * 160),
    status: "open",
  });
}

function openContracts() {
  return state.contracts.filter((c) => c.status === "open");
}

function idleShip(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  return ship && ship.status === "idle";
}

function render() {
  ui.clock.textContent = fmtTime(state.tick);
  ui.cash.textContent = String(state.cash);
  ui.rep.textContent = String(state.rep);
  ui.risk.textContent = String(state.risk);
  ui.escort.textContent = state.escort ? "On" : "Off";

  ui.contracts.innerHTML = "";
  openContracts().slice(0, 7).forEach((c, idx) => {
    const li = document.createElement("li");
    li.textContent = `${idx + 1}. ${c.id} ${nodeLabel(c.from)} → ${nodeLabel(c.to)} | +$${c.payout}`;
    ui.contracts.appendChild(li);
  });
  if (!ui.contracts.children.length) {
    const li = document.createElement("li");
    li.textContent = state.tutorialDone ? "Tutorial complete. No required contracts left." : "No open contracts.";
    ui.contracts.appendChild(li);
  }

  ui.fleet.innerHTML = "";
  state.ships.forEach((s, idx) => {
    const li = document.createElement("li");
    li.textContent = `${idx + 1}. ${s.id} @ ${nodeLabel(s.at)} | ${s.status}`;
    ui.fleet.appendChild(li);
  });
}

function showShipsList() {
  state.ships.forEach((s, idx) => {
    const captain = SHIP_CAPTAINS[s.id] || "Unassigned Captain";
    logLine(`${idx + 1}. ${s.id} (${s.status}) @ ${s.at} | ${captain}`, "sys");
  });
  logLine("Pick ship number or: select <ship-id>", "sys");
}

function showShipMenu(shipId) {
  logLine(`${shipId} selected (submenu mode). Valid inputs: A assign, S send, R report, B back to ship list.`, "sys");
}

function showContractsForSelectedShip() {
  const contracts = openContracts();
  if (!contracts.length) return logLine("No open contracts to assign.", "sys");
  logLine(`Assign ${state.selection.selectedShipId} to what contract?`, "sys");
  adviseContractOptions(state.selection.selectedShipId);
  contracts.forEach((c, idx) => logLine(`${idx + 1}. ${c.id} ${nodeLabel(c.from)} -> ${nodeLabel(c.to)} (+$${c.payout})`, "sys"));
  logLine("Pick number or contract ID.", "sys");
}

function showDestinationsForSelectedShip() {
  logLine(`Send ${state.selection.selectedShipId} to what destination?`, "sys");
  adviseDestinationOptions(state.selection.selectedShipId);
  Object.keys(nodes).forEach((nodeId, idx) => {
    logLine(`${idx + 1}. ${nodeId} (${nodeLabel(nodeId)})`, "sys");
  });
  logLine("Pick number or destination ID.", "sys");
}

function shipReport(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine("Selected ship is unavailable.", "error");
  const uplink = oneWaySignalToShip(ship);
  const rtt = uplink * 2;
  const eta = ship.status === "enroute" || ship.status === "tasked" ? Math.max(0, ship.busyUntil - state.tick) : 0;
  const staleNote = ship.status === "enroute" || ship.status === "tasked"
    ? "Ship is in transit; displayed position may be stale until reply arrives."
    : "Position should remain current while on-station.";
  basilInform(`${basilShipIntel(ship)} Report requested. Reply expected in ${rtt}s (uplink ${uplink}s each way). ${staleNote}`);
  scheduleMessage(rtt, `Report ${ship.id}: status=${ship.status}, lastKnown=${ship.lastKnownAt || ship.at}, eta=${eta}s (RTT ${rtt}s).`, "report");
  const captain = SHIP_CAPTAINS[ship.id];
  if (captain) {
    queueCharacterMessage(rtt, captain, "neutral", "Responding after comms delay. Standing by for tasking.", "comms");
  }
}

function scheduleTransitComms(ship, destination, distance, uplink) {
  const midpoint = Math.max(1, Math.floor(distance / 2));
  const captain = SHIP_CAPTAINS[ship.id];
  scheduleMessage(
    uplink + midpoint + oneWaySignalToNode(destination),
    `${ship.id} update: passing relay corridor toward ${nodeLabel(destination)}.`,
    "report"
  );
  if (captain) {
    queueCharacterMessage(
      uplink + midpoint + oneWaySignalToNode(destination),
      captain,
      "neutral",
      "Route remains stable.",
      "comms",
      "arriving"
    );
  }
  scheduleMessage(
    uplink + distance + oneWaySignalToNode(destination),
    `${ship.id} final: arrived at ${nodeLabel(destination)}. Awaiting dispatch.`,
    "report"
  );
  if (captain) {
    queueCharacterMessage(
      uplink + distance + oneWaySignalToNode(destination),
      captain,
      "acknowledgements",
      "On station.",
      "comms"
    );
  }
}

function sendShip(shipId, destination) {
  const ship = state.ships.find((s) => s.id === shipId);
  const normalizedDestination = normalizeNodeInput(destination);
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  if (!normalizedDestination) return logLine(`Unknown destination: ${destination}.`, "error");
  if (ship.status !== "idle") return logLine(`${ship.id} is busy.`, "error");

  const uplink = oneWaySignalToShip(ship);
  const distance = routeDistance(ship.at, normalizedDestination);
  const alternatives = Object.keys(nodes).filter((n) => n !== ship.at && n !== normalizedDestination).map((nodeId) => ({ nodeId, distance: routeDistance(ship.at, nodeId) })).sort((a, b) => a.distance - b.distance);
  if (alternatives[0]) {
    const savingsVsAlt = Math.round(((alternatives[0].distance - distance) / Math.max(1, alternatives[0].distance)) * 100);
    if (savingsVsAlt < 0) {
      buddeSpeak("objections", "Selected destination is not the shortest viable route.");
      buddeInform(`Alternative available: ${nodeLabel(alternatives[0].nodeId)} at ${alternatives[0].distance}s versus selected ${distance}s.`);
    } else {
      buddeSpeak("recommendations", `Selected route accepted. Efficiency delta +${savingsVsAlt}% versus nearest alternative.`);
    }
  }
  basilCommsLatencyLine(ship, "orders");
  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + distance;
  ship.destination = normalizedDestination;
  ship.lastContactTick = state.tick;

  const effectiveRisk = state.risk + (state.escort ? -10 : 8);
  if (Math.random() * 100 < effectiveRisk * 0.3) {
    scheduleMessage(
      uplink + distance + oneWaySignalToNode(normalizedDestination),
      `${ship.id} detained briefly at ${nodeLabel(normalizedDestination)}. Cargo released after inspection.`,
      "alert"
    );
    state.cash -= 70;
    state.rep -= 1;
    const arcworksInspector = "Inspector Dey Arcos";
    scheduleMessage(
      uplink + Math.max(1, distance - 1) + oneWaySignalToNode(normalizedDestination),
      `${arcworksInspector} ${speakerContext(arcworksInspector, "interdicting")}: ${
        pickLine(arcworksInspector, "neutral") || "Transit reviewed under local claim."
      }`,
      "comms",
    );
    basilSpeak("negative", `Order logged. ${ship.id} risk profile elevated.`, "basil");
  } else {
    scheduleTransitComms(ship, normalizedDestination, distance, uplink);
    state.rep = Math.min(100, state.rep + 1);
    const captain = SHIP_CAPTAINS[ship.id];
    if (captain) {
      queueCharacterMessage(uplink * 2, captain, "acknowledgements", "Order received and executing.", "comms");
    }
  }

  logLine(`Transmission sent: ${ship.id} -> ${destination}. Uplink ${uplink}s, transit ${distance}s.`, "dispatch");
  const reportLag = oneWaySignalToNode(normalizedDestination);
  basilInform(
    `Timing estimate: uplink ${uplink}s + transit ${distance}s + return signal ${reportLag}s = ${uplink + distance + reportLag}s until arrival is confirmed here.`
  );
  return true;
}

function assignContract(contractId, shipId) {
  const contract = state.contracts.find((c) => c.id.toLowerCase() === contractId.toLowerCase() && c.status === "open");
  if (!contract) return logLine(`Contract ${contractId} not found/open.`, "error");
  if (!idleShip(shipId)) return logLine(`${shipId} is not idle.`, "error");

  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  const uplink = oneWaySignalToShip(ship);
  basilCommsLatencyLine(ship, "orders");
  const toPickup = routeDistance(ship.at, contract.from);
  const toDrop = routeDistance(contract.from, contract.to);
  const total = toPickup + toDrop;
  const comparison = openContracts().filter((c) => c.id !== contract.id).map((c) => ({ id: c.id, total: routeDistance(ship.at, c.from) + routeDistance(c.from, c.to) })).sort((a, b) => a.total - b.total)[0];
  if (comparison && comparison.total < total) {
    buddeSpeak("objections", "Current assignment is not top efficiency.");
    buddeInform(`${comparison.id} would complete in ${comparison.total}s versus ${contract.id} at ${total}s. Maintaining your selected order.`);
  } else {
    buddeSpeak("recommendations", `Assignment ${contract.id} accepted. Current route is within optimal tolerance.`);
  }

  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + total;
  ship.destination = contract.to;
  contract.status = "assigned";

  logLine(`Transmission sent: ${ship.id} to ${contract.id}. Uplink ${uplink}s + mission ${total}s.`, "dispatch");
  const returnSignal = oneWaySignalToNode(contract.to);
  basilInform(
    `${formatShipId(ship.id)} mission timing: uplink ${uplink}s, reposition ${toPickup}s to pickup, contract leg ${toDrop}s, return signal ${returnSignal}s. Confirmation ETA: ${uplink + total + returnSignal}s.`
  );
  const captain = SHIP_CAPTAINS[ship.id];
  if (captain) {
    queueCharacterMessage(uplink * 2, captain, "acknowledgements", "Proceeding as ordered.", "comms");
  }
  scheduleMessage(
    uplink + Math.max(1, Math.floor(total / 2)) + oneWaySignalToNode(contract.to),
    `${ship.id} mid-route check-in for ${contract.id}: cargo stable.`,
    "report"
  );
  scheduleMessage(
    uplink + total + oneWaySignalToNode(contract.to),
    `${ship.id} delivered ${contract.id} at ${nodeLabel(contract.to)}.`,
    "report"
  );
  if (captain) {
    queueCharacterMessage(uplink + total + oneWaySignalToNode(contract.to), captain, "positive", "Delivery complete.");
  }

  state.cash += contract.payout - (state.escort ? 60 : 0);
  state.rep = Math.min(100, state.rep + 2);
  state.risk = Math.max(8, state.risk - 1);
  state.completedContracts += 1;

  if (!state.tutorialDone && state.completedContracts >= TUTORIAL_GOAL) {
    state.tutorialDone = true;
    logLine("Tutorial complete: 3 contracts delivered.", "sys");
    basilSpeak("positive", "Tutorial objectives complete. Dispatch confidence adjusted upward.", "basil");
  }
  return true;
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
    logLine("help | status | lore | factions | comms | hail <name> | map | ships | select <ship> | assign <contract> <ship> | send <ship> <destination> | escort on/off | pause", "sys");
    return true;
  }

  if (parts[0] === "status") {
    logLine(`Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Tutorial ${state.completedContracts}/${TUTORIAL_GOAL}`, "sys");
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
    const names = Object.keys(state.dialogueDb);
    if (!names.length) return logLine("Comms directory unavailable.", "error");
    logLine(`Comms directory: ${names.join(" | ")}`, "sys");
    return true;
  }

  if (parts[0] === "hail" && parts.length >= 2) {
    const query = inputToName(parts.slice(1).join(" "));
    if (!query) return logLine("Usage: hail <character-name>", "error");
    characterSpeak(query, "greetings", "Channel open.", "comms");
    return true;
  }

  if (parts[0] === "map") {
    logLine("Layer 1 tutorial locations visible to player:", "sys");
    Object.entries(nodes).forEach(([id, node]) => {
      logLine(`- ${id}: ${nodeLabel(id)} | approach ${node.approach ?? "n/a"}`, "sys");
    });
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
    openContracts().forEach((c, idx) => logLine(`${idx + 1}. ${c.id} ${nodeLabel(c.from)} -> ${nodeLabel(c.to)}, $${c.payout}`, "sys"));
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

  logLine(`> ${raw}`, "cmd");
  const lower = input.toLowerCase();
  const parts = lower.split(/\s+/);

  if (tryNumericSelection(lower) !== false) return;

  if (state.selection.pending === "ship_menu" && lower.length === 1 && handleShipMenuLetter(lower)) return;

  if (state.selection.pending === "await_contract") {
    const contract = openContracts().find((c) => c.id.toLowerCase() === lower);
    if (contract) {
      const assigned = assignContract(contract.id, state.selection.selectedShipId);
      if (assigned) {
        state.selection.selectedShipId = null;
        state.selection.pending = "await_ship";
        logLine("Assignment uplinked. Returning to ship list.", "sys");
        return showShipsList();
      }
      return true;
    }
  }

  if (state.selection.pending === "await_destination") {
    const normalized = normalizeNodeInput(lower);
    if (normalized) {
      sendShip(state.selection.selectedShipId, normalized);
      state.selection.pending = "ship_menu";
      return showShipMenu(state.selection.selectedShipId);
    }
  }

  if (!handleLongForm(parts)) logLine("Unknown input. Try: ships or help", "error");
}

function inputToName(input) {
  const candidates = Object.keys(state.dialogueDb);
  if (!candidates.length) return null;
  const exact = candidates.find((n) => n.toLowerCase() === input.toLowerCase());
  if (exact) return exact;
  return candidates.find((n) => n.toLowerCase().includes(input.toLowerCase())) || null;
}

function updateSimulation() {
  state.ships.forEach((ship) => {
    if (ship.status === "tasked" && state.tick >= ship.departAt) {
      ship.status = "enroute";
    }
    if (ship.status === "enroute" && state.tick >= ship.busyUntil) {
      ship.at = ship.destination;
      ship.destination = undefined;
      ship.status = "idle";
      ship.departAt = 0;
      ship.lastKnownAt = ship.at;
      ship.lastContactTick = state.tick;
    }
  });

  const due = state.delayedMessages.filter((m) => m.at <= state.tick);
  due.forEach((m) => {
    const text = typeof m.text === "function" ? m.text() : m.text;
    logLine(text, m.type);
  });
  state.delayedMessages = state.delayedMessages.filter((m) => m.at > state.tick);

  if (!state.tutorialDone && openContracts().length < 4 && state.tick % 10 === 0) generateContract();

  if (state.tick % 30 === 0) {
    state.risk += Math.random() < 0.5 ? 1 : -1;
    state.risk = Math.max(8, Math.min(70, state.risk));
  }

  if (state.tick % 45 === 0) {
    const ambient = ["Cmdr. Elias Thorne", "Capt. Hadrik Venn", "Port Marshal Celia Wren"];
    const speaker = ambient[Math.floor(Math.random() * ambient.length)];
    const tone = state.risk >= 35 ? "negative" : "neutral";
    const line = pickLine(speaker, tone) || "Traffic conditions noted.";
    if (line !== state.lastAmbientLine) {
      state.lastAmbientLine = line;
      scheduleMessage(1, () => `${speaker} ${speakerContext(speaker)}: ${line}`, "comms");
    }
  }

  if (state.cash <= -600 || state.rep <= 0) {
    logLine("bluFreight insolvency event. Simulation halted.", "alert");
    state.running = false;
  }
}

ui.cmdForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(ui.cmdInput.value);
  ui.cmdInput.value = "";
  render();
});

async function init() {
  await loadReferenceData();
  if (!Object.keys(nodes).length) {
    nodes = {
      anchor_station: { label: "Anchor Station", moonName: "Cat's Eye", approach: 2 },
      refinery: { label: "Refinery", moonName: "Oxblood", approach: 3 },
      indigo_station: { label: "Indigo Station", moonName: "Sulphide", approach: 4 },
    };
    edges = [["anchor_station", "refinery", 6], ["refinery", "indigo_station", 7], ["anchor_station", "indigo_station", 8]];
    adjacency = buildGraph();
  }
  generateContract();
  generateContract();
  state.selection.pending = "await_ship";
  basilSpeak("greetings", "Dispatch online.", "basil");
  buddeSpeak("greetings", "Navigation layer active. Route options available.", "budde");
  logLine("Tutorial online. Use ships -> number. Use lore/factions/comms for world context.", "sys");
  showShipsList();
  render();

  setInterval(() => {
    if (!state.running) return;
    state.tick += 1;
    updateSimulation();
    render();
  }, 1000);
}

init();
