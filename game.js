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
const ALMANAC_PATH = "./almanac_entries_with_descriptions.json";
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
const SCENARIO3_CAPACITY_BRIEFING =
  "Scenario 3 routing now includes explicit cargo tonnage. Contract cargo is shown as T units (for example, 6T). Ship capability is shown as XT cap (for example, 3T cap). Yes, this is also where I confirm the Courier still cannot carry extra munitions in the lavatory, despite management's recurring optimism.";

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
  scenario4Activated: false,
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
  almanacEntries: null,
  tugIntroPlayed: false,
  scenario2VennDetainmentTriggered: false,
  scenario2DetainedShipId: null,
  scenario2DetainmentResolved: false,
  scenario2VennRelocating: false,
  buddeIntroduced: false,
  scenario2OnionAdvisoryPlayed: false,
  scenario3CapacityBriefed: false,
  scenario3Completed: false,
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
  almanacRoot: document.getElementById("almanac-root"),
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
    const [loreResponse, dialogueResponse, mapResponse, buddeResponse, scenarioResponse, playerRequestsResponse, almanacResponse] = await Promise.all([
      fetch("./bluFreight%20text%20RTS.txt"),
      fetch("./indigo_dialogue_characters.json"),
      fetch("./map.json"),
      fetch("./budde.json"),
      fetch(SCENARIO_PATH),
      fetch(PLAYER_REQUESTS_PATH),
      fetch(ALMANAC_PATH),
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

    if (almanacResponse.ok) {
      const parsedAlmanac = await almanacResponse.json();
      state.almanacEntries = parsedAlmanac?.almanac_entries || null;
    }
  } catch (err) {
    logLine(`Reference load fallback active (${err?.message || "unknown error"}).`, "sys");
  }
}

function renderAlmanac() {
  if (!ui.almanacRoot) return;
  ui.almanacRoot.innerHTML = "";
  const entries = state.almanacEntries;
  if (!entries || typeof entries !== "object") {
    const empty = document.createElement("p");
    empty.textContent = "Almanac data unavailable.";
    ui.almanacRoot.appendChild(empty);
    return;
  }

  Object.entries(entries).forEach(([categoryName, categoryPayload]) => {
    const categoryNode = document.createElement("details");
    categoryNode.className = "almanac-category";
    categoryNode.open = true;

    const categorySummary = document.createElement("summary");
    categorySummary.textContent = categoryName.replaceAll("_", " ");
    categoryNode.appendChild(categorySummary);

    if (Array.isArray(categoryPayload)) {
      addAlmanacItems(categoryNode, "Entries", categoryPayload);
    } else if (categoryPayload && typeof categoryPayload === "object") {
      Object.entries(categoryPayload).forEach(([groupName, groupEntries]) => {
        addAlmanacItems(categoryNode, groupName, groupEntries);
      });
    }
    ui.almanacRoot.appendChild(categoryNode);
  });
}

function addAlmanacItems(parentNode, groupName, entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const groupNode = document.createElement("details");
  groupNode.className = "almanac-items";

  const groupSummary = document.createElement("summary");
  groupSummary.textContent = groupName;
  groupNode.appendChild(groupSummary);

  entries.forEach((entry) => {
    const itemNode = document.createElement("details");
    itemNode.className = "almanac-items";

    const itemSummary = document.createElement("summary");
    itemSummary.textContent = entry?.name || "Unnamed entry";
    itemNode.appendChild(itemSummary);

    const description = document.createElement("p");
    description.className = "almanac-entry-description";
    description.textContent = entry?.description || "No description available.";
    itemNode.appendChild(description);
    groupNode.appendChild(itemNode);
  });

  parentNode.appendChild(groupNode);
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
  if (!state.scenario3CapacityBriefed) {
    state.scenario3CapacityBriefed = true;
    basilInform(SCENARIO3_CAPACITY_BRIEFING);
  }
}

