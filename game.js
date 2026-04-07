import { createConsoleLogger } from "./console.js";
import { createCommandInterpreter } from "./commandInterpreter.js";

const nodes = {
  anchor: { label: "Anchor Station" },
  cinder_hub: { label: "Cinder Hub" },
  mirrorgate: { label: "Mirrorgate Relay" },
  ninth_moon: { label: "Ninth Moon" },
  frostline: { label: "Frostline Port" },
  driftbay: { label: "Driftbay Depot" },
};

const edges = [
  ["anchor", "cinder_hub", 6],
  ["anchor", "mirrorgate", 10],
  ["cinder_hub", "ninth_moon", 8],
  ["mirrorgate", "frostline", 7],
  ["ninth_moon", "driftbay", 6],
];

const TUTORIAL_GOAL = 3;
const BASIL_NAME = "BASIL";
const PLAYER_NODE = "anchor";
const CONSOLE_MESSAGE_GAP_MS = 750;
const COMMAND_RESPONSE_DOTS_DELAY_MS = 750;
const COMMAND_RESPONSE_REVEAL_DELAY_MS = 1500;
const DEFAULT_LORE_SUMMARY =
  "Indigo is a deuterium-rich war-zone logistics system. bluFreight profits from stable volatility while juggling UFP pressure, Arcworks inspections, Blister deals, and insurance-driven risk management.";
const SCENARIO_PATH = "./scenario1.json";

const SHIP_CAPTAINS = {
  "hauler-1": "Capt. Soren Nnadi",
  "hauler-2": "Capt. Tamsin Rook",
  "courier-1": "Capt. Laleh Mercer",
};
const CHARACTER_NODE_MAP = {
  "Cmdr. Elias Thorne": "cinder_hub",
  "Capt. Hadrik Venn": "mirrorgate",
  "Port Marshal Celia Wren": "anchor",
  "Inspector Dey Arcos": "mirrorgate",
  BASIL: PLAYER_NODE,
};
const DEFAULT_SPEAKER_STATUS = "on-station";
const SPEAKER_PROFILES = {
  BASIL: { location: "Dispatch Core", status: "active" },
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
    { id: "hauler-1", at: "anchor", status: "idle", busyUntil: 0, departAt: 0, lastKnownAt: "anchor", lastContactTick: 0 },
    { id: "hauler-2", at: "cinder_hub", status: "idle", busyUntil: 0, departAt: 0, lastKnownAt: "cinder_hub", lastContactTick: 0 },
    { id: "courier-1", at: "anchor", status: "idle", busyUntil: 0, departAt: 0, lastKnownAt: "anchor", lastContactTick: 0 },
  ],
  delayedMessages: [],
  nextContract: 1,
  selection: {
    selectedShipId: null,
    pending: null,
  },
  loreSummary: DEFAULT_LORE_SUMMARY,
  dialogueDb: {},
  scenarioDialogue: {},
  latencyBriefed: false,
  lastAmbientLine: null,
  consoleReadyAtMs: Date.now(),
  respondingToCommand: false,
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

const adjacency = buildGraph();

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
    .replace(/(^|\s)(A|S|R|B)(?=\s|$)/g, '$1<span class="choice">$2</span>')
    .replace(/\[\[REL:(friendly|neutral|threat|hostile)\|(.+?)\]\]/g, '<span class="rel-$1">$2</span>');
}

const { logLine } = createConsoleLogger({
  state,
  ui,
  fmtTime,
  stylizeConsoleText,
  messageGapMs: CONSOLE_MESSAGE_GAP_MS,
  dotsDelayMs: COMMAND_RESPONSE_DOTS_DELAY_MS,
  revealDelayMs: COMMAND_RESPONSE_REVEAL_DELAY_MS,
});

function pickLine(characterName, bucket) {
  const actor = state.dialogueDb[characterName];
  const choices = actor?.dialogue?.[bucket];
  if (!choices?.length) return null;
  return choices[Math.floor(Math.random() * choices.length)];
}

function pickScenarioLine(bucket) {
  const choices = state.scenarioDialogue?.[bucket];
  if (!choices?.length) return null;
  const selection = choices[Math.floor(Math.random() * choices.length)];
  return selection?.text || null;
}

function canonicalNodeLabel(nodeId) {
  return nodes[nodeId]?.label || nodeId;
}

