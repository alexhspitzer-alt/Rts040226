import {
  createConsoleLogger,
  normalizeConsoleInput,
  normalizeContractIdToken,
  normalizeShipIdToken,
} from "./console.js";
import {
  buildGraph,
  buildCanonicalTutorialMap as buildTutorialMapModel,
  buildScenario2Map as buildScenario2MapModel,
  buildScenario3Map as buildScenario3MapModel,
  commandNodeId as resolveCommandNodeId,
  syncShipLocationsToActiveMap as syncShipsToMap,
  nodeLabel as formatNodeLabel,
  normalizeNodeInput as resolveNodeInput,
  candidateDestinationsForShip as findCandidateDestinations,
  isTransferLaneNode as isTransferLaneMapNode,
} from "./modules/game-map.js";
import { createNavigationModel, createBuddeAdvisor } from "./modules/game-navigation.js";
import { createContractTools } from "./modules/game-contracts.js";
import { createPlayerHailFlow, pickHailResponse } from "./modules/game-hail.js";
import { createCommandRuntime } from "./modules/game-command-runtime.js";

let nodes = {};
let edges = [];

const TUTORIAL_GOAL = 3;
const BASIL_NAME = "BASIL";
const BUDDE_NAME = "BUDDE";
const TUG_ID = "tug-1";
const ARCWORKS_EXEC_NAME = "Arcworks Chief Executive Lewin";
const THORNE_NAME = "Cmdr. Elias Thorne";
const VENN_NAME = "Capt. Hadrik Venn";
const PLAYER_NODE = "anchor_station";
const CONSOLE_MESSAGE_GAP_MS = 750;
const COMMAND_RESPONSE_DOTS_DELAY_MS = 750;
const COMMAND_RESPONSE_REVEAL_DELAY_MS = 1500;
const SCENARIO_PATH = "./scenario1.json";
const PLAYER_REQUESTS_PATH = "./indigo_dialogue_player_requests.json";
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
  [TUG_ID]: "Capt. Imani Voss",
};
const SHIP_SPEED_BY_ID = {
  "hauler-1": 1,
  "hauler-2": 1,
  "courier-1": 3,
  [TUG_ID]: 1,
};
const SHIP_CAPACITY_BY_ID = {
  "hauler-1": 10,
  "hauler-2": 10,
  "courier-1": 4,
  [TUG_ID]: 1,
};
const CARGO_GENERATION_RULES = {
  locationSets: {
    stations: [
      "Anchor Station",
      "Indigo Station",
      "Baron's Market",
      "UFP Science Station",
      "Arcworks Operations Hub",
    ],
    ufp_locations: [
      "UFP Indigo System Administration",
      "UFP Outpost Alpha",
      "UFP Outpost Bravo",
      "UFP Outpost Delta",
      "UFP Science Station",
    ],
    ufp_outposts: [
      "UFP Outpost Alpha",
      "UFP Outpost Bravo",
      "UFP Outpost Delta",
    ],
    transfer_lanes: [
      "Ring Transfer Lane",
      "Low Orbit Transfer Lane",
      "High Orbit Transfer Lane",
      "Deep Space Transfer Lane",
    ],
  },
  cargoClients: {
    deuterium: ["UFP", "station_municipal"],
    munitions: ["UFP"],
    medical: ["UFP", "civilian", "station_municipal"],
    rations: ["UFP"],
    consumer_goods: ["civilian"],
    agricultural: ["station_municipal"],
    VIP: ["UFP", "civilian", "station_municipal"],
  },
  globalOriginOverrides: [
    "Baron's Market",
    "UFP Indigo System Administration",
  ],
  cargoOriginRules: {
    deuterium: [
      "Arcworks Fuel Depot",
      "Refinery",
      "Condenser Columns",
      "UFP Science Station",
    ],
    munitions: [
      "Yard",
      "UFP Indigo System Administration",
      "UFP Outpost Alpha",
      "UFP Outpost Bravo",
      "UFP Outpost Delta",
    ],
    medical: "stations",
    rations: "stations",
    consumer_goods: [
      "Indigo Station",
      "Arcworks Operations Hub",
    ],
    agricultural: "stations",
    VIP: "any_non_transfer_lane",
  },
  clientDestinationRules: {
    UFP: "ufp_outposts",
    civilian: "any_valid_destination",
    station_municipal: "stations",
  },
  cargoSizeRules: {
    global: { min: 1, max: 10 },
    byCargoType: {
      deuterium: { min: 2, max: 10 },
      munitions: { min: 5, max: 10 },
      medical: { min: 1, max: 4 },
      rations: { min: 5, max: 10 },
      consumer_goods: { min: 1, max: 6 },
      agricultural: { min: 7, max: 10 },
      VIP: { exact: 1 },
    },
    nonVIP: { min: 2, max: 10 },
    shipEligibilityRule: "ship.cargoCapacity >= contract.cargoRequirement",
  },
  globalRules: {
    no_origin_from_transfer_lanes: true,
    origin_cannot_equal_destination: true,
    transfer_lane_destinations: {
      allowed_cargo: ["deuterium"],
    },
  },
};
const DEFAULT_SPEAKER_STATUS = "on-station";
const SPEAKER_PROFILES = {
  BASIL: { location: "Dispatch Core", status: "active" },
  BUDDE: { location: "Navigation Layer", status: "active" },
  [THORNE_NAME]: { location: "UFP Patrol Group", status: DEFAULT_SPEAKER_STATUS },
  [VENN_NAME]: { location: "Blister Trade Lane", status: DEFAULT_SPEAKER_STATUS },
  "Port Marshal Celia Wren": { location: "Anchor Station Docks", status: DEFAULT_SPEAKER_STATUS },
  [ARCWORKS_EXEC_NAME]: { location: "Arcworks Transit Authority", status: DEFAULT_SPEAKER_STATUS },
};
const CONTACT_PROFILES = {
  [THORNE_NAME]: { nodeId: "ufp_outpost_delta", shipTag: "UFP Kestrel-1", present: true },
  [VENN_NAME]: { nodeId: "yard", shipTag: "Blister Dragoon-1", present: true },
  "Port Marshal Celia Wren": { nodeId: "anchor_station", present: true },
  [ARCWORKS_EXEC_NAME]: { nodeId: "indigo_station", present: true },
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
  scenario3Activated: false,
  ships: [
    { id: "hauler-1", at: "anchor_station", status: "idle", cargoCapacity: SHIP_CAPACITY_BY_ID["hauler-1"], busyUntil: 0, departAt: 0, lastKnownAt: "anchor_station", lastContactTick: 0 },
    { id: "hauler-2", at: "refinery", status: "idle", cargoCapacity: SHIP_CAPACITY_BY_ID["hauler-2"], busyUntil: 0, departAt: 0, lastKnownAt: "refinery", lastContactTick: 0 },
    { id: "courier-1", at: "indigo_station", status: "idle", cargoCapacity: SHIP_CAPACITY_BY_ID["courier-1"], busyUntil: 0, departAt: 0, lastKnownAt: "indigo_station", lastContactTick: 0 },
  ],
  delayedMessages: [],
  nextContract: 1,
  selection: {
    selectedShipId: null,
    pending: null,
    allowedDestinationIds: [],
    dockableShipIds: [],
  },
  loreSummary: DEFAULT_LORE_SUMMARY,
  dialogueDb: {},
  latencyBriefed: false,
  lastAmbientLine: null,
  mapData: null,
  buddeData: null,
  scenarioDialogue: {},
  scenario2Dialogue: null,
  scenario3Dialogue: null,
  playerRequestDialogue: null,
  tugIntroPlayed: false,
  scenario2VennDetainmentTriggered: false,
  scenario2DetainedShipId: null,
  scenario2DetainmentResolved: false,
  scenario2VennRelocating: false,
  buddeIntroduced: false,
  scenario2OnionAdvisoryPlayed: false,
  scenario3CapacityBriefed: false,
  onionSkinInspectionWaived: false,
  lastLatencyReminderTick: -Infinity,
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
  hailAction: document.getElementById("hail-action"),
};