function playScenario4Intro() {
  basilInform("Scenario 4 unlocked: Exclusive Distribution.");
  basilInform("Only qualifying contracts in this scenario count toward completion objectives. Avoid bankruptcy.");
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

function moonForNode(nodeId) {
  const node = nodes[nodeId];
  if (!node?.moon) return null;
  return state.mapData?.layer0?.moons?.[node.moon] || null;
}

function orbitBandValueForNode(nodeId) {
  const moon = moonForNode(nodeId);
  if (!moon) return null;
  return state.mapData?.layer0?.orbits?.[moon.orbit] || null;
}

function angleForNode(nodeId) {
  const moon = moonForNode(nodeId);
  return Number.isFinite(moon?.angle) ? moon.angle : null;
}

function buildDeterministicDepartureCallout(fromNodeId, toNodeId) {
  const fromAngle = angleForNode(fromNodeId);
  const toAngle = angleForNode(toNodeId);
  const fromBand = orbitBandValueForNode(fromNodeId);
  const toBand = orbitBandValueForNode(toNodeId);
  const parts = [];

  if (Number.isFinite(fromAngle) && Number.isFinite(toAngle)) {
    const ccwDelta = (toAngle - fromAngle + 360) % 360;
    const cwDelta = (fromAngle - toAngle + 360) % 360;
    const prograde = ccwDelta <= cwDelta;
    parts.push(prograde ? "Prograde, counterclockwise around Indigo." : "Retrograde, clockwise around Indigo.");
  }

  if (Number.isFinite(fromBand) && Number.isFinite(toBand)) {
    const delta = toBand - fromBand;
    if (delta > 0) {
      parts.push(delta >= 2 ? `Climbing ${delta} orbit bands; hard climb.` : "Climbing one orbit band.");
    } else if (delta < 0) {
      const drop = Math.abs(delta);
      parts.push(drop >= 2 ? `Dropping ${drop} orbit bands; fast descent.` : "Dropping one orbit band.");
    } else {
      parts.push("Holding current orbit band.");
    }
  }

  if (Number.isFinite(fromAngle) && Number.isFinite(toAngle)) {
    const isDark = (angle) => angle > 90 && angle < 270;
    const fromDark = isDark(fromAngle);
    const toDark = isDark(toAngle);
    if (!fromDark && toDark) parts.push("We're coming into Indigo's shadow now.");
    else if (fromDark && !toDark) parts.push("Crossing the horizon, nice to be able to see again.");
    else if (toDark) parts.push("Crossing the dark side of the planet now.");
    else parts.push("We're on the near side now, switching back to line-of-sight navigation.");
  }

  return parts.join(" ");
}

function minimumFuelForPlayerFleet(fromNodeId, toNodeId) {
  const candidates = state.ships
    .map((ship) => fuelCostForRoute(fromNodeId, toNodeId, effectiveDriveShipId(ship.id)))
    .filter((value) => Number.isFinite(value));
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function buildBuddeRouteBrief(fromNodeId, toNodeId) {
  const distance = safeRouteDistance(fromNodeId, toNodeId);
  const minFuel = minimumFuelForPlayerFleet(fromNodeId, toNodeId);
  const fromLabel = nodeLabel(fromNodeId);
  const toLabel = nodeLabel(toNodeId);
  const distanceText = Number.isFinite(distance) ? `${distance}s route span` : "route span unavailable";
  const fuelText = Number.isFinite(minFuel) ? `${minFuel} minimum fuel` : "minimum fuel unavailable";

  const fromAngle = angleForNode(fromNodeId);
  const toAngle = angleForNode(toNodeId);
  const fromBand = orbitBandValueForNode(fromNodeId);
  const toBand = orbitBandValueForNode(toNodeId);
  const steps = [];

  if (Number.isFinite(fromAngle) && Number.isFinite(toAngle)) {
    const ccwDelta = (toAngle - fromAngle + 360) % 360;
    const cwDelta = (fromAngle - toAngle + 360) % 360;
    const prograde = ccwDelta <= cwDelta;
    steps.push(prograde
      ? "Begin with a prograde burn (counterclockwise). Yes, the shorter way is usually better."
      : "Begin with a retrograde burn (clockwise). Even now, this is still the efficient option.");
    const isDark = (angle) => angle > 90 && angle < 270;
    const fromDark = isDark(fromAngle);
    const toDark = isDark(toAngle);
    if (!fromDark && toDark) steps.push("Expect entry into Indigo's shadow en route.");
    else if (fromDark && !toDark) steps.push("You will cross the horizon and regain star-side visibility.");
    else if (toDark) steps.push("Most of this segment remains on Indigo's dark side.");
    else steps.push("This route stays on the near side with line-of-sight navigation.");
  }

  if (Number.isFinite(fromBand) && Number.isFinite(toBand)) {
    const delta = toBand - fromBand;
    if (delta > 0) steps.push(delta >= 2 ? `Climb window: +${delta} orbit bands. Budget for an expensive uphill burn.` : "Climb window: +1 orbit band.");
    else if (delta < 0) steps.push(`Descent window: ${delta} orbit band${Math.abs(delta) > 1 ? "s" : ""}. Use the gravity assist and try not to waste it.`);
    else steps.push("No orbit-band change required; remain on current band.");
  }

  steps.push(`Final approach: transition onto ${toLabel} local traffic corridor and hold station.`);
  return `Route ${fromLabel} -> ${toLabel}. ${steps.join(" ")} Estimated ${distanceText}, ${fuelText}.`;
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
    const cargoRequirementLabel = state.currentScenario >= 3 && Number.isInteger(c.cargoRequirement)
      ? ` | cargo ${c.cargoRequirement}T`
      : "";
    const scenarioFlavor = state.currentScenario >= 2 && c.client && c.cargoType
      ? ` | ${c.client} | ${c.cargoType}${cargoRequirementLabel}`
      : "";
    li.textContent = `${displayNumber}. ${c.id} ${nodeLabel(c.from)} → ${nodeLabel(c.to)}${scenarioFlavor} | +$${c.payout}`;
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
    const capacityLabel = state.currentScenario >= 3 && !s.utility
      ? ` | ${s.cargoCapacity || SHIP_CAPACITY_BY_ID[s.id] || 0}T cap`
      : "";
    li.textContent = `${idx + 1}. ${s.id} @ ${nodeLabel(s.at)} | ${s.status}${capacityLabel}`;
    ui.fleet.appendChild(li);
  });
}

