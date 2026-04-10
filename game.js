import {
  createConsoleLogger,
  normalizeConsoleInput,
  normalizeContractIdToken,
  normalizeShipIdToken,
} from "./console.js";

let nodes = {};
let edges = [];

const TUTORIAL_GOAL = 3;
const BASIL_NAME = "BASIL";
const BUDDE_NAME = "BUDDE";
const PLAYER_NODE = "anchor_station";
const CONSOLE_MESSAGE_GAP_MS = 750;
const COMMAND_RESPONSE_DOTS_DELAY_MS = 750;
const COMMAND_RESPONSE_REVEAL_DELAY_MS = 1500;
const SCENARIO_PATH = "./scenario1.json";
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
const SHIP_SPEED_BY_ID = {
  "hauler-1": 1,
  "hauler-2": 1,
  "courier-1": 3,
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
const CONTACT_PROFILES = {
  "Cmdr. Elias Thorne": { nodeId: "ufp_outpost_delta", shipTag: "UFP Kestrel-1", present: true },
  "Capt. Hadrik Venn": { nodeId: "yard", shipTag: "Blister Dragoon-1", present: true },
  "Port Marshal Celia Wren": { nodeId: "anchor_station", present: true },
  "Inspector Dey Arcos": { nodeId: "indigo_station", present: true },
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
  currentScenario: 1,
  scenario2Activated: false,
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
  scenarioDialogue: {},
  scenario2Dialogue: null,
  buddeIntroduced: false,
  consoleReadyAtMs: Date.now(),
  respondingToCommand: false,
};

function isPlayerBankrupt() {
  return state.cash <= -600 || state.rep <= 0;
}

const ui = {
  clock: document.getElementById("clock"),
  cash: document.getElementById("cash"),
  rep: document.getElementById("rep"),
  risk: document.getElementById("risk"),
  escort: document.getElementById("escort"),
  contracts: document.getElementById("contracts"),
  fleet: document.getElementById("fleet"),
  feed: document.getElementById("feed"),
  copyConsole: document.getElementById("copy-console"),
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

function buildCanonicalScenarioMap(scenario, layer0) {
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

function buildCanonicalTutorialMap(mapData) {
  return buildCanonicalScenarioMap(mapData?.layer1?.tutorialScenario, mapData?.layer0);
}

function buildScenario2Map(mapData) {
  return buildCanonicalScenarioMap(mapData?.layer2?.scenario2, mapData?.layer0);
}

function commandNodeId() {
  if (nodes[PLAYER_NODE]) return PLAYER_NODE;
  const [firstNode] = Object.keys(nodes);
  return firstNode || PLAYER_NODE;
}

function syncShipLocationsToActiveMap() {
  const fallbackNode = commandNodeId();
  state.ships.forEach((ship) => {
    if (!nodes[ship.at]) ship.at = fallbackNode;
    if (!nodes[ship.lastKnownAt]) ship.lastKnownAt = ship.at;
    if (ship.destination && !nodes[ship.destination] && ship.status === "idle") {
      ship.destination = undefined;
    }
  });
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

const NavigationModel = {
  routeDistance(from, to, visited = new Set()) {
    if (from === to) return 0;
    visited.add(from);
    const choices = (adjacency[from] || [])
      .filter((n) => !visited.has(n.to))
      .map((n) => {
        const sub = this.routeDistance(n.to, to, new Set(visited));
        return Number.isFinite(sub) ? n.cost + sub : Infinity;
      });
    return choices.length ? Math.min(...choices) : Infinity;
  },
  safeRouteDistance(from, to) {
    const distance = this.routeDistance(from, to);
    if (Number.isFinite(distance)) return Math.max(1, distance);
    return Math.max(1, Object.keys(nodes).length * 3);
  },
  shipSpeed(shipId) {
    return Math.max(1, SHIP_SPEED_BY_ID[shipId] || 1);
  },
  travelTimeForLegs(shipId, legCount = 1) {
    const speed = this.shipSpeed(shipId);
    const perLeg = Math.max(1, Math.round(12 / speed));
    return perLeg * Math.max(1, legCount);
  },
  orbitBandValue(moonId) {
    const moon = state.mapData?.layer0?.moons?.[moonId];
    if (!moon) return 1;
    return state.mapData?.layer0?.orbits?.[moon.orbit] || 1;
  },
  fuelCostForRoute(fromNodeId, toNodeId) {
    const fromNode = nodes[fromNodeId];
    const toNode = nodes[toNodeId];
    if (!fromNode || !toNode) return 0;
    const distance = this.safeRouteDistance(fromNodeId, toNodeId);
    const fromBand = this.orbitBandValue(fromNode.moon);
    const toBand = this.orbitBandValue(toNode.moon);
    const bandDelta = toBand - fromBand;
    const gravityMultiplier = bandDelta > 0 ? 2 : bandDelta < 0 ? 0.35 : 1;
    return Math.max(10, Math.round(distance * 12 * gravityMultiplier));
  },
  fuelBillingActive() {
    return state.currentScenario >= 2;
  },
  oneWaySignalToNode(nodeId) {
    return this.safeRouteDistance(commandNodeId(), nodeId);
  },
  oneWaySignalToShip(ship) {
    return this.oneWaySignalToNode(ship.lastKnownAt || ship.at);
  },
};

const BuddeAdvisor = {
  adviseContractOptions(shipId) {
    const ship = state.ships.find((s) => s.id === shipId);
    const contracts = openContracts();
    if (!ship || contracts.length < 1) return;

    const scored = contracts.map((c) => ({
      contract: c,
      fuel: NavigationModel.fuelCostForRoute(ship.at, c.from) + NavigationModel.fuelCostForRoute(c.from, c.to),
    })).sort((a, b) => a.fuel - b.fuel);

    const best = scored[0];
    const alt = scored[1];
    const bestLabel = `${best.contract.id} (${nodeLabel(best.contract.from)} → ${nodeLabel(best.contract.to)})`;
    const preview = scored.slice(0, 3).map((entry) => `${entry.contract.id}: ${entry.fuel} fuel`).join(" | ");
    if (preview) buddeInform(`Contract fuel estimates: ${preview}.`);
    if (alt) {
      const savingsFuel = Math.max(1, alt.fuel - best.fuel);
      const savings = Math.max(1, Math.round(((alt.fuel - best.fuel) / alt.fuel) * 100));
      buddeInform(`Contract routing options available. My recommendation is ${bestLabel}. Estimated fuel reduction: ${savingsFuel} (${savings}%) versus your next best contract choice.`);
    } else {
      buddeInform(`Only one contract route available: ${bestLabel}.`);
    }

    const destinationApproach = nodes[best.contract.to]?.approach || 0;
    if (destinationApproach >= 7) {
      buddeSpeak("highVarianceApproach", "Destination approach variance is high. Treat ETA as an estimate, not a promise.");
    }
  },
  adviseDestinationOptions(shipId) {
    const ship = state.ships.find((s) => s.id === shipId);
    if (!ship) return;
    const choices = Object.keys(nodes)
      .filter((nodeId) => nodeId !== ship.at)
      .map((nodeId) => ({ nodeId, fuel: NavigationModel.fuelCostForRoute(ship.at, nodeId) }))
      .sort((a, b) => a.fuel - b.fuel);
    if (!choices.length) return;

    const best = choices[0];
    const alt = choices[1];
    const preview = choices.slice(0, 3).map((entry) => `${nodeLabel(entry.nodeId)}: ${entry.fuel} fuel`).join(" | ");
    if (preview) buddeInform(`Destination fuel estimates: ${preview}.`);
    if (alt) {
      const savingsFuel = Math.max(1, alt.fuel - best.fuel);
      const savings = Math.max(1, Math.round(((alt.fuel - best.fuel) / alt.fuel) * 100));
      buddeInform(`Destination options available. My recommendation is ${nodeLabel(best.nodeId)}. Estimated fuel reduction: ${savingsFuel} (${savings}%) versus your other immediate option.`);
    } else {
      buddeInform(`Single reachable destination candidate: ${nodeLabel(best.nodeId)}.`);
    }

    if ((nodes[best.nodeId]?.approach || 0) >= 7) {
      buddeSpeak("highVarianceApproach", "Local approach spread is high at this destination. Expect variable final timing.");
    }
  },
};

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
    .replace(/(^|\s)([ASRBasrb]\.)/g, '$1<span class="choice">$2</span>')
    .replace(/(^|\s)(A|S|R|B|a|s|r|b)(?=\s|$)/g, '$1<span class="choice">$2</span>');
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

  const contactProfile = CONTACT_PROFILES[name];
  if (contactProfile?.nodeId && nodes[contactProfile.nodeId]) {
    const location = nodeLabel(contactProfile.nodeId);
    const shipTag = contactProfile.shipTag ? `${contactProfile.shipTag}, ` : "";
    return `[${shipTag}${location}]`;
  }

  const profile = SPEAKER_PROFILES[name];
  if (!profile) return "";
  const status = statusOverride || profile.status || DEFAULT_SPEAKER_STATUS;
  if (status === DEFAULT_SPEAKER_STATUS) return `[${profile.location}]`;
  return `[${profile.location} (${status})]`;
}

function isContactPresent(name) {
  const profile = CONTACT_PROFILES[name];
  if (!profile) return true;
  return profile.present !== false;
}

function activeCommsContacts() {
  return Object.keys(state.dialogueDb).filter((name) => name !== BASIL_NAME && name !== BUDDE_NAME && isContactPresent(name));
}

function speakerMessageType(name) {
  if (name === BASIL_NAME) return "basil";
  if (name === BUDDE_NAME) return "budde";

  const faction = String(state.dialogueDb[name]?.faction || "").toLowerCase();
  if (SHIP_CAPTAINS && Object.values(SHIP_CAPTAINS).includes(name)) return "comms-blufreight";
  if (faction === "blufreight") return "comms-blufreight";
  if (faction === "ufp") return "comms-ufp";
  if (faction === "blister") return "comms-blister";
  if (faction === "arcworks") return "comms-arcworks";
  return "comms";
}

function basilSpeak(bucket, fallback, type = "basil") {
  const text = pickLine(BASIL_NAME, bucket) || fallback;
  const context = speakerContext(BASIL_NAME);
  logLine(`${BASIL_NAME} ${context}: ${text}`, type || speakerMessageType(BASIL_NAME));
}

function basilInform(text, type = "basil") {
  const context = speakerContext(BASIL_NAME);
  logLine(`${BASIL_NAME} ${context}: ${text}`, type || speakerMessageType(BASIL_NAME));
}

function characterSpeak(characterName, bucket, fallback, type = "comms", statusOverride = null) {
  if (!isContactPresent(characterName)) return;
  const text = pickLine(characterName, bucket) || fallback;
  const context = speakerContext(characterName, statusOverride);
  const lineType = type === "comms" ? speakerMessageType(characterName) : type;
  logLine(`${characterName} ${context}: ${text}`, lineType);
}

function queueCharacterMessage(delay, characterName, bucket, fallback, type = "comms", statusOverride = null) {
  scheduleMessage(delay, () => {
    if (!isContactPresent(characterName)) return null;
    const context = speakerContext(characterName, statusOverride);
    const text = pickLine(characterName, bucket) || fallback;
    return `${characterName} ${context}: ${text}`;
  }, type === "comms" ? speakerMessageType(characterName) : type);
}

async function loadReferenceData() {
  try {
    const [loreResponse, dialogueResponse, mapResponse, buddeResponse, scenarioResponse] = await Promise.all([
      fetch("./bluFreight%20text%20RTS.txt"),
      fetch("./indigo_dialogue_characters.json"),
      fetch("./map.json"),
      fetch("./budde.json"),
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

    if (mapResponse.ok) {
      state.mapData = await mapResponse.json();
      const loaded = buildCanonicalTutorialMap(state.mapData);
      if (!loaded) logLine("Map load warning: tutorial layer unavailable. Using fallback graph.", "error");
      syncShipLocationsToActiveMap();
    }

    if (buddeResponse.ok) {
      state.buddeData = await buddeResponse.json();
    }

    if (scenarioResponse.ok) {
      const scenario = await scenarioResponse.json();
      const basilScenario = scenario?.basil_scenario_dialogue || {};
      state.scenarioDialogue = {
        intro_welcome: basilScenario.intro_welcome?.text || null,
        intro_information_integrity: basilScenario.intro_information_integrity?.text || null,
        intro_tutorial_scenario: basilScenario.intro_tutorial_scenario?.text || null,
        order_delay_acknowledgements: Array.isArray(basilScenario.order_delay_acknowledgements)
          ? basilScenario.order_delay_acknowledgements.map((entry) => entry?.text).filter(Boolean)
          : [],
        report_staleness_acknowledgements: Array.isArray(basilScenario.report_staleness_acknowledgements)
          ? basilScenario.report_staleness_acknowledgements.map((entry) => entry?.text).filter(Boolean)
          : [],
        tutorial_complete: basilScenario.tutorial_complete?.text || null,
        budde_intro: scenario?.budde_scenario_dialogue?.intro?.text || null,
      };
      state.scenario2Dialogue = scenario?.scenario2_dialogue || null;
    }
  } catch (err) {
    logLine(`Reference load fallback active (${err?.message || "unknown error"}).`, "sys");
  }
}

function playScenarioIntro() {
  const introLines = [
    state.scenarioDialogue?.intro_welcome,
    state.scenarioDialogue?.intro_information_integrity,
    state.scenarioDialogue?.intro_tutorial_scenario,
  ].filter(Boolean);

  if (!introLines.length) return;
  introLines.forEach((line) => logLine(`${BASIL_NAME} ${speakerContext(BASIL_NAME)}: ${line}`, "basil"));
}

function playScenario2Intro() {
  const introLines = state.scenario2Dialogue?.introSequence || [];
  introLines
    .map((entry) => entry?.text)
    .filter(Boolean)
    .forEach((line) => logLine(`${BUDDE_NAME} ${speakerContext(BUDDE_NAME)}: ${line}`, "budde"));
}

function pickScenarioArrayLine(key) {
  const lines = state.scenarioDialogue?.[key];
  if (!Array.isArray(lines) || !lines.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

function maybeIntroduceBudde() {
  if (state.buddeIntroduced) return;
  state.buddeIntroduced = true;
  const introText = state.scenarioDialogue?.budde_intro
    || "Hello. I am BUDDE: Benchmark Unified Dedicated Directions Engine. My purpose is route optimization and delivery-plan efficiency.";
  buddeInform(introText, "budde");
}

const routeDistance = (...args) => NavigationModel.routeDistance(...args);
const safeRouteDistance = (...args) => NavigationModel.safeRouteDistance(...args);
const shipSpeed = (...args) => NavigationModel.shipSpeed(...args);
const travelTimeForLegs = (...args) => NavigationModel.travelTimeForLegs(...args);
const fuelCostForRoute = (...args) => NavigationModel.fuelCostForRoute(...args);
const fuelBillingActive = () => NavigationModel.fuelBillingActive();

function scheduleMessage(delay, textOrFactory, type = "report") {
  state.delayedMessages.push({ at: state.tick + delay, text: textOrFactory, type });
}

const oneWaySignalToNode = (...args) => NavigationModel.oneWaySignalToNode(...args);
const oneWaySignalToShip = (...args) => NavigationModel.oneWaySignalToShip(...args);

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
    pickScenarioArrayLine("order_delay_acknowledgements")
      || `Contacting ${captain}. They will receive these ${commandNoun} in ${uplink} seconds. We can expect an acknowledgement in ${rtt} seconds... unless something has happened to their squishy and unreliable human body.`,
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

  const scenario2Fields = state.scenario2Dialogue?.metadata?.contractFields || {};
  const clients = state.currentScenario === 2 && Array.isArray(scenario2Fields.client) ? scenario2Fields.client : [];
  const cargoTypes = state.currentScenario === 2 && Array.isArray(scenario2Fields.cargoType) ? scenario2Fields.cargoType : [];

  state.contracts.push({
    id: `C-${state.nextContract++}`,
    from,
    to,
    payout: 300 + Math.floor(Math.random() * 160),
    status: "open",
    client: clients.length ? clients[Math.floor(Math.random() * clients.length)] : null,
    cargoType: cargoTypes.length ? cargoTypes[Math.floor(Math.random() * cargoTypes.length)] : null,
  });
}

function openContracts() {
  return state.contracts.filter((c) => c.status === "open");
}

function idleShip(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  return ship && ship.status === "idle";
}

function contractNumber(contractId) {
  const m = String(contractId || "").match(/c-(\d+)/i);
  return m ? Number(m[1]) : null;
}

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
    l: "lore",
    f: "factions",
    p: "pause",
  };
  return aliases[lower] || lower;
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
    const displayNumber = contractNumber(c.id) || (idx + 1);
    const scenario2Flavor = state.currentScenario === 2 && c.client && c.cargoType
      ? ` | ${c.client} | ${c.cargoType}`
      : "";
    li.textContent = `${displayNumber}. ${c.id} ${nodeLabel(c.from)} → ${nodeLabel(c.to)}${scenario2Flavor} | +$${c.payout}`;
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
  BuddeAdvisor.adviseContractOptions(state.selection.selectedShipId);
  contracts.forEach((c, idx) => {
    const displayNumber = contractNumber(c.id) || (idx + 1);
    const scenario2Flavor = state.currentScenario === 2 && c.client && c.cargoType
      ? ` | ${c.client} | ${c.cargoType}`
      : "";
    logLine(`${displayNumber}. ${c.id} ${nodeLabel(c.from)} -> ${nodeLabel(c.to)}${scenario2Flavor} (+$${c.payout})`, "sys");
  });
  logLine("Pick number or contract ID.", "sys");
}

function checkScenarioCompletion() {
  if (state.completedContracts < TUTORIAL_GOAL) return;
  if (isPlayerBankrupt()) return;

  if (state.currentScenario === 1 && !state.tutorialDone) {
    state.tutorialDone = true;
    logLine("Scenario 1 complete: 3 contracts delivered.", "sys");
    basilInform(
      state.scenarioDialogue?.tutorial_complete || "Tutorial objectives complete. Dispatch confidence adjusted upward.",
      "basil"
    );
    if (!state.scenario2Activated) {
      state.scenario2Activated = true;
      state.currentScenario = 2;
      state.completedContracts = 0;
      const switchedToScenario2Map = buildScenario2Map(state.mapData);
      if (!switchedToScenario2Map) {
        logLine("Scenario 2 map warning: layer2 scenario data unavailable. Continuing with current routing layer.", "error");
      } else {
        syncShipLocationsToActiveMap();
      }
      state.contracts = state.contracts.filter((contract) => contract.status !== "open");
      while (openContracts().length < 4) generateContract();
      logLine("Scenario 2 unlocked: Fuel, Gravity, and Actual Consequences.", "sys");
      playScenario2Intro();
    }
    return;
  }

  if (state.currentScenario === 2) {
    const completionText = state.scenario2Dialogue?.completion?.text;
    if (!state.scenario2Dialogue?.oneTimeFlags?.tutorial_complete_scenario2) {
      logLine("Scenario 2 complete: 3 contracts delivered without bankruptcy.", "sys");
      if (completionText) buddeInform(completionText, "budde");
      if (state.scenario2Dialogue?.oneTimeFlags) {
        state.scenario2Dialogue.oneTimeFlags.tutorial_complete_scenario2 = true;
      }
    }
  }
}

function showDestinationsForSelectedShip() {
  logLine(`Send ${state.selection.selectedShipId} to what destination?`, "sys");
  BuddeAdvisor.adviseDestinationOptions(state.selection.selectedShipId);
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
  const scenarioStalenessLine = pickScenarioArrayLine("report_staleness_acknowledgements");
  basilInform(
    `${scenarioStalenessLine || "Report requested."} ${basilShipIntel(ship)} Reply expected in ${rtt}s (uplink ${uplink}s each way). ${staleNote}`
  );
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
  const routeSpan = safeRouteDistance(ship.at, normalizedDestination);
  const transitTime = travelTimeForLegs(ship.id, 1);
  const fuelCost = fuelCostForRoute(ship.at, normalizedDestination);
  const allChoices = Object.keys(nodes)
    .filter((n) => n !== ship.at)
    .map((nodeId) => ({ nodeId, fuel: fuelCostForRoute(ship.at, nodeId) }))
    .sort((a, b) => a.fuel - b.fuel);
  if (allChoices[0]) {
    const recommended = allChoices[0];
    const savingsVsRecommendation = Math.max(0, fuelCost - recommended.fuel);
    if (fuelCost > recommended.fuel) {
      buddeSpeak("objections", "Selected destination is not the most fuel-efficient route.");
      buddeInform(`My recommended maneuver would have reduced fuel burn by ${savingsVsRecommendation} units. Coordinates relayed as ordered.`);
    } else {
      buddeSpeak("wiseChoice", "Wise and efficient choice. Your selection matches my recommendation.");
    }
  }
  basilCommsLatencyLine(ship, "orders");
  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + transitTime;
  ship.destination = normalizedDestination;
  ship.lastContactTick = state.tick;

  const effectiveRisk = state.risk + (state.escort ? -10 : 8);
  if (Math.random() * 100 < effectiveRisk * 0.3) {
    scheduleMessage(
      uplink + transitTime + oneWaySignalToNode(normalizedDestination),
      `${ship.id} detained briefly at ${nodeLabel(normalizedDestination)}. Cargo released after inspection.`,
      "alert"
    );
    state.cash -= 70;
    state.rep -= 1;
    const arcworksInspector = "Inspector Dey Arcos";
    scheduleMessage(
      uplink + Math.max(1, transitTime - 1) + oneWaySignalToNode(normalizedDestination),
      `${arcworksInspector} ${speakerContext(arcworksInspector, "interdicting")}: ${
        pickLine(arcworksInspector, "neutral") || "Transit reviewed under local claim."
      }`,
      "comms",
    );
    basilSpeak("negative", `Order logged. ${ship.id} risk profile elevated.`, "basil");
  } else {
    scheduleTransitComms(ship, normalizedDestination, transitTime, uplink);
    state.rep = Math.min(100, state.rep + 1);
    if (fuelBillingActive()) state.cash -= fuelCost;
    const captain = SHIP_CAPTAINS[ship.id];
    if (captain) {
      queueCharacterMessage(uplink * 2, captain, "acknowledgements", "Order received and executing.", "comms");
    }
  }

  const fuelBillingText = fuelBillingActive() ? `fuel ${fuelCost}` : `fuel ${fuelCost} (training waiver: not charged in Scenario 1)`;
  logLine(`Transmission sent: ${ship.id} -> ${destination}. Uplink ${uplink}s, transit ${transitTime}s, route span ${routeSpan}, ${fuelBillingText}.`, "dispatch");
  const reportLag = oneWaySignalToNode(normalizedDestination);
  basilInform(
    `Timing estimate: uplink ${uplink}s + transit ${transitTime}s + return signal ${reportLag}s = ${uplink + transitTime + reportLag}s until arrival is confirmed here.`
  );
  maybeIntroduceBudde();
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
  const toPickupSpan = safeRouteDistance(ship.at, contract.from);
  const toDropSpan = safeRouteDistance(contract.from, contract.to);
  const legCount = (ship.at === contract.from ? 0 : 1) + 1;
  const total = travelTimeForLegs(ship.id, legCount);
  const fuelCost = fuelCostForRoute(ship.at, contract.from) + fuelCostForRoute(contract.from, contract.to);
  const contractOptions = openContracts().map((c) => ({
    id: c.id,
    fuel: fuelCostForRoute(ship.at, c.from) + fuelCostForRoute(c.from, c.to),
  })).sort((a, b) => a.fuel - b.fuel);
  const bestContract = contractOptions[0];
  if (bestContract && fuelCost > bestContract.fuel) {
    buddeSpeak("objections", "Current assignment is not top efficiency.");
    buddeInform(`My recommendation would have reduced fuel burn by ${Math.max(1, fuelCost - bestContract.fuel)} units. Your selection has been relayed as ordered.`);
  } else {
    buddeSpeak("wiseChoice", `Wise and efficient choice. Your selection aligns with my recommendation for ${contract.id}.`);
  }

  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + total;
  ship.destination = contract.to;
  contract.status = "assigned";
  ship.activeContractId = contract.id;
  contract.fuelCost = fuelCost;

  const fuelBillingNote = fuelBillingActive() ? `fuel ${fuelCost}.` : `fuel ${fuelCost} (training waiver: not charged in Scenario 1).`;
  logLine(`Transmission sent: ${ship.id} to ${contract.id}. Uplink ${uplink}s + mission ${total}s, ${fuelBillingNote}`, "dispatch");
  const returnSignal = oneWaySignalToNode(contract.to);
  basilInform(
    `${formatShipId(ship.id)} mission timing: uplink ${uplink}s, transit ${total}s (speed ${shipSpeed(ship.id)}), route span ${toPickupSpan + toDropSpan}, fuel ${fuelCost}, return signal ${returnSignal}s. Confirmation ETA: ${uplink + total + returnSignal}s.`
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

  maybeIntroduceBudde();
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
  let command = normalizeCommandWord(parts[0]);
  if (parts[0] === "h" && parts.length >= 2) command = "hail";

  if (command === "help") {
    logLine("help | status | lore | factions | comms | hail <name> | map | ships | select <ship|number> | assign <contract> <ship> (either order; IDs or numbers) | send <ship> <destination> | escort on/off | pause", "sys");
    logLine("Aliases: contract/contracts, ship/ships, sel/select, C1/C-1, hauler1/hauler-1. Extra spaces and case are ignored.", "sys");
    return true;
  }

  if (command === "status") {
    logLine(`Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Scenario ${state.currentScenario}: ${state.completedContracts}/${TUTORIAL_GOAL}`, "sys");
    basilSpeak("neutral", "Status mirrors manageable instability.", "basil");
    return true;
  }

  if (command === "lore") {
    logLine(state.loreSummary, "sys");
    return true;
  }

  if (command === "factions") {
    logLine("Factions: bluFreight, UFP, Arcworks, Blister, civilian authorities.", "sys");
    return true;
  }

  if (command === "comms") {
    const names = activeCommsContacts();
    if (!names.length) return logLine("Comms directory unavailable.", "error");
    logLine(`Comms directory: ${names.join(" | ")}`, "sys");
    return true;
  }

  if (command === "hail" && parts.length >= 2) {
    const query = inputToName(parts.slice(1).join(" "));
    if (!query) return logLine("Usage: hail <character-name>", "error");
    if (!isContactPresent(query)) return logLine(`${query} is not currently present on the network.`, "error");
    const targetNode = CONTACT_PROFILES[query]?.nodeId;
    if (targetNode && nodes[targetNode]) {
      const uplink = oneWaySignalToNode(targetNode);
      const rtt = uplink * 2;
      basilInform(`Hailing ${query} at ${nodeLabel(targetNode)}. Uplink ${uplink}s, expected reply in ~${rtt}s.`);
      scheduleMessage(
        rtt,
        () => `${query} ${speakerContext(query)}: ${pickLine(query, "greetings") || "Channel open."}`,
        speakerMessageType(query)
      );
    } else {
      characterSpeak(query, "greetings", "Channel open.", "comms");
    }
    return true;
  }

  if (command === "map") {
    logLine("Layer 1 tutorial locations visible to player:", "sys");
    Object.entries(nodes).forEach(([id, node]) => {
      logLine(`- ${id}: ${nodeLabel(id)} | approach ${node.approach ?? "n/a"}`, "sys");
    });
    logLine(edges.map((e) => `${e[0]}<->${e[1]}:${e[2]}s`).join(" | "), "sys");
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
      logLine(`${displayNumber}. ${c.id} ${nodeLabel(c.from)} -> ${nodeLabel(c.to)}, $${c.payout}`, "sys");
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

  if (command === "escort" && parts[1] === "on") {
    state.escort = true;
    logLine("Escort posture enabled.", "sys");
    return true;
  }

  if (command === "escort" && parts[1] === "off") {
    state.escort = false;
    logLine("Escort posture disabled.", "sys");
    return true;
  }

  if (command === "pause") {
    state.running = !state.running;
    logLine(state.running ? "Simulation resumed." : "Simulation paused.", "sys");
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

  if (state.selection.pending === "await_destination") {
    const normalized = normalizeNodeInput(lower);
    if (normalized) {
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

function inputToName(input) {
  const candidates = activeCommsContacts();
  if (!candidates.length) return null;
  const exact = candidates.find((n) => n.toLowerCase() === input.toLowerCase());
  if (exact) return exact;
  return candidates.find((n) => n.toLowerCase().includes(input.toLowerCase())) || null;
}

function finalizeContractDelivery(contractId) {
  const contract = state.contracts.find((c) => c.id === contractId);
  if (!contract || contract.status !== "delivered_pending_report") return;
  contract.status = "completed";
  const missionFuelCost = fuelBillingActive() && Number.isFinite(contract.fuelCost) ? contract.fuelCost : 0;
  state.cash += contract.payout - missionFuelCost - (state.escort ? 60 : 0);
  state.rep = Math.min(100, state.rep + 2);
  state.risk = Math.max(8, state.risk - 1);
  const countsForProgress = state.currentScenario === 1 || Boolean(contract.client);
  if (countsForProgress) state.completedContracts += 1;
  checkScenarioCompletion();
}

function updateSimulation() {
  state.ships.forEach((ship) => {
    if (ship.status === "tasked" && state.tick >= ship.departAt) {
      ship.status = "enroute";
    }
    if (ship.status === "enroute" && state.tick >= ship.busyUntil) {
      if (ship.activeContractId) {
        const contract = state.contracts.find((c) => c.id === ship.activeContractId);
        if (contract && contract.status === "assigned") {
          contract.status = "delivered_pending_report";
          const returnSignal = oneWaySignalToNode(contract.to);
          scheduleMessage(returnSignal, () => {
            finalizeContractDelivery(contract.id);
            return null;
          }, "sys");
        }
      }
      ship.at = ship.destination;
      ship.destination = undefined;
      ship.activeContractId = undefined;
      ship.status = "idle";
      ship.departAt = 0;
      ship.lastKnownAt = ship.at;
      ship.lastContactTick = state.tick;
    }
  });

  const due = state.delayedMessages.filter((m) => m.at <= state.tick);
  due.forEach((m) => {
    const text = typeof m.text === "function" ? m.text() : m.text;
    if (!text) return;
    logLine(text, m.type);
  });
  state.delayedMessages = state.delayedMessages.filter((m) => m.at > state.tick);

  if (!state.tutorialDone && openContracts().length < 4 && state.tick % 10 === 0) generateContract();

  if (state.tick % 30 === 0) {
    state.risk += Math.random() < 0.5 ? 1 : -1;
    state.risk = Math.max(8, Math.min(70, state.risk));
  }

  if (state.tick % 120 === 0 && Math.random() < 0.35) {
    const ambient = ["Cmdr. Elias Thorne", "Capt. Hadrik Venn", "Port Marshal Celia Wren"].filter(isContactPresent);
    if (ambient.length) {
      const speaker = ambient[Math.floor(Math.random() * ambient.length)];
      const tone = state.risk >= 35 ? "negative" : "neutral";
      const line = pickLine(speaker, tone) || "Traffic conditions noted.";
      if (line !== state.lastAmbientLine) {
        state.lastAmbientLine = line;
        scheduleMessage(1, () => `${speaker} ${speakerContext(speaker)}: ${line}`, speakerMessageType(speaker));
      }
    }
  }

  if (isPlayerBankrupt()) {
    logLine("bluFreight insolvency event. Simulation halted.", "alert");
    state.running = false;
  }
}

function consoleTranscriptText() {
  return Array.from(ui.feed.querySelectorAll(".line"))
    .map((line) => line.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean)
    .join("\n");
}

async function copyConsoleToClipboard() {
  const text = consoleTranscriptText();
  if (!text) {
    logLine("Nothing to copy yet.", "sys");
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    logLine("Console log copied to clipboard.", "sys");
  } catch (err) {
    logLine(`Copy failed: ${err?.message || "clipboard unavailable"}.`, "error");
  }
}

ui.cmdForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(ui.cmdInput.value);
  ui.cmdInput.value = "";
  render();
});

ui.copyConsole?.addEventListener("click", () => {
  copyConsoleToClipboard();
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
  playScenarioIntro();
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