function formatRoute(fromNodeId, toNodeId) {
  return `${canonicalNodeLabel(fromNodeId)} -> ${canonicalNodeLabel(toNodeId)}`;
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
    const location = ship.status === "enroute" && ship.destination ? nodes[ship.destination].label : nodes[ship.at].label;
    if (status === DEFAULT_SPEAKER_STATUS) return `[${formatShipId(shipId)}, ${location}]`;
    return `[${formatShipId(shipId)}, ${location} (${status})]`;
  }

  const profile = SPEAKER_PROFILES[name];
  if (!profile) return "";
  const status = statusOverride || profile.status || DEFAULT_SPEAKER_STATUS;
  if (status === DEFAULT_SPEAKER_STATUS) return `[${profile.location}]`;
  return `[${profile.location} (${status})]`;
}

function speakerRelation(name, statusOverride = null) {
  const status = String(statusOverride || "").toLowerCase();
  if (status === "hostile" || status === "engaging") return "hostile";

  const faction = state.dialogueDb[name]?.faction;
  if (name === BASIL_NAME || faction === "bluFreight") return "friendly";
  if (faction === "UFP" || faction === "Civilian") return "neutral";
  if (faction === "Arcworks" || faction === "Blister") return "threat";
  return "neutral";
}

function relationStyledContext(name, context, statusOverride = null) {
  if (!context) return "";
  return `[[REL:${speakerRelation(name, statusOverride)}|${context}]]`;
}

function basilSpeak(bucket, fallback, type = "basil") {
  const text = pickLine(BASIL_NAME, bucket) || fallback;
  const context = speakerContext(BASIL_NAME);
  logLine(`${BASIL_NAME} ${relationStyledContext(BASIL_NAME, context)}: ${text}`, type);
}

function basilInform(text, type = "basil") {
  const context = speakerContext(BASIL_NAME);
  logLine(`${BASIL_NAME} ${relationStyledContext(BASIL_NAME, context)}: ${text}`, type);
}

function characterSpeak(characterName, bucket, fallback, type = "comms", statusOverride = null) {
  const text = pickLine(characterName, bucket) || fallback;
  const context = speakerContext(characterName, statusOverride);
  logLine(`${characterName} ${relationStyledContext(characterName, context, statusOverride)}: ${text}`, type);
}

function queueCharacterMessage(delay, characterName, bucket, fallback, type = "comms", statusOverride = null) {
  scheduleMessage(delay, () => {
    const context = speakerContext(characterName, statusOverride);
    const text = pickLine(characterName, bucket) || fallback;
    return `${characterName} ${relationStyledContext(characterName, context, statusOverride)}: ${text}`;
  }, type);
}

async function loadReferenceData() {
  try {
    const [loreResponse, dialogueResponse, scenarioResponse] = await Promise.all([
      fetch("./bluFreight%20text%20RTS.txt"),
      fetch("./indigo_dialogue_characters.json"),
      fetch(SCENARIO_PATH),
    ]);

    if (loreResponse.ok) {
      const loreText = await loreResponse.text();
      const condensed = loreText.replace(/\s+/g, " ").trim();
      if (condensed.length) state.loreSummary = condensed.slice(0, 340);
    }

    if (dialogueResponse.ok) {
      state.dialogueDb = await dialogueResponse.json();
    }

    if (scenarioResponse.ok) {
      const scenario = await scenarioResponse.json();
      const basin = scenario?.basil_scenario_dialogue || {};
      state.scenarioDialogue = {
        intro_welcome: basin.intro_welcome?.text ? [basin.intro_welcome] : [],
        intro_information_integrity: basin.intro_information_integrity?.text ? [basin.intro_information_integrity] : [],
        intro_tutorial_scenario: basin.intro_tutorial_scenario?.text ? [basin.intro_tutorial_scenario] : [],
        order_delay_acknowledgements: Array.isArray(basin.order_delay_acknowledgements) ? basin.order_delay_acknowledgements : [],
        report_staleness_acknowledgements: Array.isArray(basin.report_staleness_acknowledgements) ? basin.report_staleness_acknowledgements : [],
        tutorial_complete: basin.tutorial_complete?.text ? [basin.tutorial_complete] : [],
      };
    }
  } catch (err) {
    logLine(`Reference load fallback active (${err?.message || "unknown error"}).`, "sys");
  }
}