function showShipsList() {
  state.ships.forEach((s, idx) => {
    const captain = SHIP_CAPTAINS[s.id] || "Unassigned Captain";
    const dockedSuffix = s.dockedTo ? ` -> docked to ${s.dockedTo}` : s.utilityDockedBy ? ` <- utility ${s.utilityDockedBy}` : "";
    const capacityLabel = state.currentScenario >= 3 && !s.utility
      ? ` | ${s.cargoCapacity || SHIP_CAPACITY_BY_ID[s.id] || 0}T cap`
      : "";
    logLine(`${idx + 1}. ${s.id} (${s.status}${dockedSuffix}) @ ${s.at} | ${captain}${capacityLabel}`, "sys");
  });
  logLine("Select ship by typing its number or ID.", "sys");
}

function dockableShipsForUtility(utilityShipId) {
  const utility = state.ships.find((ship) => ship.id === utilityShipId);
  if (!utility) return [];
  return state.ships.filter((ship) => (
    ship.id !== utilityShipId
    && !ship.utility
    && ship.at === utility.at
    && !ship.utilityDockedBy
  ));
}

function dockUtilityShip(utilityShipId, targetShipId) {
  const utility = state.ships.find((ship) => ship.id === utilityShipId);
  const target = state.ships.find((ship) => ship.id === targetShipId);
  if (!utility || !utility.utility) return logLine("Selected ship cannot dock.", "error");
  if (!target || target.utility) return logLine("Invalid dock target.", "error");
  if (utility.at !== target.at) return logLine("Dock target must be at the same location.", "error");
  if (utility.status !== "idle") return logLine(`${utility.id} is not ready to dock.`, "error");
  if (utility.dockedTo || target.utilityDockedBy) return logLine("Docking unavailable: one of the ships is already docked.", "error");

  utility.status = "docked";
  utility.dockedTo = target.id;
  target.utilityDockedBy = utility.id;
  utility.destination = target.destination;
  utility.busyUntil = target.busyUntil;
  utility.departAt = target.departAt;
  utility.at = target.at;
  utility.lastKnownAt = target.lastKnownAt || target.at;
  utility.lastContactTick = state.tick;
  logLine(`${utility.id} docked with ${target.id}. ${target.id} now inherits utility thrust profile while docked.`, "sys");
}