let adjacency = {};

function applyMapModel(mapModel) {
  if (!mapModel) return false;
  nodes = mapModel.nodes;
  edges = mapModel.edges;
  adjacency = mapModel.adjacency;
  return true;
}

function buildCanonicalTutorialMap(mapData) {
  return applyMapModel(buildTutorialMapModel(mapData));
}

function buildScenario2Map(mapData) {
  return applyMapModel(buildScenario2MapModel(mapData));
}

function buildScenario3Map(mapData) {
  return applyMapModel(buildScenario3MapModel(mapData));
}

function commandNodeId() {
  return resolveCommandNodeId(nodes, PLAYER_NODE);
}

function syncShipLocationsToActiveMap() {
  syncShipsToMap(state, nodes, PLAYER_NODE);
}

function nodeLabel(nodeId) {
  return formatNodeLabel(nodes, nodeId);
}

function normalizeNodeInput(rawNodeId) {
  return resolveNodeInput(rawNodeId, nodes, LEGACY_NODE_ALIASES);
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

const NavigationModel = createNavigationModel({
  state,
  getNodes: () => nodes,
  getAdjacency: () => adjacency,
  shipSpeedById: SHIP_SPEED_BY_ID,
  commandNodeId,
});

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
    .replace(/(^|\s)([ASRBDUasrbdu]\.)/g, '$1<span class="choice">$2</span>')
    .replace(/(^|[,:]\s*)([ASRBDUasrbdu])(?=\s+(assign|send|report|back|dock|undock)\b)/g, '$1<span class="choice">$2</span>');
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

let PlayerHailFlow;

async function loadReferenceData() {
  try {
    const [loreResponse, dialogueResponse, mapResponse, buddeResponse, scenarioResponse, playerRequestsResponse] = await Promise.all([
      fetch("./bluFreight%20text%20RTS.txt"),
      fetch("./indigo_dialogue_characters.json"),
      fetch("./map.json"),
      fetch("./budde.json"),
      fetch(SCENARIO_PATH),
      fetch(PLAYER_REQUESTS_PATH),
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
      state.scenario3Dialogue = scenario?.scenario3_dialogue || null;
    }

    if (playerRequestsResponse.ok) {
      state.playerRequestDialogue = await playerRequestsResponse.json();
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

function playScenario3Intro() {
  const introLines = state.scenario3Dialogue?.introSequence || [];
  introLines.forEach((entry) => {
    const text = entry?.text;
    if (!text) return;
    const speaker = entry?.speaker || BASIL_NAME;
    logLine(`${speaker} ${speakerContext(speaker)}: ${text}`, speakerMessageType(speaker));
  });
}

function addScenario3Tug() {
  const tugId = TUG_ID;
  if (state.ships.some((ship) => ship.id === tugId)) return;
  const spawnNode = commandNodeId();
  state.ships.push({
    id: tugId,
    at: spawnNode,
    status: "idle",
    cargoCapacity: SHIP_CAPACITY_BY_ID[tugId] || 1,
    utility: true,
    dockedTo: null,
    busyUntil: 0,
    departAt: 0,
    lastKnownAt: spawnNode,
    lastContactTick: state.tick,
  });
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

function candidateDestinationsForShip(shipId) {
  return findCandidateDestinations(shipId, state, nodes, state.mapData);
}

const routeDistance = (...args) => NavigationModel.routeDistance(...args);
const safeRouteDistance = (...args) => NavigationModel.safeRouteDistance(...args);
const shipSpeed = (...args) => NavigationModel.shipSpeed(...args);
const travelTimeForRoute = (...args) => NavigationModel.travelTimeForRoute(...args);
const fuelCostForRoute = (...args) => NavigationModel.fuelCostForRoute(...args);
const fuelBillingActive = () => NavigationModel.fuelBillingActive();

const BuddeAdvisor = createBuddeAdvisor({
  state,
  getNodes: () => nodes,
  openContracts,
  fuelCostForRoute,
  nodeLabel,
  candidateDestinationsForShip,
  buddeInform,
  buddeSpeak,
});

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
  const shouldThrottleReminder = state.currentScenario >= 2;
  if (shouldThrottleReminder && state.tick - state.lastLatencyReminderTick < 120) return;
  const captain = SHIP_CAPTAINS[ship.id] || "the assigned captain";
  const uplink = oneWaySignalToShip(ship);
  const rtt = uplink * 2;
  const scenarioOneLine = pickScenarioArrayLine("order_delay_acknowledgements");
  const conciseLine = `Comms window: ${captain} receives ${commandNoun} in ${uplink}s (RTT ${rtt}s).`;
  basilInform(state.currentScenario === 1 ? (scenarioOneLine || conciseLine) : conciseLine, "basil");
  state.lastLatencyReminderTick = state.tick;
  if (!state.tutorialDone) state.latencyBriefed = true;
}

const contractTools = createContractTools({
  state,
  getNodes: () => nodes,
  shipCapacityById: SHIP_CAPACITY_BY_ID,
  cargoGenerationRules: CARGO_GENERATION_RULES,
  isTransferLaneNode: (nodeId) => isTransferLaneMapNode(nodeId, nodes),
});

const generateContract = (...args) => contractTools.generateContract(...args);

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

let commandRuntime = null;

function handleCommand(raw) {
  return commandRuntime?.handleCommand(raw);
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
  maybeTriggerScenario2VennDetainment();
  checkScenarioCompletion();
}

function updateSimulation() {
  state.ships.forEach((ship) => {
    if (ship.utility && ship.status === "docked" && ship.dockedTo) {
      const host = state.ships.find((entry) => entry.id === ship.dockedTo);
      if (!host) {
        ship.status = "idle";
        ship.dockedTo = null;
      } else {
        ship.at = host.at;
        ship.lastKnownAt = host.lastKnownAt || host.at;
        ship.destination = host.destination;
        ship.departAt = host.departAt;
        ship.busyUntil = host.busyUntil;
      }
    }
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

commandRuntime = createCommandRuntime({
  state,
  getNodes: () => nodes,
  getEdges: () => edges,
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
  contactProfiles: CONTACT_PROFILES,
  oneWaySignalToNode,
  basilInform,
  basilSpeak,
  scheduleMessage,
  speakerContext,
  pickLine,
  speakerMessageType,
  characterSpeak,
  playerHailFlow: PlayerHailFlow,
  tutorialGoal: TUTORIAL_GOAL,
});

ui.cmdForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (PlayerHailFlow.isAwaitingChoice()) {
    PlayerHailFlow.submitSelection(ui.hailAction?.value || "request");
  } else {
    handleCommand(ui.cmdInput.value);
    ui.cmdInput.value = "";
  }
  render();
});

ui.copyConsole?.addEventListener("click", () => {
  copyConsoleToClipboard();
});

async function init() {
  await loadReferenceData();
  PlayerHailFlow.disable();
  if (!Object.keys(nodes).length) {
    nodes = {
      anchor_station: { label: "Anchor Station", moonName: "Cat's Eye", approach: 2 },
      refinery: { label: "Refinery", moonName: "Oxblood", approach: 3 },
      indigo_station: { label: "Indigo Station", moonName: "Sulphide", approach: 4 },
    };
    edges = [["anchor_station", "refinery", 6], ["refinery", "indigo_station", 7], ["anchor_station", "indigo_station", 8]];
    adjacency = buildGraph(nodes, edges);
  }
  generateContract();
  generateContract();
  state.selection.pending = "await_ship";
  basilSpeak("greetings", "Dispatch online.", "basil");
  playScenarioIntro();
  logLine("Tutorial online. Select ship by typing its number or ID.", "sys");
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