function routeDistance(from, to, visited = new Set()) {
  if (from === to) return 0;
  visited.add(from);
  const choices = adjacency[from]
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

function characterNode(name) {
  const shipId = Object.keys(SHIP_CAPTAINS).find((id) => SHIP_CAPTAINS[id] === name);
  if (shipId) {
    const ship = state.ships.find((s) => s.id === shipId);
    if (ship) return ship.lastKnownAt || ship.at;
  }
  return CHARACTER_NODE_MAP[name] || PLAYER_NODE;
}

function oneWaySignalToCharacter(name) {
  return oneWaySignalToNode(characterNode(name));
}

function activeCommsContacts() {
  const contacts = new Set([
    BASIL_NAME,
    ...Object.values(SHIP_CAPTAINS),
    ...Object.keys(SPEAKER_PROFILES),
  ]);
  return Array.from(contacts).filter((name) => name === BASIL_NAME || state.dialogueDb[name] || SPEAKER_PROFILES[name]);
}

function resolveActiveContactName(input) {
  const candidates = activeCommsContacts();
  const exact = candidates.find((n) => n.toLowerCase() === input.toLowerCase());
  if (exact) return exact;
  return candidates.find((n) => n.toLowerCase().includes(input.toLowerCase())) || null;
}

function hailContact(name) {
  const uplink = oneWaySignalToCharacter(name);
  const rtt = uplink * 2;
  basilInform(`Routing hail to ${name}. Uplink ${uplink}s; expected reply in ${rtt}s.`);
  scheduleMessage(rtt, () => {
    const context = speakerContext(name);
    const text = pickLine(name, "greetings") || "Channel open.";
    return `${name} ${relationStyledContext(name, context)}: ${text}`;
  }, "comms");
}

function basilShipIntel(ship) {
  const knownNode = ship.lastKnownAt || ship.at;
  const knownLabel = canonicalNodeLabel(knownNode);
  const age = state.tick - (ship.lastContactTick || 0);
  const heading = ship.destination ? `Presumed heading: ${canonicalNodeLabel(ship.destination)}.` : "No active heading.";
  return `${formatShipId(ship.id)} last confirmed at ${knownLabel} (${age}s ago). ${heading}`;
}

function basilCommsLatencyLine(ship, commandNoun = "orders") {
  if (!ship) return;
  const captain = SHIP_CAPTAINS[ship.id] || "the assigned captain";
  const uplink = oneWaySignalToShip(ship);
  const rtt = uplink * 2;
  const scenarioLine = pickScenarioLine("order_delay_acknowledgements");
  if (scenarioLine) {
    basilInform(
      `${scenarioLine} Contacting ${captain}. They will receive these ${commandNoun} in ${uplink} seconds. We can expect an acknowledgement in ${rtt} seconds.`,
      "basil"
    );
  } else {
    basilInform(
      `Contacting ${captain}. They will receive these ${commandNoun} in ${uplink} seconds. We can expect an acknowledgement in ${rtt} seconds... unless something has happened to their squishy and unreliable human body.`,
      "basil"
    );
  }
  if (!state.tutorialDone) state.latencyBriefed = true;
}

function generateContract() {
  const origins = Object.keys(nodes);
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
    li.textContent = `${idx + 1}. ${c.id} ${canonicalNodeLabel(c.from)} → ${canonicalNodeLabel(c.to)} | +$${c.payout}`;
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
    li.textContent = `${idx + 1}. ${s.id} @ ${nodes[s.at].label} | ${s.status}`;
    ui.fleet.appendChild(li);
  });
}