function undockUtilityShip(utilityShipId) {
  const utility = state.ships.find((ship) => ship.id === utilityShipId);
  if (!utility || !utility.utility || !utility.dockedTo) return logLine("No active dock to release.", "error");
  const target = state.ships.find((ship) => ship.id === utility.dockedTo);
  if (target && (target.status === "tasked" || target.status === "enroute")) {
    return logLine(`Cannot undock ${utility.id} while ${target.id} is in transit. Wait for arrival.`, "error");
  }
  if (target) delete target.utilityDockedBy;
  utility.dockedTo = null;
  utility.status = "idle";
  utility.destination = undefined;
  utility.departAt = 0;
  utility.busyUntil = 0;
  if (target) utility.at = target.at;
  utility.lastKnownAt = utility.at;
  utility.lastContactTick = state.tick;
  logLine(`${utility.id} undocked and is now idle.`, "sys");
}

function effectiveDriveShipId(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return shipId;
  return ship.utilityDockedBy || ship.id;
}

function showShipMenu(shipId) {
  state.selection.allowedDestinationIds = [];
  state.selection.dockableShipIds = [];
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return;
  if (shipId === TUG_ID && !state.tugIntroPlayed) {
    state.tugIntroPlayed = true;
    const captain = SHIP_CAPTAINS[TUG_ID];
    logLine(`${captain} ${speakerContext(captain)}: Captain Voss here. Freighters are built to cruise efficiently, but they are poor at climbing against Indigo’s gravity with a full load. Tugs are built for that job. We carry almost no cargo, but we do not take the same uphill fuel penalty a loaded freighter does, so using a tug for the climb is much more efficient than making the freighter do it alone.`, speakerMessageType(captain));
  }
  if (state.currentScenario === 2 && !state.scenario2OnionAdvisoryPlayed) {
    state.scenario2OnionAdvisoryPlayed = true;
    const advisory = "Civilian advisory: Onion Skin is contested space. Traffic is advised to get docking permission before embarking.";
    scheduleMessage(
      1,
      `Port Marshal Celia Wren ${speakerContext("Port Marshal Celia Wren")}: ${advisory}`,
      "comms"
    );
  }
  if (state.currentScenario >= 3 && !state.scenario3CapacityBriefed) {
    state.scenario3CapacityBriefed = true;
    basilInform(SCENARIO3_CAPACITY_BRIEFING);
  }
  let menuOptions = "A assign, S send, R report, B back to ship list.";
  if (ship.utility && ship.status === "docked") {
    menuOptions = "U undock.";
  } else if (ship.utility) {
    menuOptions = "D dock, S send, R report, B back to ship list.";
  }
  logLine(`${shipId} selected (submenu mode). Valid inputs: ${menuOptions}`, "sys");
}

function isOnionSkinLocation(nodeId) {
  return state.currentScenario === 2 && nodes[nodeId]?.moon === "onion_skin";
}

function onionSkinInspectionDelay(destinations = []) {
  if (state.currentScenario !== 2 || state.onionSkinInspectionWaived) return 0;
  const onionStops = destinations.filter((nodeId) => isOnionSkinLocation(nodeId)).length;
  return onionStops * 180;
}

function showContractsForSelectedShip() {
  const contracts = openContracts();
  if (!contracts.length) return logLine("No open contracts to assign.", "sys");
  logLine(`Assign ${state.selection.selectedShipId} to what contract?`, "sys");
  BuddeAdvisor.adviseContractOptions(state.selection.selectedShipId);
  contracts.forEach((c, idx) => {
    const displayNumber = contractNumber(c.id) || (idx + 1);
    const scenarioFlavor = state.currentScenario >= 2 && c.client && c.cargoType
      ? ` | ${c.client} | ${c.cargoType}`
      : "";
    const cargoRequirementLabel = state.currentScenario >= 3 && Number.isInteger(c.cargoRequirement)
      ? ` | cargo ${c.cargoRequirement}T`
      : "";
    logLine(`${displayNumber}. ${c.id} ${nodeLabel(c.from)} -> ${nodeLabel(c.to)}${scenarioFlavor}${cargoRequirementLabel} (+$${c.payout})`, "sys");
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
    if (!state.scenario3Activated) {
      state.scenario3Activated = true;
      state.currentScenario = 3;
      state.completedContracts = 0;
      const switchedToScenario3Map = buildScenario3Map(state.mapData);
      if (!switchedToScenario3Map) {
        logLine("Scenario 3 map warning: layer3 scenario data unavailable. Continuing with current routing layer.", "error");
      } else {
        syncShipLocationsToActiveMap();
      }
      addScenario3Tug();
      state.contracts = state.contracts.filter((contract) => contract.status !== "open");
      while (openContracts().length < 4) generateContract();
      logLine("Scenario 3 unlocked: Calibration Debt and Corrected Distances.", "sys");
      playScenario3Intro();
    }
    return;
  }

  if (state.currentScenario === 3 && !state.scenario3Completed) {
    state.scenario3Completed = true;
    const completionText = state.scenario3Dialogue?.completion?.text
      || "Scenario 3 complete: 3 contracts have been reported delivered and operations remained solvent.";
    basilInform(completionText, "basil");
    logLine("Scenario 3 complete: 3 contracts reported delivered without bankruptcy.", "sys");
    if (!state.scenario4Activated) {
      state.scenario4Activated = true;
      state.currentScenario = 4;
      state.completedContracts = 0;
      state.contracts = state.contracts.filter((contract) => contract.status !== "open");
      while (openContracts().length < 4) generateContract();
      logLine("Scenario 4 unlocked: Exclusive Distribution.", "sys");
      playScenario4Intro();
    }
  }
}

function maybeTriggerScenario2VennDetainment() {
  if (state.currentScenario !== 2) return;
  if (state.scenario2VennDetainmentTriggered) return;
  if (state.completedContracts < 2) return;

  const detainedShip = state.ships.find((ship) => ship.status === "idle" && nodes[ship.at]?.moon === "oxblood");
  if (!detainedShip) return;

  state.scenario2VennDetainmentTriggered = true;
  state.scenario2DetainedShipId = detainedShip.id;
  detainedShip.status = "detained";
  detainedShip.destination = undefined;
  detainedShip.departAt = 0;
  detainedShip.busyUntil = 0;
  detainedShip.lastContactTick = state.tick;

  const venn = VENN_NAME;
  logLine(
    `${venn} ${speakerContext(venn)}: Nice hull you left at Oxblood. I'm impounding ${detainedShip.id} under local claim. Consider it unavailable.`,
    speakerMessageType(venn)
  );
  const detainedCaptain = SHIP_CAPTAINS[detainedShip.id];
  if (detainedCaptain) {
    logLine(
      `${detainedCaptain} ${speakerContext(detainedCaptain)}: We've been pinned and boarded. This detainment is bad news.`,
      speakerMessageType(detainedCaptain)
    );
  }
  basilInform(`${formatShipId(detainedShip.id)} has been detained at Oxblood and is unavailable for dispatch.`);
}

function releaseScenario2DetainedShip(reasonText = null) {
  if (state.scenario2DetainmentResolved) return;
  const ship = state.ships.find((entry) => entry.id === state.scenario2DetainedShipId && entry.status === "detained");
  if (!ship) return;
  ship.status = "idle";
  ship.departAt = 0;
  ship.busyUntil = 0;
  ship.destination = undefined;
  ship.lastContactTick = state.tick;
  state.scenario2DetainmentResolved = true;
  if (reasonText) logLine(reasonText, speakerMessageType(VENN_NAME));
  basilInform(`${formatShipId(ship.id)} has been released and is available for dispatch.`);
  beginVennMoveToEndOfDay();
}

function beginVennMoveToEndOfDay() {
  if (state.scenario2VennRelocating) return;
  if (state.currentScenario !== 2) return;
  const destinationNode = Object.keys(nodes).find((nodeId) => nodes[nodeId]?.moon === "end_of_day");
  const currentNode = CONTACT_PROFILES[VENN_NAME]?.nodeId;
  if (!destinationNode || !currentNode) return;
  state.scenario2VennRelocating = true;
  const routeSpan = safeRouteDistance(currentNode, destinationNode);
  const transit = travelTimeForRoute(VENN_NAME, routeSpan);
  logLine(`${VENN_NAME} ${speakerContext(VENN_NAME)}: Payment received. We are departing for End-of-Day.`, speakerMessageType(VENN_NAME));
  scheduleMessage(
    transit,
    () => {
      CONTACT_PROFILES[VENN_NAME].nodeId = destinationNode;
      return `${VENN_NAME} ${speakerContext(VENN_NAME)}: End-of-Day reached.`;
    },
    speakerMessageType(VENN_NAME)
  );
}

function handleScenario2DetainmentHailResolution(targetName, action) {
  if (state.currentScenario !== 2) return false;
  if (!state.scenario2DetainedShipId || state.scenario2DetainmentResolved) return false;

  if (targetName === THORNE_NAME && action === "request") {
    const oxbloodNode = Object.keys(nodes).find((nodeId) => nodes[nodeId]?.moon === "oxblood");
    const currentNode = CONTACT_PROFILES[THORNE_NAME]?.nodeId;
    if (oxbloodNode && currentNode) {
      const routeSpan = safeRouteDistance(currentNode, oxbloodNode);
      const transit = travelTimeForRoute(THORNE_NAME, routeSpan);
      logLine(`${THORNE_NAME} ${speakerContext(THORNE_NAME)}: Request accepted. We'll lean on these Blister thugs until they let your ship go. Kestrel is burning for Oxblood now.`, speakerMessageType(THORNE_NAME));
      scheduleMessage(
        transit,
        () => {
          CONTACT_PROFILES[THORNE_NAME].nodeId = oxbloodNode;
          releaseScenario2DetainedShip(`${VENN_NAME} ${speakerContext(VENN_NAME)}: Fine. I'm leaving on an important resupply for Blister colonists, entirely unrelated to those UFP warships suddenly overhead.`);
          return `${THORNE_NAME} ${speakerContext(THORNE_NAME)}: Arrived Oxblood. Detainment dispute resolved.`;
        },
        speakerMessageType(THORNE_NAME)
      );
      return true;
    }
  }

  if (targetName === VENN_NAME && action === "negotiate") {
    state.cash -= 1000;
    releaseScenario2DetainedShip(`${VENN_NAME} ${speakerContext(VENN_NAME)}: Duties, licensing, and necessary restitution collected: $1000. Your ship is released.`);
    return true;
  }

  return false;
}

PlayerHailFlow = createPlayerHailFlow({
  state,
  ui,
  arcworksExecName: ARCWORKS_EXEC_NAME,
  handleScenario2DetainmentHailResolution,
  basilInform,
  logLine,
  speakerContext,
  speakerMessageType,
  pickResponse: (targetName, action) => pickHailResponse(state, targetName, action),
});

function showDestinationsForSelectedShip() {
  const destinationOptions = candidateDestinationsForShip(state.selection.selectedShipId);
  state.selection.allowedDestinationIds = destinationOptions;
  logLine(`Send ${state.selection.selectedShipId} to what destination?`, "sys");
  BuddeAdvisor.adviseDestinationOptions(state.selection.selectedShipId);
  destinationOptions.forEach((nodeId, idx) => {
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
  if (ship.utility && ship.status === "docked") return logLine(`${ship.id} is docked. Undock before moving independently.`, "error");
  if (ship.status !== "idle") return logLine(`${ship.id} is busy.`, "error");

  const driveShipId = effectiveDriveShipId(ship.id);
  const uplink = oneWaySignalToShip(ship);
  const routeSpan = safeRouteDistance(ship.at, normalizedDestination);
  const inspectionDelay = onionSkinInspectionDelay([normalizedDestination]);
  const transitTime = travelTimeForRoute(driveShipId, routeSpan) + inspectionDelay;
  const shipFuelCost = fuelCostForRoute(ship.at, normalizedDestination, driveShipId);
  const allChoices = candidateDestinationsForShip(ship.id)
    .map((nodeId) => ({ nodeId, fuel: fuelCostForRoute(ship.at, nodeId, driveShipId) }))
    .sort((a, b) => a.fuel - b.fuel);
  if (state.currentScenario >= 2 && allChoices[0]) {
    const recommended = allChoices[0];
    const savingsVsRecommendation = Math.max(0, shipFuelCost - recommended.fuel);
    if (shipFuelCost > recommended.fuel) {
      buddeSpeak("objections", "Selected destination is not the most fuel-efficient route.");
      buddeInform(`My recommended maneuver would have reduced fuel burn by ${savingsVsRecommendation} units. Coordinates relayed as ordered.`);
    } else {
      buddeSpeak("wiseChoice", "Wise and efficient choice. Your selection matches my recommendation.");
    }
  }
  if (inspectionDelay > 0) {
    basilInform(`Arcworks traffic control adds mandatory inspection delay: +${inspectionDelay}s for Onion Skin arrival clearance.`);
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
    const arcworksInspector = ARCWORKS_EXEC_NAME;
    scheduleMessage(
      uplink + Math.max(1, transitTime - 1) + oneWaySignalToNode(normalizedDestination),
      `${arcworksInspector} ${speakerContext(arcworksInspector, "interdicting")}: ${
        pickLine(arcworksInspector, "neutral") || "Transit reviewed under local claim."
      }`,
      "comms",
    );
    basilSpeak("negative", `Order logged. ${ship.id} risk profile elevated.`, "basil");
    const captain = SHIP_CAPTAINS[ship.id];
    if (captain) {
      queueCharacterMessage(
        uplink + transitTime + oneWaySignalToNode(normalizedDestination),
        captain,
        "negative",
        "We're detained for inspection. This run just went sideways.",
        "comms"
      );
    }
  } else {
    scheduleTransitComms(ship, normalizedDestination, transitTime, uplink);
    state.rep = Math.min(100, state.rep + 1);
    if (fuelBillingActive()) state.cash -= shipFuelCost;
    const captain = SHIP_CAPTAINS[ship.id];
    if (captain) {
      queueCharacterMessage(
        uplink * 2,
        captain,
        "__deterministic_departure__",
        buildDeterministicDepartureCallout(ship.at, normalizedDestination) || "Order received and executing.",
        "comms"
      );
    }
  }

  const fuelBillingText = fuelBillingActive() ? `fuel ${shipFuelCost}` : `fuel ${shipFuelCost} (training waiver: not charged in Scenario 1)`;
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
  const requestedShip = state.ships.find((s) => s.id === shipId);
  if (requestedShip?.utility) return logLine(`${shipId} cannot be assigned to contracts. Use send/dock instead.`, "error");
  if (!idleShip(shipId)) return logLine(`${shipId} is not idle.`, "error");

  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  if (state.currentScenario >= 3 && Number.isInteger(contract.cargoRequirement)) {
    const shipCapacity = ship.cargoCapacity || SHIP_CAPACITY_BY_ID[ship.id] || 0;
    if (shipCapacity < contract.cargoRequirement) {
      return logLine(
        `${ship.id} capacity ${shipCapacity} is below required cargo ${contract.cargoRequirement} for ${contract.id}.`,
        "error"
      );
    }
  }
  const driveShipId = effectiveDriveShipId(ship.id);
  const uplink = oneWaySignalToShip(ship);
  basilCommsLatencyLine(ship, "orders");
  const toPickupSpan = safeRouteDistance(ship.at, contract.from);
  const toDropSpan = safeRouteDistance(contract.from, contract.to);
  const inspectionTargets = [];
  if (ship.at !== contract.from) inspectionTargets.push(contract.from);
  inspectionTargets.push(contract.to);
  const inspectionDelay = onionSkinInspectionDelay(inspectionTargets);
  const totalRouteSpan = toPickupSpan + toDropSpan;
  const total = travelTimeForRoute(driveShipId, totalRouteSpan) + inspectionDelay;
  const fuelCost = fuelCostForRoute(ship.at, contract.from, driveShipId) + fuelCostForRoute(contract.from, contract.to, driveShipId);
  const contractOptions = openContracts().map((c) => ({
    id: c.id,
    fuel: fuelCostForRoute(ship.at, c.from, driveShipId) + fuelCostForRoute(c.from, c.to, driveShipId),
  })).sort((a, b) => a.fuel - b.fuel);
  const bestContract = contractOptions[0];
  if (state.currentScenario >= 2) {
    if (bestContract && fuelCost > bestContract.fuel) {
      buddeSpeak("objections", "Current assignment is not top efficiency.");
      buddeInform(`My recommendation would have reduced fuel burn by ${Math.max(1, fuelCost - bestContract.fuel)} units. Your selection has been relayed as ordered.`);
    } else {
      buddeSpeak("wiseChoice", `Wise and efficient choice. Your selection aligns with my recommendation for ${contract.id}.`);
    }
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
  if (inspectionDelay > 0) {
    basilInform(`Arcworks traffic control adds mandatory inspection delay: +${inspectionDelay}s for Onion Skin stop clearance.`);
  }
  const returnSignal = oneWaySignalToNode(contract.to);
  basilInform(
    `${formatShipId(ship.id)} mission timing: uplink ${uplink}s, transit ${total}s (speed ${shipSpeed(driveShipId)}), route span ${toPickupSpan + toDropSpan}, fuel ${fuelCost}, return signal ${returnSignal}s. Confirmation ETA: ${uplink + total + returnSignal}s.`
  );
  const captain = SHIP_CAPTAINS[ship.id];
  if (captain) {
    const firstLegDestination = ship.at === contract.from ? contract.to : contract.from;
    queueCharacterMessage(
      uplink * 2,
      captain,
      "__deterministic_departure__",
      buildDeterministicDepartureCallout(ship.at, firstLegDestination) || "Proceeding as ordered.",
      "comms"
    );
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
    const completionTone = inspectionDelay >= 180 ? "negative" : "positive";
    const completionFallback = inspectionDelay >= 180
      ? "Delivery complete, but inspection delays burned the schedule."
      : "Delivery complete.";
    queueCharacterMessage(uplink + total + oneWaySignalToNode(contract.to), captain, completionTone, completionFallback);
  }

  maybeIntroduceBudde();
  return true;
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
  const countsForProgress = state.currentScenario === 1 || state.currentScenario >= 3 || Boolean(contract.client);
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
        if (host.utilityDockedBy !== ship.id) host.utilityDockedBy = ship.id;
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
  buddeInform,
  buildBuddeRouteBrief,
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
  renderAlmanac();
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