function showShipsList() {
  state.ships.forEach((s, idx) => {
    const captain = SHIP_CAPTAINS[s.id] || "Unassigned Captain";
    logLine(`${idx + 1}. ${s.id} (${s.status}) @ ${canonicalNodeLabel(s.at)} | ${captain}`, "sys");
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
  contracts.forEach((c, idx) => logLine(`${idx + 1}. ${c.id} ${formatRoute(c.from, c.to)} (+$${c.payout})`, "sys"));
  logLine("Pick number or contract ID.", "sys");
}

function showDestinationsForSelectedShip() {
  logLine(`Send ${state.selection.selectedShipId} to what destination?`, "sys");
  Object.keys(nodes).forEach((nodeId, idx) => {
    logLine(`${idx + 1}. ${nodeId} (${nodes[nodeId].label})`, "sys");
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
  scheduleMessage(
    rtt,
    `Report ${ship.id}: status=${ship.status}, lastKnown=${canonicalNodeLabel(ship.lastKnownAt || ship.at)}, eta=${eta}s (RTT ${rtt}s).`,
    "report"
  );
  scheduleMessage(rtt, () => pickScenarioLine("report_staleness_acknowledgements") || "Report received. Signal delay means this may already be out of date.", "basil");
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
    `${ship.id} update: passing relay corridor toward ${nodes[destination].label}.`,
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
    `${ship.id} final: arrived at ${nodes[destination].label}. Awaiting dispatch.`,
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
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  if (!nodes[destination]) return logLine(`Unknown destination: ${destination}.`, "error");
  if (ship.status !== "idle") return logLine(`${ship.id} is busy.`, "error");

  const uplink = oneWaySignalToShip(ship);
  const distance = routeDistance(ship.at, destination);
  basilCommsLatencyLine(ship, "orders");
  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + distance;
  ship.destination = destination;
  ship.lastContactTick = state.tick;

  const effectiveRisk = state.risk + (state.escort ? -10 : 8);
  if (Math.random() * 100 < effectiveRisk * 0.3) {
    scheduleMessage(
      uplink + distance + oneWaySignalToNode(destination),
      `${ship.id} detained briefly at ${nodes[destination].label}. Cargo released after inspection.`,
      "alert"
    );
    state.cash -= 70;
    state.rep -= 1;
    const arcworksInspector = "Inspector Dey Arcos";
    scheduleMessage(
      uplink + Math.max(1, distance - 1) + oneWaySignalToNode(destination),
      `${arcworksInspector} ${relationStyledContext(arcworksInspector, speakerContext(arcworksInspector, "interdicting"), "interdicting")}: ${
        pickLine(arcworksInspector, "neutral") || "Transit reviewed under local claim."
      }`,
      "comms",
    );
    basilSpeak("negative", `Order logged. ${ship.id} risk profile elevated.`, "basil");
  } else {
    scheduleTransitComms(ship, destination, distance, uplink);
    state.rep = Math.min(100, state.rep + 1);
    const captain = SHIP_CAPTAINS[ship.id];
    if (captain) {
      queueCharacterMessage(uplink * 2, captain, "acknowledgements", "Order received and executing.", "comms");
    }
  }

  logLine(`Transmission sent: ${ship.id} -> ${canonicalNodeLabel(destination)}. Uplink ${uplink}s, transit ${distance}s.`, "dispatch");
  const reportLag = oneWaySignalToNode(destination);
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

  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + total;
  ship.destination = contract.to;
  contract.status = "assigned";

  logLine(
    `Transmission sent: ${ship.id} to ${contract.id}. Uplink ${uplink}s + route ${total}s (pickup ${toPickup}s + contract leg ${toDrop}s).`,
    "dispatch"
  );
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
  scheduleMessage(uplink + total + oneWaySignalToNode(contract.to), () => {
    contract.status = "completed";
    state.cash += contract.payout - (state.escort ? 60 : 0);
    state.rep = Math.min(100, state.rep + 2);
    state.risk = Math.max(8, state.risk - 1);
    state.completedContracts += 1;

    if (!state.tutorialDone && state.completedContracts >= TUTORIAL_GOAL) {
      state.tutorialDone = true;
      logLine("Tutorial complete: 3 contracts delivered.", "sys");
      basilInform(
        pickScenarioLine("tutorial_complete") || "Tutorial objectives complete. Dispatch confidence adjusted upward.",
        "basil"
      );
    }

    return `${ship.id} delivered ${contract.id} at ${canonicalNodeLabel(contract.to)}.`;
  }, "report");
  if (captain) {
    queueCharacterMessage(uplink + total + oneWaySignalToNode(contract.to), captain, "positive", "Delivery complete.");
  }
  return true;
}

const { handleCommand } = createCommandInterpreter({
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
  tutorialGoal: TUTORIAL_GOAL,
  activeCommsContacts,
  resolveActiveContactName,
  hailContact,
});

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

  if (state.tick % 30 === 0) {
    state.risk += Math.random() < 0.5 ? 1 : -1;
    state.risk = Math.max(8, Math.min(70, state.risk));
  }

  if (state.tutorialDone && state.tick % 45 === 0) {
    const ambient = ["Cmdr. Elias Thorne", "Capt. Hadrik Venn", "Port Marshal Celia Wren"];
    const speaker = ambient[Math.floor(Math.random() * ambient.length)];
    const tone = state.risk >= 35 ? "negative" : "neutral";
    const line = pickLine(speaker, tone) || "Traffic conditions noted.";
    if (line !== state.lastAmbientLine) {
      state.lastAmbientLine = line;
      scheduleMessage(1, () => `${speaker} ${relationStyledContext(speaker, speakerContext(speaker))}: ${line}`, "comms");
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
  generateContract();
  generateContract();
  generateContract();
  state.selection.pending = "await_ship";

  const welcome = pickScenarioLine("intro_welcome");
  if (welcome && welcome.includes("Our purpose is simple:")) {
    const [introSegment, missionSegment] = welcome.split("Our purpose is simple:");
    basilInform(introSegment.trim(), "basil");
    basilInform(`Our purpose is simple:${missionSegment}`, "basil");
  } else {
    basilInform(welcome || "Dispatch online.", "basil");
  }
  basilInform(
    pickScenarioLine("intro_information_integrity")
      || "Signals take time. Reports are historical snapshots by the time they reach us.",
    "basil"
  );
  basilInform(
    pickScenarioLine("intro_tutorial_scenario")
      || "Tutorial objective: complete three contracts and practice delayed-dispatch operations.",
    "basil"
  );
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
