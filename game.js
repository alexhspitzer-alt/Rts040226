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
import { createNpcController } from "./modules/game-npc-controller.js";

let nodes = {};
let edges = [];

const TUTORIAL_GOAL = 3;
const BASIL_NAME = "BASIL";
const BUDDE_NAME = "BUDDE";
const TUG_ID = "tug-1";
const ARCWORKS_EXEC_NAME = "Arcworks Chief Executive Lewin";
const THORNE_NAME = "Cmdr. Elias Thorne";
const VENN_NAME = "Capt. Hadrik Venn";
const PORT_AUTHORITY_BY_MOON = {
  "Cat's Eye": "Port Marshal Celia Wren",
  Corkscrew: THORNE_NAME,
  Peltier: "Harbor Prefect Octavia Brindle",
  Oxblood: "Dock Adjudicator Terek Halden",
  Patch: "Pier Controller Zofia Krail",
  "Onion Skin": "Port Factor Sable Orwick",
  Shooter: "Berth Warden Kez Rourke",
  Sulphide: "Dock Registrar Lysette Vorn",
  Clambroth: "Harbor Officer Bram Caldus",
  "End-of-Day": "Quay Auditor Odel Quince",
};
const PLAYER_NODE = "anchor_station";
const CONSOLE_MESSAGE_GAP_MS = 750;
const COMMAND_RESPONSE_DOTS_DELAY_MS = 750;
const COMMAND_RESPONSE_REVEAL_DELAY_MS = 1500;
const CONTRACT_BOARD_GENERATION_ATTEMPT_LIMIT = 20;
const OPERATING_COST_PER_SHIP_PER_MINUTE = 8;
const OPERATING_COST_INTERVAL_SECONDS = 15;
const OPERATING_COST_PER_SHIP_PER_INTERVAL =
  (OPERATING_COST_PER_SHIP_PER_MINUTE / 60) * OPERATING_COST_INTERVAL_SECONDS;
const OPERATING_COST_REPORT_INTERVAL_SECONDS = 300;
const DOCK_CONDITION_INITIAL_VALUE = 1000;
const DOCK_CONDITION_ARRIVAL_DECREMENT = 2;
const DOCK_CONDITION_DEPARTURE_DECREMENT = 1;
const DOCK_MAINTENANCE_TRIGGER_VALUE = 700;
const DOCK_OPERATIONAL_VALUE = 940;
const DOCK_MAINTENANCE_CLEAR_VALUE = 1000;
const DOCK_MAINTENANCE_RECOVERY_PER_SECOND = 1;
const DOCK_HAZARD_SEVERITY_LABELS = {
  1: "minor",
  2: "moderate",
  3: "serious",
  4: "catastrophic",
};
const DOCK_HAZARD_ROLLS = [
  { minDock: 950, chance: 0.02, maxSeverity: 1 },
  { minDock: 900, chance: 0.08, maxSeverity: 1 },
  { minDock: 850, chance: 0.16, maxSeverity: 2 },
  { minDock: 775, chance: 0.27, maxSeverity: 3 },
  { minDock: -Infinity, chance: 0.42, maxSeverity: 4 },
];
const DOCK_HAZARDS = [
  { label: "telemetry synchronization error", severity: 1, phases: ["arrival", "departure"] },
  { label: "contact with debris", severity: 1, phases: ["arrival", "departure"] },
  { label: "wake dampers fail to engage", severity: 1, phases: ["arrival", "departure"] },
  { label: "assigned bay blocked by poor parking job", severity: 1, phases: ["arrival"] },
  { label: "visibility reduced by dust and debris", severity: 1, phases: ["arrival", "departure"] },
  { label: "traffic stalled for disabled freighter", severity: 2, phases: ["arrival", "departure"] },
  { label: "construction on pier pylons", severity: 2, phases: ["arrival", "departure"] },
  { label: "labor dispute at dock", severity: 2, phases: ["arrival", "departure"] },
  { label: "autocrane out of service", severity: 2, phases: ["arrival"] },
  { label: "Gauss array not available for launch", severity: 3, phases: ["departure"] },
  { label: "bay doors fail to open", severity: 3, phases: ["arrival"] },
  { label: "dock clamp fails to open", severity: 3, phases: ["departure"] },
  { label: "telemetry synchronization error", severity: 4, phases: ["arrival", "departure"] },
  { label: "contact with debris", severity: 4, phases: ["arrival", "departure"] },
  { label: "wake dampers fail to engage", severity: 4, phases: ["arrival", "departure"] },
];
const FACTION_HEAT_CAMPAIGN_MIN_DURATION_SECONDS = 180;
const FACTION_HEAT_CAMPAIGN_MAX_DURATION_SECONDS = 540;
const FACTION_HEAT_CAMPAIGN_ROLL_INTERVAL_SECONDS = 10;
const FACTION_HEAT_CAMPAIGN_TRIGGER_THRESHOLD = 100;
const FACTION_HEAT_CAMPAIGN_ROLL_FLOOR = 25;
const FACTION_HEAT_CAMPAIGN_PROBABILITY_ASYMPTOTE = 0.06;
const FACTION_HEAT_CAMPAIGN_PROBABILITY_HEAT_SCALE = 55;
const FACTION_HEAT_CAMPAIGN_CONCURRENT_DECAY = 0.35;
const FACTION_HEAT_MAX = 120;
const FACTION_HEAT_STAGE_AMOUNT = { verbal: 4, intercept: 7 };
const FACTION_HEAT_FIRE_AMOUNT = 10;
const FACTION_HEAT_COLLATERAL_AMOUNT = 4;
const FACTION_HEAT_CAMPAIGN_FIRE_AMOUNT = 1;
const FACTION_HEAT_CAMPAIGN_COLLATERAL_AMOUNT = 0;
const HEAT_FACTIONS = ["ufp", "arcworks", "blister"];
const FACTION_DISPLAY_NAMES = {
  ufp: "UFP",
  arcworks: "Arcworks",
  blister: "Blister",
};
const CAMPAIGN_HOME_BASE_NODE_IDS = {
  ufp: [
    "ufp_indigo_system_administration",
    "ufp_outpost_alpha",
    "ufp_outpost_bravo",
    "ufp_outpost_delta",
    "ufp_science_station",
    "anchor_station",
    "indigo_station",
    "barons_market",
  ],
  arcworks: [
    "arcworks_operations_hub",
    "arcworks_militia_barracks",
    "arcworks_fuel_depot",
    "onion_skin",
    "refinery",
    "condenser_columns",
    "barons_market",
    "indigo_station",
  ],
  blister: [
    "deep_space_transfer_lane",
    "high_orbit_transfer_lane",
    "ring_transfer_lane",
    "low_orbit_transfer_lane",
    "yard",
    "refinery",
    "barons_market",
  ],
};
const CAMPAIGN_FALLBACK_LOCATION_NODE_ID = "barons_market";
const CAMPAIGN_DEFENDER_RESPONSE_LINES = [
  "Piss off and try someone easier.",
  "I'd like to see them try.",
  "They've bitten off more than they can chew.",
  "Tell them to bring more ships.",
  "They want a campaign? We will give them a graveyard.",
  "They can have this route when we are done using it to break them.",
  "We are still here. That is their first problem.",
  "Let them come closer. We have answers loaded.",
  "They picked the wrong target and the wrong day.",
  "We are not moving. They are welcome to learn why.",
  "Their threats are louder than their guns.",
  "They should have counted our batteries before starting this.",
  "We will be waiting at the marker with engines hot.",
  "They can explain this mistake to their survivors.",
  "If they want the lane, they can bleed for every kilometer.",
  "They are overextended and about to notice.",
  "This attack ends when they run out of nerve or hulls.",
  "They came looking for weakness and found a hard lock.",
  "We have seen worse threats from worse captains.",
  "Let them commit. Retreat is harder after the first burn.",
  "They are not taking our ground by headline.",
  "We will make this expensive enough to remember.",
  "They are welcome to test the perimeter.",
  "They opened the door. Now they can eat the room.",
  "Stand firm. They have already made the fatal mistake."
];
const SCENARIO_PATH = "./scenarioDat.json";
const ALMANAC_PATH = "./almanac_entries_with_descriptions.json";
const CONFLICT_OUTCOMES_PATH = "./conflict_outcomes.json";
const LEGACY_NODE_ALIASES = {
  anchor: "anchor_station",
  cinder_hub: "refinery",
  mirrorgate: "ufp_outpost_delta",
  ninth_moon: "yard",
  frostline: "indigo_station",
  driftbay: "deep_space_transfer_lane",
};
const DEFAULT_LORE_SUMMARY =
  "Indigo is a deuterium-rich war-zone logistics system. bluFreight profits from stable volatility while juggling UFP pressure, Arcworks claims, Blister deals, and insurance-driven risk management.";
const SCENARIO3_CAPACITY_BRIEFING =
  "Scenario 3 routing now includes explicit cargo tonnage. Contract cargo is shown as T units (for example, 6T). Ship capability is shown as XT cap (for example, 3T cap). Yes, this is also where I confirm the Courier still cannot carry extra munitions in the lavatory, despite management's recurring optimism.";

const SHIP_CAPTAINS = {
  "hauler-1": "Capt. Soren Nnadi",
  "hauler-2": "Capt. Tamsin Rook",
  "hauler-3": "Capt. Jonas Vale",
  "courier-1": "Capt. Laleh Mercer",
  "shuttle-1": "Capt. Mara Ibarra",
  [TUG_ID]: "Capt. Ruth Bell",
  "tug-2": "Capt. Pavel Ortez",
};
const SHIP_FIRST_MATES = {
  "hauler-1": "First Mate Mira Finch",
  "hauler-2": "First Mate Bren Talvik",
  "hauler-3": "First Mate Tova Varr",
  "courier-1": "First Mate Rhea Marsh",
  "shuttle-1": "First Mate Corin Slate",
  [TUG_ID]: "First Mate Sela Dorn",
  "tug-2": "First Mate Pax Myles",
};

const BLUFREIGHT_APPROACH_LINES = {
  "Capt. Soren Nnadi": [
    (dest) => `Final approach to ${dest}. Requesting dock clearance; we'll keep it orderly.`,
    (dest) => `On final for ${dest}. Requesting clearance and a calm pier if anyone has one.`,
  ],
  "Capt. Tamsin Rook": [
    (dest) => `Final approach to ${dest}. Requesting dock clearance. Keep it brief.`,
    (dest) => `Approach run to ${dest}. Requesting clearance. We'll make this quick.`,
  ],
  "Capt. Laleh Mercer": [
    (dest) => `Final approach to ${dest}. Requesting dock clearance; timing is tight.`,
    (dest) => `On final for ${dest}. Requesting clearance now.`,
  ],
  "Capt. Jonas Vale": [
    (dest) => `Final approach to ${dest}. Requesting dock clearance for a very large ship with very little patience.`,
    (dest) => `Approach to ${dest} underway. Requesting clearance before someone invents a queue.`,
  ],
  "Capt. Mara Ibarra": [
    (dest) => `Final approach to ${dest}. Requesting dock clearance; tides look clean from here.`,
    (dest) => `On final into ${dest}. Requesting clearance and a steady hand on traffic.`,
  ],
  "Capt. Ruth Bell": [
    (dest) => `Final approach to ${dest}. Tug inbound, requesting dock clearance.`,
    (dest) => `On final for ${dest}. Requesting clearance; bringing her in smooth.`,
  ],
};

function pickBluFreightApproachLine(captain, destinationLabel) {
  const variants = BLUFREIGHT_APPROACH_LINES[captain] || [
    (dest) => `Final approach to ${dest}. Requesting dock clearance.`,
    (dest) => `On final for ${dest}. Requesting docking clearance.`,
  ];
  const lineBuilder = variants[Math.floor(Math.random() * variants.length)] || variants[0];
  return lineBuilder(destinationLabel);
}

const SHIP_SPEED_BY_ID = {
  "hauler-1": 2,
  "hauler-2": 2,
  "hauler-3": 2,
  "courier-1": 4,
  "shuttle-1": 4,
  [TUG_ID]: 3,
  "tug-2": 3,
};
const SHIP_CAPACITY_BY_ID = {
  "hauler-1": 10,
  "hauler-2": 10,
  "hauler-3": 10,
  "courier-1": 4,
  "shuttle-1": 2,
  [TUG_ID]: 1,
  "tug-2": 1,
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
  [VENN_NAME]: { location: "Blister Trade Lane", status: DEFAULT_SPEAKER_STATUS },
  "Port Marshal Celia Wren": { location: "Port Authority (Cat's Eye)", status: DEFAULT_SPEAKER_STATUS },
  [THORNE_NAME]: { location: "Port Authority (Corkscrew)", status: DEFAULT_SPEAKER_STATUS },
  "Harbor Prefect Octavia Brindle": { location: "Port Authority (Peltier)", status: DEFAULT_SPEAKER_STATUS },
  "Dock Adjudicator Terek Halden": { location: "Port Authority (Oxblood)", status: DEFAULT_SPEAKER_STATUS },
  "Pier Controller Zofia Krail": { location: "Port Authority (Patch)", status: DEFAULT_SPEAKER_STATUS },
  "Port Factor Sable Orwick": { location: "Port Authority (Onion Skin)", status: DEFAULT_SPEAKER_STATUS },
  "Berth Warden Kez Rourke": { location: "Port Authority (Shooter)", status: DEFAULT_SPEAKER_STATUS },
  "Dock Registrar Lysette Vorn": { location: "Port Authority (Sulphide)", status: DEFAULT_SPEAKER_STATUS },
  "Harbor Officer Bram Caldus": { location: "Port Authority (Clambroth)", status: DEFAULT_SPEAKER_STATUS },
  "Quay Auditor Odel Quince": { location: "Port Authority (End-of-Day)", status: DEFAULT_SPEAKER_STATUS },
  [ARCWORKS_EXEC_NAME]: { location: "Arcworks Transit Authority", status: DEFAULT_SPEAKER_STATUS },
};
const NPC_CAPTAIN_FACTIONS = {
  "Capt. Elara Kade": "civilian",
  "Capt. Rowan Pike": "civilian",
  "Capt. Nia Calder": "civilian",
  "Capt. Joren Hale": "civilian",
  "Capt. Sera Malk": "ufp",
  "Capt. Arlen Dax": "ufp",
  "Capt. Ilya Soren": "ufp",
  "Capt. Rysa Korr": "blister",
  "Capt. Varek Noll": "blister",
  "Capt. Edda Marr": "arcworks",
  "Capt. Tal Ren": "arcworks",
};

const CONTACT_PROFILES = {
  [THORNE_NAME]: { nodeId: "ufp_outpost_delta", shipTag: "Kestrel Guard-1", present: true },
  [VENN_NAME]: { nodeId: "yard", shipTag: "Dragoon Fierce-1", present: true },
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
  contractBoardTargetOpen: null,
  completedContracts: 0,
  tutorialDone: false,
  currentScenario: 1,
  scenario2Activated: false,
  scenario3Activated: false,
  scenario4Activated: false,
  ships: [
    { id: "hauler-1", at: "anchor_station", status: "idle", cargoCapacity: SHIP_CAPACITY_BY_ID["hauler-1"], busyUntil: 0, departAt: 0, lastKnownAt: "anchor_station", lastContactTick: 0, acquiredAtTick: 0 },
    { id: "hauler-2", at: "refinery", status: "idle", cargoCapacity: SHIP_CAPACITY_BY_ID["hauler-2"], busyUntil: 0, departAt: 0, lastKnownAt: "refinery", lastContactTick: 0, acquiredAtTick: 0 },
    { id: "courier-1", at: "indigo_station", status: "idle", cargoCapacity: SHIP_CAPACITY_BY_ID["courier-1"], busyUntil: 0, departAt: 0, lastKnownAt: "indigo_station", lastContactTick: 0, acquiredAtTick: 0 },
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
  ambientNeutralConversation: [],
  ambientDialoguePools: {},
  characterNameRegistry: null,
  latencyBriefed: false,
  lastAmbientLine: null,
  lastAmbientChatterTick: -Infinity,
  mapData: null,
  shipRegistry: null,
  conflictOutcomes: null,
  buddeData: null,
  civilianNpcs: [],
  scenarioDialogue: {},
  scenario2Dialogue: null,
  scenario3Dialogue: null,
  scenario4Dialogue: null,
  playerRequestDialogue: null,
  almanacEntries: null,
  tugIntroPlayed: false,
  buddeIntroduced: false,
  scenario3CapacityBriefed: false,
  scenario3Completed: false,
  scenario3TowRequestPlayed: false,
  scenario3TowRequestDeferred: false,
  lastLatencyReminderTick: -Infinity,
  consoleReadyAtMs: Date.now(),
  respondingToCommand: false,
  inbox: [],
  unreadInboxCount: 0,
  inboxOpenIndexes: [],
  news: [],
  factionHeatEnabled: false,
  factionHeat: { ufp: 0, arcworks: 0, blister: 0 },
  activeFactionCampaigns: [],
  nextFactionCampaignRollTick: 0,
  operatingExpenseAccrued: 0,
  operatingExpenseWindowStartTick: 0,
  trafficLocks: {},
  dockConditions: {},
  dockMaintenance: {},
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
  copyConsole: document.getElementById("copy-console-link"),
  consoleFollowToggle: document.getElementById("console-follow-toggle"),
  cmdForm: document.getElementById("cmd-form"),
  cmdInput: document.getElementById("cmd"),
  hailAction: document.getElementById("hail-action"),
  almanacRoot: document.getElementById("almanac-root"),
  inboxList: document.getElementById("inbox-list"),
  inboxUnread: document.getElementById("inbox-unread"),
  newsList: document.getElementById("news-list"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
};

let adjacency = {};

function applyMapModel(mapModel) {
  if (!mapModel) return false;
  nodes = mapModel.nodes;
  edges = mapModel.edges;
  adjacency = mapModel.adjacency;
  syncDockConditionsToActiveLocations();
  return true;
}

function ensureDockCondition(nodeId) {
  if (!nodeId || !nodes[nodeId]) return null;
  if (!Number.isFinite(state.dockConditions[nodeId])) {
    state.dockConditions[nodeId] = DOCK_CONDITION_INITIAL_VALUE;
  }
  return state.dockConditions[nodeId];
}

function syncDockConditionsToActiveLocations() {
  Object.keys(nodes || {}).forEach((nodeId) => ensureDockCondition(nodeId));
}

function updateDockMaintenanceStatus(nodeId) {
  const value = ensureDockCondition(nodeId);
  if (!Number.isFinite(value)) return false;
  if (value < DOCK_MAINTENANCE_TRIGGER_VALUE) state.dockMaintenance[nodeId] = true;
  if (state.dockMaintenance[nodeId] && value >= DOCK_MAINTENANCE_CLEAR_VALUE) delete state.dockMaintenance[nodeId];
  return Boolean(state.dockMaintenance[nodeId]);
}

function adjustDockCondition(nodeId, amount) {
  const current = ensureDockCondition(nodeId);
  if (!Number.isFinite(current)) return null;
  state.dockConditions[nodeId] = current + amount;
  updateDockMaintenanceStatus(nodeId);
  return state.dockConditions[nodeId];
}

function updateDockMaintenanceRecovery() {
  Object.keys(state.dockMaintenance || {}).forEach((nodeId) => {
    const current = ensureDockCondition(nodeId);
    if (!Number.isFinite(current)) return;
    state.dockConditions[nodeId] = Math.min(
      DOCK_MAINTENANCE_CLEAR_VALUE,
      current + DOCK_MAINTENANCE_RECOVERY_PER_SECOND
    );
    updateDockMaintenanceStatus(nodeId);
  });
}

function dockMaintenanceHoldSeconds(nodeId) {
  updateDockMaintenanceStatus(nodeId);
  if (!state.dockMaintenance[nodeId]) return 0;
  return Math.max(0, DOCK_OPERATIONAL_VALUE - ensureDockCondition(nodeId));
}

function recordDockArrival(nodeId) {
  return adjustDockCondition(nodeId, -DOCK_CONDITION_ARRIVAL_DECREMENT);
}

function recordDockDeparture(nodeId) {
  return adjustDockCondition(nodeId, -DOCK_CONDITION_DEPARTURE_DECREMENT);
}

function portAuthorityMoonForName(name) {
  return Object.entries(PORT_AUTHORITY_BY_MOON).find(([, authorityName]) => authorityName === name)?.[0] || null;
}

function portAuthorityForNode(nodeId) {
  const moonName = nodes[nodeId]?.moonName || moonForNode(nodeId)?.name;
  return moonName ? PORT_AUTHORITY_BY_MOON[moonName] || null : null;
}

function dockHazardRollProfile(dockValue) {
  return DOCK_HAZARD_ROLLS.find((profile) => dockValue >= profile.minDock) || DOCK_HAZARD_ROLLS[DOCK_HAZARD_ROLLS.length - 1];
}

function dockHazardRiskLabel(dockValue) {
  const profile = dockHazardRollProfile(dockValue);
  return `${Math.round(profile.chance * 100)}% up to severity ${profile.maxSeverity}`;
}

function randomDockHazard(nodeId, phase) {
  const dockValue = ensureDockCondition(nodeId);
  if (!Number.isFinite(dockValue)) return null;
  const profile = dockHazardRollProfile(dockValue);
  if (Math.random() >= profile.chance) return null;
  const candidates = DOCK_HAZARDS.filter((hazard) => (hazard.phases || []).includes(phase) && hazard.severity <= profile.maxSeverity);
  if (!candidates.length) return null;
  const severityFloor = Math.max(1, profile.maxSeverity - 1);
  const likely = candidates.filter((hazard) => hazard.severity >= severityFloor);
  return (likely.length ? likely : candidates)[Math.floor(Math.random() * (likely.length ? likely.length : candidates.length))];
}

function dockHazardDelaySeconds(hazard) {
  if (!hazard) return 0;
  return { 1: 0, 2: 60, 3: 90, 4: 180 }[hazard.severity] || 0;
}

function portAuthorityShipCallsign(ship) {
  return playerShipCallsign(ship).replace(/^\S+\s+/, "");
}

function dockHazardReason(hazard, phase) {
  const label = String(hazard?.label || "local dock hazard").toLowerCase();
  if (label.includes("poor parking")) return "There's another ship badly parked in front of your assigned berth";
  if (label.includes("debris")) return phase === "departure" ? "debris removal is active on your launch vector" : "debris removal is active in the final approach corridor";
  if (label.includes("bay doors")) return "bay doors are failing to open on your assigned berth";
  if (label.includes("dock clamp")) return "your dock clamp is failing to open on the launch checklist";
  if (label.includes("freighter")) return "traffic is stalled around a disabled freighter";
  if (label.includes("pylons")) return "construction crews are still on the pier pylons";
  if (label.includes("labor")) return "a dock labor dispute is blocking the crew board";
  if (label.includes("autocrane")) return "the assigned autocrane is out of service";
  if (label.includes("gauss")) return "the Gauss launch array is not available";
  if (label.includes("telemetry")) return "local telemetry is not synchronized";
  if (label.includes("wake dampers")) return "wake dampers are not engaging on schedule";
  if (label.includes("visibility")) return "visibility is reduced by dust and debris";
  return `local control reports ${hazard?.label || "a docking hazard"}`;
}

function portAuthorityMaintenanceAnnouncement(ship, nodeId, phase, holdSeconds) {
  const call = portAuthorityShipCallsign(ship);
  if (phase === "departure") {
    return `Negative, ${call}. Hold for ${holdSeconds}s. ${nodeLabel(nodeId)} is under maintenance on the launch side. Launch clearance resumes when dock condition reaches ${DOCK_OPERATIONAL_VALUE}.`;
  }
  return `Negative, ${call}. Hold pattern for ${holdSeconds}s. ${nodeLabel(nodeId)} is under maintenance. Docking clearance resumes when dock condition reaches ${DOCK_OPERATIONAL_VALUE}.`;
}

function announcePortAuthorityMaintenanceHold(ship, nodeId, phase, holdSeconds) {
  const authorityName = portAuthorityForNode(nodeId);
  const message = portAuthorityMaintenanceAnnouncement(ship, nodeId, phase, holdSeconds);
  if (authorityName) logLine(`${authorityName} ${speakerContext(authorityName)}: ${message}`, "alert");
  else logLine(`${formatShipId(ship.id)} ${message}`, "alert");
}

function portAuthorityHazardAnnouncement(ship, nodeId, phase, hazard, delaySeconds = dockHazardDelaySeconds(hazard)) {
  const severityLabel = DOCK_HAZARD_SEVERITY_LABELS[hazard.severity] || `severity ${hazard.severity}`;
  const call = portAuthorityShipCallsign(ship);
  const reason = dockHazardReason(hazard, phase);
  if (delaySeconds > 0) {
    if (phase === "departure") {
      return `Negative, ${call}. Hold for ${delaySeconds}s. ${reason}. Stand by for launch clearance.`;
    }
    return `Negative, ${call}. Hold pattern for ${delaySeconds}s. ${reason}. Stand by for docking clearance.`;
  }
  return `${call}, advisory: ${reason}. Dock hazard ${severityLabel}; continue with caution.`;
}

function recordPlayerDockHazard(ship, nodeId, phase, hazardOverride = null) {
  const hazard = hazardOverride || randomDockHazard(nodeId, phase);
  if (!hazard) return null;
  const severityLabel = DOCK_HAZARD_SEVERITY_LABELS[hazard.severity] || `severity ${hazard.severity}`;
  const text = `Dock hazard (${phase}, ${severityLabel}): ${hazard.label} at ${nodeLabel(nodeId)}.`;
  ship.travelPlan = ship.travelPlan || {};
  ship.travelPlan.hazards = Array.isArray(ship.travelPlan.hazards) ? ship.travelPlan.hazards : [];
  ship.travelPlan.hazards.push(text);
  const authorityName = portAuthorityForNode(nodeId);
  const lineType = hazard.severity >= 3 ? "alert" : authorityName ? speakerMessageType(authorityName) : "sys";
  const announcement = portAuthorityHazardAnnouncement(ship, nodeId, phase, hazard);
  if (authorityName) {
    logLine(`${authorityName} ${speakerContext(authorityName)}: ${announcement}`, lineType);
  } else {
    logLine(`${formatShipId(ship.id)} ${text}`, lineType);
  }
  return hazard;
}

function recordPlayerDockArrival(ship, nodeId) {
  const value = recordDockArrival(nodeId);
  if (!ship.travelPlan?.arrivalHazardRolled) recordPlayerDockHazard(ship, nodeId, "arrival");
  return value;
}

function recordPlayerDockDeparture(ship, nodeId, hazardOverride = null) {
  const value = recordDockDeparture(nodeId);
  if (hazardOverride) recordPlayerDockHazard(ship, nodeId, "departure", hazardOverride);
  else if (!ship.travelPlan?.departureHazardRolled) {
    if (ship.travelPlan) ship.travelPlan.departureHazardRolled = true;
    recordPlayerDockHazard(ship, nodeId, "departure");
  }
  return value;
}


function dockDebugLines() {
  syncDockConditionsToActiveLocations();
  const entries = Object.keys(nodes || {})
    .map((nodeId) => ({ nodeId, value: ensureDockCondition(nodeId) }))
    .sort((a, b) => nodeLabel(a.nodeId).localeCompare(nodeLabel(b.nodeId)));
  if (!entries.length) return ["dbDock: no locations available."];
  return [
    "dbDock: local dock condition by location",
    ...entries.map((entry) => {
      const maintenance = state.dockMaintenance[entry.nodeId]
        ? ` | maintenance=${entry.value < DOCK_OPERATIONAL_VALUE ? `holding until ${DOCK_OPERATIONAL_VALUE}` : `recovering until ${DOCK_MAINTENANCE_CLEAR_VALUE}`}`
        : "";
      return `${nodeLabel(entry.nodeId)} (${entry.nodeId}): dock=${entry.value}${maintenance} | hazard risk ${dockHazardRiskLabel(entry.value)}`;
    }),
    "dbDock hazard severity ranking: 1 minor, 2 moderate, 3 serious, 4 catastrophic.",
    `dbDock hazards: ${DOCK_HAZARDS.map((hazard) => `${hazard.severity}=${hazard.label} [${(hazard.phases || []).join("/")}]`).join(" | ")}`,
  ];
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
    .replace(/(^|\s)([AISRDUFCHMaisrdufchm]\.)/g, '$1<span class="choice">$2</span>')
    .replace(/(^|[,:]\s*)([AISRDUFCHMaisrdufchm])(?=\s+(assign|information|send|recall|report|dock|undock|fleet|contracts|map|help)\b)/g, '$1<span class="choice">$2</span>');
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

function playerShipIndex(shipOrId) {
  const id = typeof shipOrId === "string" ? shipOrId : shipOrId?.id;
  return state.ships.findIndex((entry) => entry.id === id);
}

function playerShipDisplayId(shipOrId) {
  const idx = playerShipIndex(shipOrId);
  return idx >= 0 ? `B-${idx + 1}` : null;
}

function formatShipId(shipId) {
  const playerId = playerShipDisplayId(shipId);
  if (playerId) return playerId;
  return shipId
    .split("-")
    .map((chunk) => (Number.isNaN(Number(chunk)) ? `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}` : chunk))
    .join("-");
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function playerShipType(shipOrId) {
  const id = typeof shipOrId === "string" ? shipOrId : shipOrId?.id;
  const prefix = String(id || "ship").split("-")[0];
  return titleCaseWords(prefix);
}

function playerShipCallsign(ship) {
  const shipNumber = Math.max(1, playerShipIndex(ship) + 1);
  return `${playerShipType(ship)} Blue-${shipNumber}`;
}

function playerShipLabelById(shipId) {
  const ship = state.ships.find((entry) => entry.id === shipId);
  return ship ? playerShipCallsign(ship) : formatShipId(shipId);
}

function formatNodeWithMoon(nodeId) {
  return nodeLabel(nodeId);
}

function formatShipContext({ callsign, nodeId, status }) {
  const location = formatNodeWithMoon(nodeId);
  const statusLabel = status || DEFAULT_SPEAKER_STATUS;
  return `[${callsign}, ${location} (${statusLabel})]`;
}

function playerShipStatus(ship, statusOverride = null) {
  if (statusOverride) return statusOverride;
  if (ship?.status === "enroute" || ship?.status === "arrived_pending_report") return "in transit";
  return ship?.status || DEFAULT_SPEAKER_STATUS;
}

function formatPlayerShipIdentity(ship, statusOverride = null) {
  const captain = SHIP_CAPTAINS[ship?.id] || "Capt. Unassigned";
  const contextNode = (ship?.status === "enroute" || ship?.status === "arrived_pending_report") && ship.destination
    ? ship.destination
    : ship?.at;
  return `${captain} ${formatShipContext({ callsign: playerShipCallsign(ship), nodeId: contextNode, status: playerShipStatus(ship, statusOverride) })}`;
}

function formatNpcShipContext(npc, statusOverride = null) {
  const contextNode = npc?.status === "enroute" && npc.destination ? npc.destination : npc?.at;
  return formatShipContext({
    callsign: npc?.callsign || titleCaseWords(npc?.role || "Ship"),
    nodeId: contextNode,
    status: statusOverride || npc?.status || DEFAULT_SPEAKER_STATUS,
  });
}

function formatNpcShipIdentity(npc, statusOverride = null) {
  return `${npc?.captainName || "Capt. Unassigned"} ${formatNpcShipContext(npc, statusOverride)}`;
}

function speakerContext(name, statusOverride) {
  const ambientStatusMatch = /^ambient-npc:(.+)$/i.exec(String(statusOverride || ""));
  if (ambientStatusMatch) {
    const ambientNpc = (state.civilianNpcs || []).find((npc) => npc.id === ambientStatusMatch[1]);
    if (ambientNpc) return formatNpcShipContext(ambientNpc);
  }

  const shipId = Object.keys(SHIP_CAPTAINS).find((id) => SHIP_CAPTAINS[id] === name);
  if (shipId) {
    const ship = state.ships.find((s) => s.id === shipId);
    if (!ship) return "";
    const contextNode = (ship.status === "enroute" || ship.status === "arrived_pending_report") && ship.destination ? ship.destination : ship.at;
    return formatShipContext({ callsign: playerShipCallsign(ship), nodeId: contextNode, status: playerShipStatus(ship, statusOverride) });
  }

  const ambientNpc = (state.civilianNpcs || []).find((npc) => npc.captainName === name);
  if (ambientNpc) return formatNpcShipContext(ambientNpc, statusOverride);

  const portAuthorityMoon = portAuthorityMoonForName(name);
  if (portAuthorityMoon) return `[Port Authority (${portAuthorityMoon})]`;

  const contactProfile = CONTACT_PROFILES[name];
  if (contactProfile?.nodeId && nodes[contactProfile.nodeId]) {
    const location = formatNodeWithMoon(contactProfile.nodeId);
    const shipTag = contactProfile.shipTag ? `${contactProfile.shipTag}, ` : "";
    return `[${shipTag}${location} (${statusOverride || DEFAULT_SPEAKER_STATUS})]`;
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

function characterRegistryCategory(name) {
  const canonicalNames = state.characterNameRegistry?.canonicalUsedNames;
  if (!Array.isArray(canonicalNames)) return "";
  const entry = canonicalNames.find((candidate) => candidate?.name === name);
  return String(entry?.category || "").toLowerCase();
}

function isBluFreightPersonnel(name) {
  if (!name || name === BASIL_NAME || name === BUDDE_NAME) return false;
  if (name === "Gregory Trundle") return true;
  if (SHIP_CAPTAINS && Object.values(SHIP_CAPTAINS).includes(name)) return true;
  const faction = String(state.dialogueDb?.[name]?.faction || "").toLowerCase();
  if (faction === "blufreight") return true;
  return characterRegistryCategory(name).startsWith("blufreight_");
}

function speakerMessageType(name) {
  if (name === BASIL_NAME) return "basil";
  if (name === BUDDE_NAME) return "budde";

  const ambientNpc = (state.civilianNpcs || []).find((npc) => npc.captainName === name);
  const fallbackFaction = ambientNpc?.faction || NPC_CAPTAIN_FACTIONS[name] || "";
  const faction = String(state.dialogueDb?.[name]?.faction || fallbackFaction).toLowerCase();
  if (isBluFreightPersonnel(name)) return "comms-blufreight";
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

function scheduleCharacterMessage(delay, characterName, text, statusOverride = null, type = "comms", shouldDeliver = null) {
  const isBluFreightCaptain = Object.values(SHIP_CAPTAINS).includes(characterName);
  const resolvedType = type === "comms"
    ? (isBluFreightCaptain ? "comms-blufreight" : speakerMessageType(characterName))
    : type;
  scheduleMessage(delay, () => {
    if (typeof shouldDeliver === "function" && !shouldDeliver()) return null;
    if (!isContactPresent(characterName)) return null;
    return `${characterName} ${speakerContext(characterName, statusOverride)}: ${text}`;
  }, resolvedType);
}

let PlayerHailFlow;

async function loadReferenceData() {
  try {
    const noCache = { cache: "no-store" };
    const [loreResponse, dialogueResponse, mapResponse, buddeResponse, scenarioResponse, almanacResponse, shipRegistryResponse, nameRegistryResponse, conflictOutcomesResponse] = await Promise.all([
      fetch("./bluFreight%20text%20RTS.txt", noCache),
      fetch("./indigo_dialogue_characters.json", noCache),
      fetch("./map.json", noCache),
      fetch("./budde.json", noCache),
      fetch(SCENARIO_PATH, noCache),
      fetch(ALMANAC_PATH, noCache),
      fetch("./ship_registry.json", noCache),
      fetch("./character_name_registry.json", noCache),
      fetch(CONFLICT_OUTCOMES_PATH, noCache),
    ]);

    if (loreResponse.ok) {
      const loreText = await loreResponse.text();
      const condensed = loreText.replace(/\s+/g, " ").trim();
      if (condensed.length) state.loreSummary = condensed.slice(0, 340);
    }

    if (dialogueResponse.ok) {
      const dialogueData = await dialogueResponse.json();
      state.dialogueDb = dialogueData?.characters || dialogueData;
      state.playerRequestDialogue = dialogueData?.hailResponses || {};
      state.ambientNeutralConversation = Array.isArray(dialogueData?.ambientNeutralConversation?.lines)
        ? dialogueData.ambientNeutralConversation.lines
        : [];
      state.ambientDialoguePools = dialogueData?.ambientDialoguePools || {};
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
      state.scenario4Dialogue = scenario?.scenario4_dialogue || null;
    }


    if (almanacResponse.ok) {
      const parsedAlmanac = await almanacResponse.json();
      state.almanacEntries = parsedAlmanac?.almanac_entries || null;
    }
    if (shipRegistryResponse.ok) {
      state.shipRegistry = await shipRegistryResponse.json();
    }
    if (nameRegistryResponse.ok) {
      state.characterNameRegistry = await nameRegistryResponse.json();
    }
    if (conflictOutcomesResponse.ok) {
      state.conflictOutcomes = await conflictOutcomesResponse.json();
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

  const normalizedEntries = buildAlmanacViewModel(entries);
  Object.entries(normalizedEntries).forEach(([categoryName, categoryPayload]) => {
    const categoryNode = document.createElement("details");
    categoryNode.className = "almanac-category";

    const categorySummary = document.createElement("summary");
    categorySummary.textContent = categoryName.replaceAll("_", " ");
    categoryNode.appendChild(categorySummary);

    if (Array.isArray(categoryPayload)) {
      addAlmanacItems(categoryNode, null, categoryPayload);
    } else if (categoryPayload && typeof categoryPayload === "object") {
      Object.entries(categoryPayload).forEach(([groupName, groupEntries]) => {
        addAlmanacItems(categoryNode, groupName, groupEntries);
      });
    }
    ui.almanacRoot.appendChild(categoryNode);
  });
}

function buildAlmanacViewModel(entries) {
  const locations = entries?.locations || {};
  const organizations = entries?.organizations || {};
  const indigoSystemEntries = Array.isArray(locations?.["Indigo System"]) ? locations["Indigo System"] : [];
  const transferLaneEntries = Array.isArray(locations?.["Transfer Lanes"]) ? locations["Transfer Lanes"] : [];
  const moonEntries = Array.isArray(locations?.Moons) ? locations.Moons : [];
  const stationEntries = Array.isArray(locations?.["Stations, Outposts, and Facilities"])
    ? locations["Stations, Outposts, and Facilities"]
    : [];
  const factions = Array.isArray(organizations?.["Factions and Institutions"])
    ? organizations["Factions and Institutions"]
    : [];
  const clients = Array.isArray(organizations?.Clients) ? organizations.Clients : [];

  const orbitBandsEntry = indigoSystemEntries.find((entry) => entry?.name === "Orbit Bands");
  const orbitBandChildren = indigoSystemEntries.filter((entry) => (
    ["Low Orbit", "Ring Orbit", "High Orbit", "Outer Orbit"].includes(entry?.name)
  ));
  const indigoSystemCoreEntries = indigoSystemEntries.filter((entry) => (
    !["Low Orbit", "Ring Orbit", "High Orbit", "Outer Orbit", "Orbit Bands"].includes(entry?.name)
  ));
  const orbitBandsGroup = [];
  if (orbitBandsEntry) orbitBandsGroup.push(orbitBandsEntry);
  orbitBandsGroup.push(...orbitBandChildren);

  return {
    "Indigo System": {
      Overview: indigoSystemCoreEntries,
      "Orbit Bands": orbitBandsGroup,
      Moons: moonEntries,
      "Stations, Outposts, and Facilities": stationEntries,
      "Transfer Lanes": transferLaneEntries,
    },
    Organizations: {
      "Factions, Institutions, and Clients": [...factions, ...clients],
    },
    "Ships and Classes": Array.isArray(entries?.ships_and_classes) ? entries.ships_and_classes : [],
    "Cargo Types": Array.isArray(entries?.cargo_types) ? entries.cargo_types : [],
  };
}

function addAlmanacItems(parentNode, groupName, entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const containerNode = groupName ? document.createElement("details") : parentNode;
  if (groupName) {
    containerNode.className = "almanac-group";

    const groupSummary = document.createElement("summary");
    groupSummary.textContent = groupName;
    containerNode.appendChild(groupSummary);
  }

  entries.forEach((entry) => {
    const itemNode = document.createElement("details");
    itemNode.className = "almanac-entry";

    const itemSummary = document.createElement("summary");
    itemSummary.textContent = entry?.name || "Unnamed entry";
    itemNode.appendChild(itemSummary);

    const description = document.createElement("p");
    description.className = "almanac-entry-description";
    description.textContent = entry?.description || "No description available.";
    itemNode.appendChild(description);
    containerNode.appendChild(itemNode);
  });

  if (groupName) parentNode.appendChild(containerNode);
}

function playScenarioIntro() {
  const introLines = [
    state.scenarioDialogue?.intro_welcome,
    state.scenarioDialogue?.intro_information_integrity,
    state.scenarioDialogue?.intro_tutorial_scenario,
  ].filter(Boolean);

  if (!introLines.length) return;
  postTutorialInboxSequence(BASIL_NAME, introLines, "Tutorial briefing from BASIL received. Check Inbox tab.");
}

function playScenario2Intro() {
  const introLines = state.scenario2Dialogue?.introSequence || [];
  postTutorialInboxSequence(
    BUDDE_NAME,
    introLines.map((entry) => entry?.text).filter(Boolean),
    "Tutorial briefing from BUDDE received. Check Inbox tab.",
  );
}

function playScenario3Intro() {
  const introLines = state.scenario3Dialogue?.introSequence || [];
  postScenarioIntroInboxMessages(
    introLines.map((entry) => ({ speaker: entry?.speaker || BASIL_NAME, text: entry?.text })),
    "Scenario 3 briefing received. Check Inbox tab.",
  );
  if (!state.scenario3CapacityBriefed) {
    state.scenario3CapacityBriefed = true;
    basilInform(SCENARIO3_CAPACITY_BRIEFING);
  }
}

function playScenario4Intro() {
  const introLines = state.scenario4Dialogue?.introSequence || [];
  const inboxPayload = [];
  introLines.forEach((entry) => {
    const flagId = entry?.id;
    if (entry?.playOncePerScenario && flagId && state.scenario4Dialogue?.oneTimeFlags?.[flagId]) return;
    if (entry?.speaker && entry?.text) {
      inboxPayload.push({ speaker: entry.speaker, text: entry.text });
    }
    if (entry?.playOncePerScenario && flagId && state.scenario4Dialogue?.oneTimeFlags) {
      state.scenario4Dialogue.oneTimeFlags[flagId] = true;
    }
  });
  postScenarioIntroInboxMessages(inboxPayload, "Scenario 4 briefing received. Check Inbox tab.");
}

function setupScenario4Fleet() {
  const spawnRules = state.scenario4Dialogue?.spawnRules || {};
  const defaultSpawn = spawnRules.defaultNewShipSpawn || "yard";
  const shuttleSpawn = spawnRules?.overrides?.shuttle || defaultSpawn;
  const ensureGrantedShip = (id, at, utility = false) => {
    if (state.ships.some((ship) => ship.id === id)) return;
    state.ships.push({
      id,
      at,
      status: "idle",
      cargoCapacity: SHIP_CAPACITY_BY_ID[id] || 1,
      utility,
      dockedTo: null,
      busyUntil: 0,
      departAt: 0,
      lastKnownAt: at,
      lastContactTick: state.tick,
      acquiredAtTick: state.tick,
    });
  };
  ensureGrantedShip("hauler-3", defaultSpawn, false);
  ensureGrantedShip("tug-2", defaultSpawn, true);
  ensureGrantedShip("shuttle-1", shuttleSpawn, false);
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
    acquiredAtTick: state.tick,
  });
}

function isScenario3LowOrbitNode(nodeId) {
  return ["sulphide", "shooter"].includes(nodes[nodeId]?.moon);
}

function requestScenario3TowSupport(ship, reasonText, delay = 2) {
  if (!ship || state.scenario3TowRequestPlayed) return false;
  const captain = SHIP_CAPTAINS[ship.id];
  const tugCaptain = SHIP_CAPTAINS[TUG_ID];
  if (!captain || !tugCaptain) return false;
  scheduleCharacterMessage(
    delay,
    captain,
    `${tugCaptain}, ${reasonText}`,
    null,
    "comms"
  );
  state.scenario3TowRequestPlayed = true;
  state.scenario3TowRequestDeferred = false;
  return true;
}

function promptScenario3LowOrbitTowIfAvailable() {
  if (state.currentScenario !== 3 || state.scenario3TowRequestPlayed) return;
  const lowOrbitShip = state.ships.find((ship) => (
    !ship.utility
    && ship.status === "idle"
    && isScenario3LowOrbitNode(ship.at)
    && SHIP_CAPTAINS[ship.id]
  ));
  if (!lowOrbitShip) {
    state.scenario3TowRequestDeferred = true;
    return;
  }
  requestScenario3TowSupport(
    lowOrbitShip,
    `${formatShipId(lowOrbitShip.id)} is idle in low orbit at ${nodeLabel(lowOrbitShip.at)}. If the new tug is available, we'd appreciate a tow for the climb out.`
  );
}

function maybePromptScenario3AssignedTowSupport(ship, contract, uplink) {
  if (state.currentScenario !== 3 || !state.scenario3TowRequestDeferred || state.scenario3TowRequestPlayed) return;
  requestScenario3TowSupport(
    ship,
    `${formatShipId(ship.id)} is taking ${contract.id}; tug support would make the return leg easier if dispatch can spare you.`,
    Math.max(2, uplink * 2 + 1)
  );
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
  openContracts: visibleOpenContracts,
  fuelCostForRoute,
  nodeLabel,
  candidateDestinationsForShip,
  resolveDriveShipId: (shipId) => effectiveDriveShipId(shipId),
  buddeInform,
  buddeSpeak,
});

function scheduleMessage(delay, textOrFactory, type = "report") {
  state.delayedMessages.push({ at: state.tick + delay, text: textOrFactory, type });
}

const oneWaySignalToNode = (...args) => NavigationModel.oneWaySignalToNode(...args);
const oneWaySignalToShip = (...args) => NavigationModel.oneWaySignalToShip(...args);
const NpcController = createNpcController({
  state,
  getNodes: () => nodes,
  getAdjacency: () => adjacency,
  safeRouteDistance,
  travelTimeForRoute,
  oneWaySignalToNode,
  shipSpeedById: SHIP_SPEED_BY_ID,
  playerNodeId: PLAYER_NODE,
  nodeLabel,
  scheduleCharacterMessage,
  getShipRegistry: () => state.shipRegistry,
  getConflictOutcomes: () => state.conflictOutcomes,
  playerShipCallsign,
  onPlayerShipDestroyed: destroyPlayerShip,
  playerShipDisplayId,
  playerShipCaptainById: (shipId) => SHIP_CAPTAINS[shipId] || null,
  onConflictStage: ({ stage, nodeId, aggressorFaction, responderFaction }) => {
    applyConflictHeatStage(stage, aggressorFaction, responderFaction);
    if (stage === "fire") {
      scheduleMessage(4, () => {
        applyTrafficControlLock(nodeId, 300, "hazard clearance following weapons discharge");
        return null;
      }, "sys");
    }
  },
  onConflictFire: ({ result, collateral, campaignCombat }) => {
    applyConflictFireHeat(result, collateral, { campaignCombat });
  },
  onShipArrivedAtLocation: recordDockArrival,
  onShipDepartedFromLocation: recordDockDeparture,
});

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

function buildDepartureComms(ship, mission) {
  const captain = SHIP_CAPTAINS[ship.id];
  if (!captain) return null;
  const destinationLabel = nodeLabel(mission.destinationNodeId);
  const actionByType = {
    pickup: "cargo pickup",
    delivery: "delivery",
    reposition: "repositioning",
  };
  const purpose = actionByType[mission.actionType] || actionByType.reposition;

  const fromAngle = angleForNode(mission.fromNodeId);
  const toAngle = angleForNode(mission.destinationNodeId);
  const fromBand = orbitBandValueForNode(mission.fromNodeId);
  const toBand = orbitBandValueForNode(mission.destinationNodeId);

  let headingSegment = "heading vector unavailable";
  let telemetryRedundant = false;
  if (Number.isFinite(fromAngle) && Number.isFinite(toAngle)) {
    const ccwDelta = (toAngle - fromAngle + 360) % 360;
    const cwDelta = (fromAngle - toAngle + 360) % 360;
    if (ccwDelta <= cwDelta) headingSegment = `prograde +${ccwDelta.toFixed(1)}°`;
    else headingSegment = `retrograde -${cwDelta.toFixed(1)}°`;
    telemetryRedundant = ccwDelta === 0;
  }

  let orbitSegment = "orbit change unavailable";
  if (Number.isFinite(fromBand) && Number.isFinite(toBand)) {
    const delta = toBand - fromBand;
    if (delta > 0) orbitSegment = `climbing +${delta} band${delta === 1 ? "" : "s"}`;
    else if (delta < 0) orbitSegment = `descending ${delta} band${Math.abs(delta) === 1 ? "" : "s"}`;
    else orbitSegment = "holding current orbit band";
    telemetryRedundant = telemetryRedundant && delta === 0;
  }

  const message = telemetryRedundant
    ? `Acknowledged, Dispatch. Destination ${destinationLabel}; purpose ${purpose}.`
    : `Acknowledged, Dispatch. Destination ${destinationLabel}; purpose ${purpose}; ${headingSegment}; ${orbitSegment}.`;
  return { captain, message };
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

function playerControlledShipCount() {
  return Array.isArray(state.ships) ? state.ships.filter((ship) => !shipDestroyed(ship)).length : 0;
}

function visibleContractCount() {
  return playerControlledShipCount();
}

function visibleOpenContracts() {
  return openContracts().slice(0, visibleContractCount());
}

function contractClientClass(contract) {
  const clientKey = String(contract?.client || "none").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (clientKey === "ufp") return "contract-client-ufp";
  if (clientKey === "civilian") return "contract-client-civilian";
  if (clientKey === "station_municipal") return "contract-client-municipal";
  return "contract-client-neutral";
}

function shipRecallAvailable(ship) {
  return shipActionAvailable(ship) && (ship.status === "tasked" || ship.status === "enroute");
}

function targetOpenContractCount() {
  const target = playerControlledShipCount();
  if (state.contractBoardTargetOpen !== target) state.contractBoardTargetOpen = target;
  return state.contractBoardTargetOpen;
}

function resetContractBoardTarget() {
  state.contractBoardTargetOpen = playerControlledShipCount();
  return state.contractBoardTargetOpen;
}

function fillContractBoard({ forceNewTarget = false } = {}) {
  if (forceNewTarget) resetContractBoardTarget();
  const target = targetOpenContractCount();
  let attempts = 0;
  while (openContracts().length < target && attempts < CONTRACT_BOARD_GENERATION_ATTEMPT_LIMIT) {
    attempts += 1;
    if (!generateContract()) break;
  }
}

function shipDestroyed(ship) {
  return ship?.status === "destroyed" || ship?.combatStatus === "killed";
}

function shipActionAvailable(ship) {
  return ship && !shipDestroyed(ship);
}

function idleShip(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  return shipActionAvailable(ship) && ship.status === "idle";
}

function destroyPlayerShip(shipId, reason = "destroyed") {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return false;
  if (shipDestroyed(ship)) return true;
  if (ship.activeContractId) {
    const contract = state.contracts.find((c) => c.id === ship.activeContractId && (c.status === "assigned" || c.status === "delivered_pending_report"));
    if (contract) {
      contract.status = "open";
      contract.assignedShipId = null;
    }
  }
  if (ship.dockedTo) {
    const host = state.ships.find((entry) => entry.id === ship.dockedTo);
    if (host?.utilityDockedBy === ship.id) host.utilityDockedBy = null;
  }
  if (ship.utilityDockedBy) {
    const utility = state.ships.find((entry) => entry.id === ship.utilityDockedBy);
    if (utility) {
      utility.dockedTo = null;
      utility.status = "idle";
      utility.at = ship.at;
      utility.lastKnownAt = utility.at;
    }
  }
  ship.combatStatus = "killed";
  ship.status = "destroyed";
  ship.at = "unavailable";
  ship.lastKnownAt = "unavailable";
  ship.destination = undefined;
  ship.activeContractId = undefined;
  ship.departAt = 0;
  ship.busyUntil = 0;
  ship.dockedTo = null;
  ship.utilityDockedBy = null;
  ship.travelPlan = null;
  ship.lastCombatTick = state.tick;
  logLine(`${formatShipId(ship.id)} destroyed (${reason}). Ship moved to unavailable.`, "alert");
  return true;
}

function debugKillPlayerShip(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return [`dbKill: unknown ship ${formatShipId(shipId)}.`];
  if (shipDestroyed(ship)) return [`dbKill: ${formatShipId(ship.id)} is already destroyed.`];
  destroyPlayerShip(ship.id, "debug kill");
  return [`dbKill: ${formatShipId(ship.id)} destroyed.`];
}

function contractNumber(contractId) {
  const m = String(contractId || "").match(/c-(\d+)/i);
  return m ? Number(m[1]) : null;
}

function commandPromptLabel() {
  const pending = state.selection?.pending;
  const selectedShipId = state.selection?.selectedShipId;
  if (pending === "await_route_from") return "<Map routes: from>";
  if (pending === "await_route_to") return "<Map routes: to>";
  if (pending === "await_ship" || !selectedShipId) return "<Select a ship>";
  if (pending === "await_contract") return `<${playerShipLabelById(selectedShipId)} contracts>`;
  if (pending === "await_destination") return `<${playerShipLabelById(selectedShipId)} destinations>`;
  if (pending === "await_dock_target") return `<${playerShipLabelById(selectedShipId)} dock target>`;
  return `<${playerShipLabelById(selectedShipId)} actions>`;
}

function render() {
  if (ui.cmdInput) ui.cmdInput.placeholder = commandPromptLabel();
  ui.clock.textContent = fmtTime(state.tick);
  ui.cash.textContent = String(state.cash);
  ui.rep.textContent = String(state.rep);
  ui.risk.textContent = String(state.risk);
  ui.escort.textContent = state.escort ? "On" : "Off";

  ui.contracts.innerHTML = "";
  visibleOpenContracts().forEach((c, idx) => {
    const li = document.createElement("li");
    li.className = contractClientClass(c);
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
    const displayStatus = s.status === "arrived_pending_report" ? "enroute" : s.status;
    li.textContent = `${idx + 1}. ${formatPlayerShipIdentity(s, displayStatus)} | id ${playerShipDisplayId(s) || s.id}${capacityLabel}`;
    ui.fleet.appendChild(li);
  });
  if (ui.inboxUnread) ui.inboxUnread.textContent = String(state.unreadInboxCount);
  renderNews();
  const inboxActive = ui.tabButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.tab === "inbox";
  if (inboxActive) renderInbox();
}

function inboxDisplayMessageType(msg) {
  const sender = msg?.from || msg?.speaker;
  const messageType = msg?.messageType || (sender ? speakerMessageType(sender) : "sys");
  if ((!msg?.messageType || msg.messageType === "sys") && isBluFreightPersonnel(sender)) return "comms-blufreight";
  return messageType;
}

function inboxMessageClass(messageType) {
  return `inbox-message-${String(messageType || "sys").toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
}

function normalizeHeatFaction(faction) {
  const text = String(faction || "").toLowerCase();
  if (text === "ufp" || text.includes("union of free planets")) return "ufp";
  if (text === "arcworks") return "arcworks";
  if (text === "blister") return "blister";
  return null;
}

function factionDisplayName(faction) {
  const normalized = normalizeHeatFaction(faction);
  return FACTION_DISPLAY_NAMES[normalized] || String(faction || "Unknown faction");
}

function factionHeatActive() {
  return state.factionHeatEnabled && state.currentScenario >= 3;
}

function addFactionHeat(faction, amount, options = {}) {
  const normalized = normalizeHeatFaction(faction);
  if (!normalized || (!options.force && !factionHeatActive())) return 0;
  const current = Number(state.factionHeat?.[normalized] || 0);
  const next = Math.min(FACTION_HEAT_MAX, Math.max(0, current + amount));
  state.factionHeat[normalized] = next;
  return next;
}

function factionHeatDebugLines() {
  const enabledLabel = factionHeatActive() ? "enabled" : "disabled";
  const lines = [`dbHeat: faction heat is ${enabledLabel} (scenario ${state.currentScenario}).`];
  HEAT_FACTIONS.forEach((faction) => {
    const heat = Number(state.factionHeat?.[faction] || 0);
    const probability = campaignTriggerProbability(heat, activeFactionCampaignCount());
    const campaign = activeCampaignAgainst(faction)
      ? state.activeFactionCampaigns.find((entry) => entry.defenderFaction === faction && entry.endsAt > state.tick)
      : null;
    const campaignLabel = campaign
      ? ` | active campaign: ${factionDisplayName(campaign.aggressorFaction)} attacking ${nodeLabel(campaign.locationNodeId) || "local assets"} until ${fmtTime(campaign.endsAt)}`
      : "";
    lines.push(`${factionDisplayName(faction)}: heat ${heat}/${FACTION_HEAT_CAMPAIGN_TRIGGER_THRESHOLD} | campaign chance ${(probability * 100).toFixed(0)}%${campaignLabel}`);
  });
  lines.push('Debug: type "dbwarm [faction] [amount]" to add heat against UFP, Arcworks, or Blister; type "dbcamp" to launch a campaign against the hottest faction.');
  return lines;
}

function highestHeatFaction() {
  return HEAT_FACTIONS.reduce((best, faction) => {
    const bestHeat = Number(state.factionHeat?.[best] || 0);
    const heat = Number(state.factionHeat?.[faction] || 0);
    return heat > bestHeat ? faction : best;
  }, HEAT_FACTIONS[0]);
}

function debugLaunchFactionCampaign() {
  const defender = highestHeatFaction();
  const heat = Number(state.factionHeat?.[defender] || 0);
  const campaign = startFactionCampaign(defender, { force: true });
  if (!campaign) {
    return [
      `dbCamp: unable to launch campaign against ${factionDisplayName(defender)} (heat ${heat}). A campaign may already be active.`,
      ...factionHeatDebugLines(),
    ];
  }
  return [
    `dbCamp: launched ${factionDisplayName(campaign.aggressorFaction)} campaign against ${factionDisplayName(campaign.defenderFaction)} at ${nodeLabel(campaign.locationNodeId) || campaign.locationNodeId} for ${campaign.durationSeconds}s (selected heat ${heat}).`,
    ...factionHeatDebugLines(),
  ];
}

function debugWarmFactionHeat(faction, amount = 25) {
  const normalized = normalizeHeatFaction(faction);
  if (!normalized) return [`dbWarm: unknown heat faction "${faction}". Use UFP, Arcworks, or Blister.`];
  const safeAmount = Number.isFinite(amount) ? amount : 25;
  const before = Number(state.factionHeat?.[normalized] || 0);
  const after = addFactionHeat(normalized, safeAmount, { force: true });
  if (factionHeatActive()) {
    state.nextFactionCampaignRollTick = Math.min(state.nextFactionCampaignRollTick || state.tick, state.tick);
    evaluateFactionCampaignTriggers();
  }
  return [
    `dbWarm: ${factionDisplayName(normalized)} heat ${before} -> ${after} (+${safeAmount}).`,
    ...factionHeatDebugLines(),
  ];
}

function heatCampaignKey(aggressorFaction, defenderFaction) {
  return `${normalizeHeatFaction(aggressorFaction)}->${normalizeHeatFaction(defenderFaction)}`;
}

function activeCampaignAgainst(defenderFaction) {
  const defender = normalizeHeatFaction(defenderFaction);
  return state.activeFactionCampaigns.some((campaign) => campaign.defenderFaction === defender && campaign.endsAt > state.tick);
}

function activeFactionCampaignCount() {
  return (state.activeFactionCampaigns || []).filter((campaign) => campaign && !campaign.resolved && campaign.endsAt > state.tick).length;
}

function chooseCampaignAggressor(defenderFaction) {
  const defender = normalizeHeatFaction(defenderFaction);
  const candidates = HEAT_FACTIONS.filter((faction) => faction !== defender);
  if (!candidates.length) return null;
  const weighted = [];
  candidates.forEach((faction) => {
    const heat = Number(state.factionHeat?.[faction] || 0);
    const weight = Math.max(1, Math.round(1 + heat / 20));
    for (let i = 0; i < weight; i += 1) weighted.push(faction);
  });
  return weighted[Math.floor(Math.random() * weighted.length)] || candidates[0];
}

function pickCampaignDurationSeconds() {
  return FACTION_HEAT_CAMPAIGN_MIN_DURATION_SECONDS
    + Math.floor(Math.random() * (FACTION_HEAT_CAMPAIGN_MAX_DURATION_SECONDS - FACTION_HEAT_CAMPAIGN_MIN_DURATION_SECONDS + 1));
}

function campaignHomeBaseCandidates(defenderFaction) {
  const defender = normalizeHeatFaction(defenderFaction);
  const explicit = CAMPAIGN_HOME_BASE_NODE_IDS[defender] || [];
  return explicit.filter((nodeId) => Boolean(nodes[nodeId]));
}

function chooseCampaignLocation(defenderFaction) {
  const candidates = campaignHomeBaseCandidates(defenderFaction);
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  if (nodes[CAMPAIGN_FALLBACK_LOCATION_NODE_ID]) return CAMPAIGN_FALLBACK_LOCATION_NODE_ID;
  return Object.keys(nodes)[0] || CAMPAIGN_FALLBACK_LOCATION_NODE_ID;
}

function postCampaignNewsCard(campaign) {
  const location = nodeLabel(campaign.locationNodeId) || "Baron's Market";
  const aggressorName = factionDisplayName(campaign.aggressorFaction);
  const defenderName = factionDisplayName(campaign.defenderFaction);
  const defenderResponse = CAMPAIGN_DEFENDER_RESPONSE_LINES[Math.floor(Math.random() * CAMPAIGN_DEFENDER_RESPONSE_LINES.length)];
  const item = {
    id: campaign.id,
    headline: `${aggressorName} attacks ${defenderName} at ${location}`,
    body: `${fmtTime(state.tick)} — System feeds report ${aggressorName} forces attacking ${defenderName} assets at ${location}. ${defenderName} response: “${defenderResponse}” Campaign monitors expect the action to remain active for ${campaign.durationSeconds}s.`,
    tick: state.tick,
    timestamp: fmtTime(state.tick),
    aggressorFaction: campaign.aggressorFaction,
    defenderFaction: campaign.defenderFaction,
    location,
  };
  state.news.push(item);
  renderNews();
  logLine(`News update: ${item.headline}.`, "sys");
}

function startFactionCampaign(defenderFaction, options = {}) {
  if (!options.force && !factionHeatActive()) return null;
  const defender = normalizeHeatFaction(defenderFaction);
  if (!defender || activeCampaignAgainst(defender)) return null;
  const aggressor = chooseCampaignAggressor(defender);
  if (!aggressor) return null;
  const durationSeconds = pickCampaignDurationSeconds();
  const campaign = {
    id: `campaign-${state.tick}-${aggressor}-${defender}`,
    key: heatCampaignKey(aggressor, defender),
    aggressorFaction: aggressor,
    defenderFaction: defender,
    locationNodeId: chooseCampaignLocation(defender),
    startedAt: state.tick,
    durationSeconds,
    endsAt: state.tick + durationSeconds,
  };
  state.activeFactionCampaigns.push(campaign);
  if (NpcController?.startCampaign) NpcController.startCampaign(campaign);
  postCampaignNewsCard(campaign);
  return campaign;
}

function campaignTriggerProbability(heat, concurrentCampaignCount = 0) {
  if (heat < FACTION_HEAT_CAMPAIGN_ROLL_FLOOR) return 0;
  const excessHeat = Math.max(0, heat - FACTION_HEAT_CAMPAIGN_ROLL_FLOOR);
  const asymptoticHeatFactor = 1 - Math.exp(-excessHeat / FACTION_HEAT_CAMPAIGN_PROBABILITY_HEAT_SCALE);
  const concurrentDecay = Math.pow(FACTION_HEAT_CAMPAIGN_CONCURRENT_DECAY, Math.max(0, concurrentCampaignCount));
  return FACTION_HEAT_CAMPAIGN_PROBABILITY_ASYMPTOTE * asymptoticHeatFactor * concurrentDecay;
}

function evaluateFactionCampaignTriggers() {
  if (!factionHeatActive() || state.tick < state.nextFactionCampaignRollTick) return;
  state.nextFactionCampaignRollTick = state.tick + FACTION_HEAT_CAMPAIGN_ROLL_INTERVAL_SECONDS;
  HEAT_FACTIONS.forEach((faction) => {
    if (activeCampaignAgainst(faction)) return;
    const heat = Number(state.factionHeat?.[faction] || 0);
    const probability = campaignTriggerProbability(heat, activeFactionCampaignCount());
    if (probability > 0 && Math.random() < probability) startFactionCampaign(faction);
  });
}

function updateFactionCampaigns() {
  if (!factionHeatActive()) return;
  (state.activeFactionCampaigns || []).forEach((campaign) => {
    if (campaign.endsAt <= state.tick && !campaign.resolved) {
      campaign.resolved = true;
      if (campaign.defenderFaction) state.factionHeat[campaign.defenderFaction] = 0;
      const location = nodeLabel(campaign.locationNodeId || CAMPAIGN_FALLBACK_LOCATION_NODE_ID) || "Baron's Market";
      state.news.push({
        id: `${campaign.id}-resolved`,
        headline: `${factionDisplayName(campaign.aggressorFaction)} campaign at ${location} winds down`,
        body: `${fmtTime(state.tick)} — The ${factionDisplayName(campaign.aggressorFaction)} campaign against ${factionDisplayName(campaign.defenderFaction)} at ${location} has ended. Heat on ${factionDisplayName(campaign.defenderFaction)} has reset.`,
        tick: state.tick,
        timestamp: fmtTime(state.tick),
        aggressorFaction: campaign.aggressorFaction,
        defenderFaction: campaign.defenderFaction,
        location,
      });
      if (NpcController?.endCampaign) NpcController.endCampaign(campaign);
      renderNews();
      logLine(`News update: ${factionDisplayName(campaign.aggressorFaction)} campaign against ${factionDisplayName(campaign.defenderFaction)} has ended.`, "sys");
    }
  });
  state.activeFactionCampaigns = (state.activeFactionCampaigns || []).filter((campaign) => !campaign.resolved);
}

function applyConflictHeatStage(stage, aggressorFaction, responderFaction) {
  if (stage !== "verbal" && stage !== "intercept") return;
  const amount = FACTION_HEAT_STAGE_AMOUNT[stage] || 0;
  addFactionHeat(aggressorFaction, amount);
  addFactionHeat(responderFaction, amount);
  evaluateFactionCampaignTriggers();
}

function applyConflictFireHeat(result, collateral = false, options = {}) {
  const campaignCombat = Boolean(options.campaignCombat);
  const amount = campaignCombat
    ? (collateral ? FACTION_HEAT_CAMPAIGN_COLLATERAL_AMOUNT : FACTION_HEAT_CAMPAIGN_FIRE_AMOUNT)
    : (collateral ? FACTION_HEAT_COLLATERAL_AMOUNT : FACTION_HEAT_FIRE_AMOUNT);
  if (amount <= 0) return;
  addFactionHeat(result?.attackerFaction, amount);
  evaluateFactionCampaignTriggers();
}

function renderNews() {
  if (!ui.newsList) return;
  ui.newsList.innerHTML = "";
  const ordered = [...(state.news || [])].reverse();
  ordered.forEach((item) => {
    const li = document.createElement("li");
    li.className = "news-item";
    const title = document.createElement("strong");
    title.textContent = `${item.timestamp || fmtTime(item.tick || state.tick)} | ${item.headline || "News update"}`;
    const body = document.createElement("p");
    body.textContent = item.body || "";
    li.appendChild(title);
    li.appendChild(body);
    ui.newsList.appendChild(li);
  });
  if (!ordered.length) {
    const li = document.createElement("li");
    li.className = "news-item news-item-empty";
    li.textContent = "No current system-wide campaign news.";
    ui.newsList.appendChild(li);
  }
}

function renderInbox() {
  if (ui.inboxUnread) ui.inboxUnread.textContent = String(state.unreadInboxCount);
  if (!ui.inboxList) return;
  const openSet = new Set(state.inboxOpenIndexes || []);
  ui.inboxList.innerHTML = "";
  const ordered = [...state.inbox].reverse();
  ordered.forEach((msg, idx) => {
    const actualIndex = state.inbox.length - 1 - idx;
    const li = document.createElement("li");
    const messageType = inboxDisplayMessageType(msg);
    li.className = `inbox-item ${inboxMessageClass(messageType)}`;
    const details = document.createElement("details");
    details.className = "inbox-mail";
    details.open = openSet.has(actualIndex);
    details.addEventListener("toggle", () => {
      const current = new Set(state.inboxOpenIndexes || []);
      if (details.open) current.add(actualIndex);
      else current.delete(actualIndex);
      state.inboxOpenIndexes = [...current].sort((a, b) => a - b);
    });

    const summary = document.createElement("summary");
    summary.className = "inbox-mail-summary";
    const subject = msg.subject || `${msg.speaker || "System"} message`;
    const from = msg.from || msg.speaker || "System";
    const stamp = msg.timestamp || fmtTime(msg.tick || state.tick);
    summary.textContent = `${stamp} | From: ${from} | ${subject}`;
    details.appendChild(summary);

    const body = document.createElement("p");
    body.className = `inbox-mail-body inbox-mail-body-${messageType || "sys"}`;
    body.textContent = msg.body || msg.text || "";
    details.appendChild(body);

    li.appendChild(details);
    ui.inboxList.appendChild(li);
  });
}

function activateTab(tabName) {
  ui.tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  ui.tabPanels.forEach((panel) => {
    const active = panel.id === `metrics-${tabName}`;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  if (tabName === "inbox") {
    state.unreadInboxCount = 0;
    renderInbox();
  } else if (tabName === "news") {
    renderNews();
  } else if (ui.inboxUnread) {
    ui.inboxUnread.textContent = String(state.unreadInboxCount);
  }
}

function postTutorialInboxSequence(speaker, lines, consoleNotice) {
  const filtered = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!filtered.length) return;
  const body = filtered.join("\n\n");
  const subject = `${speaker} Tutorial Briefing`;
  const messageType = speakerMessageType(speaker);
  state.inbox.push({ speaker, from: speaker, subject, body, messageType, tick: state.tick, timestamp: fmtTime(state.tick) });
  const inboxActive = ui.tabButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.tab === "inbox";
  if (!inboxActive) state.unreadInboxCount += 1;
  renderInbox();
  logLine(consoleNotice, "sys");
}

function postScenarioIntroInboxMessages(entries, consoleNotice) {
  const valid = Array.isArray(entries) ? entries.filter((entry) => entry?.speaker && entry?.text) : [];
  if (!valid.length) return;
  const grouped = [];
  valid.forEach((entry) => {
    const last = grouped[grouped.length - 1];
    if (last && last.speaker === entry.speaker) {
      last.lines.push(entry.text);
    } else {
      grouped.push({ speaker: entry.speaker, lines: [entry.text] });
    }
  });
  grouped.forEach((group) => {
    const messageType = speakerMessageType(group.speaker);
    state.inbox.push({
      speaker: group.speaker,
      from: group.speaker,
      cc: grouped.filter((g) => g.speaker !== group.speaker).map((g) => g.speaker),
      subject: `Scenario ${state.currentScenario} Briefing`,
      body: group.lines.join("\n\n"),
      messageType,
      tick: state.tick,
      timestamp: fmtTime(state.tick),
    });
  });
  const inboxActive = ui.tabButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.tab === "inbox";
  if (!inboxActive) state.unreadInboxCount += grouped.length;
  renderInbox();
  if (consoleNotice) logLine(consoleNotice, "sys");
}

function postOperatingExpenseReport() {
  const amount = Math.max(0, Math.round(state.operatingExpenseAccrued || 0));
  if (amount <= 0) return;
  const windowStartTick = Number.isFinite(state.operatingExpenseWindowStartTick) ? state.operatingExpenseWindowStartTick : 0;
  const windowEndTick = state.tick;
  const shipDurations = state.ships
    .map((ship) => {
      const acquiredAt = Number.isFinite(ship.acquiredAtTick) ? ship.acquiredAtTick : 0;
      const secondsControlled = Math.max(0, windowEndTick - Math.max(windowStartTick, acquiredAt));
      return { id: ship.id, secondsControlled };
    })
    .filter((entry) => entry.secondsControlled > 0);
  const durationLines = shipDurations.length
    ? shipDurations.map((entry) => `- ${formatShipId(entry.id)}: ${entry.secondsControlled}s controlled in-window`).join("\n")
    : "- No ships were under player control during this window.";
  state.inbox.push({
    speaker: "Gregory Trundle",
    from: "Gregory Trundle",
    subject: "Expense Report",
    body: `Operating expenses assessed: -$${amount}.\n\nCoverage: ${fmtTime(windowStartTick)} to ${fmtTime(windowEndTick)} (${Math.max(0, windowEndTick - windowStartTick)}s).\nShips billed this window: ${shipDurations.length}.\n\nShip control durations:\n${durationLines}\n\nRate card: $${OPERATING_COST_PER_SHIP_PER_MINUTE}/ship/minute, billed in ${OPERATING_COST_INTERVAL_SECONDS}-second intervals.

— Gregory Trundle
bluFreight Accounting.`,
    messageType: speakerMessageType("Gregory Trundle"),
    tick: state.tick,
    timestamp: fmtTime(state.tick),
  });
  state.operatingExpenseAccrued = 0;
  state.operatingExpenseWindowStartTick = windowEndTick;
  const inboxActive = ui.tabButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.tab === "inbox";
  if (!inboxActive) state.unreadInboxCount += 1;
  renderInbox();
  logLine("Operating expense report is available in Inbox.", "sys");
}

function formatTripAverage(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return "n/a";
  return (numerator / denominator).toFixed(2);
}

function numericFuelValue(report) {
  if (Number.isFinite(report?.fuelSpentValue)) return report.fuelSpentValue;
  const match = String(report?.fuelSpent || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function postTripReportToInbox(ship, report) {
  const firstMateRanked = SHIP_FIRST_MATES[ship.id] || `First Mate ${formatShipId(ship.id)}`;
  const from = firstMateRanked.replace(/^First Mate\s+/i, "");
  const hazardsText = report.hazards?.length ? report.hazards.join("; ") : "None reported";
  const elapsedSeconds = Math.round(Math.max(0, Number.isFinite(report.elapsedTimeSeconds) ? report.elapsedTimeSeconds : 0));
  const routeDistanceValue = Math.round(Math.max(0, Number.isFinite(report.routeDistance) ? report.routeDistance : 0));
  const fuelValue = Math.max(0, numericFuelValue(report));
  const elapsedMinutes = elapsedSeconds / 60;
  const body = [
    `Vessel: ${playerShipCallsign(ship)}`,
    `Outcome: ${report.outcome}`,
    `Contract: ${report.contractLabel || "None"}`,
    `Distance traveled: ${report.distanceText}`,
    `Elapsed time: ${fmtTime(elapsedSeconds)} (${elapsedSeconds}s)`,
    `Route distance: ${routeDistanceValue}`,
    `Fuel spent: ${report.fuelSpent}`,
    `Average fuel per distance: ${formatTripAverage(fuelValue, routeDistanceValue)}`,
    `Average fuel per minute: ${formatTripAverage(fuelValue, elapsedMinutes)}`,
    `Earnings: $${report.earnings || 0}`,
    `Hazards: ${hazardsText}`,
    `Damage: ${report.damage || "None reported"}`,
    `Net proceeds after expenses: $${report.netProceeds || 0}`,
    "",
    `— ${firstMateRanked}, ${playerShipCallsign(ship)}`,
  ].join("\n");
  state.inbox.push({
    speaker: from,
    from,
    subject: "Post-Trip Report",
    body,
    messageType: "comms-blufreight",
    tick: state.tick,
    timestamp: fmtTime(state.tick),
  });
  const inboxActive = ui.tabButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.tab === "inbox";
  if (!inboxActive) state.unreadInboxCount += 1;
  renderInbox();
}

function showShipsList() {
  state.ships.forEach((s, idx) => {
    const displayStatus = s.status === "arrived_pending_report" ? "enroute" : s.status;
    const dockedSuffix = s.dockedTo ? ` | docked to ${formatShipId(s.dockedTo)}` : s.utilityDockedBy ? ` | utility ${formatShipId(s.utilityDockedBy)}` : "";
    const capacityLabel = state.currentScenario >= 3 && !s.utility
      ? ` | ${s.cargoCapacity || SHIP_CAPACITY_BY_ID[s.id] || 0}T cap`
      : "";
    logLine(`${idx + 1}. ${formatPlayerShipIdentity(s, displayStatus)} | id ${playerShipDisplayId(s) || s.id}${dockedSuffix}${capacityLabel}`, "sys");
  });
  logLine("Select ship by typing its number or ID.", "sys");
}

function dockableShipsForUtility(utilityShipId) {
  const utility = state.ships.find((ship) => ship.id === utilityShipId);
  if (!utility || shipDestroyed(utility)) return [];
  return state.ships.filter((ship) => (
    shipActionAvailable(ship)
    && ship.id !== utilityShipId
    && !ship.utility
    && ship.at === utility.at
    && !ship.utilityDockedBy
  ));
}

function dockUtilityShip(utilityShipId, targetShipId) {
  const utility = state.ships.find((ship) => ship.id === utilityShipId);
  const target = state.ships.find((ship) => ship.id === targetShipId);
  if (!utility || !utility.utility || shipDestroyed(utility)) return logLine("Selected ship cannot dock.", "error");
  if (!target || target.utility || shipDestroyed(target)) return logLine("Invalid dock target.", "error");
  if (utility.at !== target.at) return logLine("Dock target must be at the same location.", "error");
  if (utility.status !== "idle") return logLine(`${formatShipId(utility.id)} is not ready to dock.`, "error");
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
  logLine(`${formatShipId(utility.id)} docked with ${formatShipId(target.id)}. ${formatShipId(target.id)} now inherits utility thrust profile while docked.`, "sys");
}

function undockUtilityShip(utilityShipId) {
  const utility = state.ships.find((ship) => ship.id === utilityShipId);
  if (!utility || !utility.utility || !utility.dockedTo) return logLine("No active dock to release.", "error");
  const target = state.ships.find((ship) => ship.id === utility.dockedTo);
  if (target && (target.status === "tasked" || target.status === "enroute")) {
    return logLine(`Cannot undock ${formatShipId(utility.id)} while ${formatShipId(target.id)} is in transit. Wait for arrival.`, "error");
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
  logLine(`${formatShipId(utility.id)} undocked and is now idle.`, "sys");
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
  if (shipDestroyed(ship)) {
    logLine(`${formatShipId(ship.id)} is destroyed and unavailable.`, "error");
    state.selection.selectedShipId = null;
    state.selection.pending = "await_ship";
    return;
  }
  if (shipId === TUG_ID && !state.tugIntroPlayed) {
    state.tugIntroPlayed = true;
    const captain = SHIP_CAPTAINS[TUG_ID];
    logLine(`${captain} ${speakerContext(captain)}: Captain Bell here. Freighters are built to cruise efficiently, but they are poor at climbing against Indigo’s gravity with a full load. Tugs are built for that job. We carry almost no cargo, but we do not take the same uphill fuel penalty a loaded freighter does, so using a tug for the climb is much more efficient than making the freighter do it alone.`, speakerMessageType(captain));
  }
  if (state.currentScenario >= 3 && !state.scenario3CapacityBriefed) {
    state.scenario3CapacityBriefed = true;
    basilInform(SCENARIO3_CAPACITY_BRIEFING);
  }
  if (state.currentScenario === 4 && shipId === "shuttle-1") {
    const flags = state.scenario4Dialogue?.oneTimeFlags;
    const shuttleGreeting = state.scenario4Dialogue?.shipSelectionGreetings?.find((entry) => entry.id === "shuttle_captain_first_selection");
    if (shuttleGreeting && !flags?.shuttle_captain_first_selection) {
      scheduleCharacterMessage(1, shuttleGreeting.speaker, shuttleGreeting.text, null, "comms");
      if (flags) flags.shuttle_captain_first_selection = true;
    }
    const buddeNote = state.scenario4Dialogue?.buddeTutorialNotes?.find((entry) => entry.id === "budde_first_shuttle_explainer");
    if (buddeNote && !flags?.budde_first_shuttle_explainer) {
      scheduleMessage(1, `${buddeNote.speaker} ${speakerContext(buddeNote.speaker)}: ${buddeNote.text}`, "budde");
      if (flags) flags.budde_first_shuttle_explainer = true;
    }
  }
  const recallOption = shipRecallAvailable(ship) ? ", R recall" : "";
  let menuOptions = `A assign, S send, I information${recallOption}. Global: F fleet, C contracts, M map, H help.`;
  if (ship.utility && ship.status === "docked") {
    menuOptions = "U undock. Global: F fleet, C contracts, M map, H help.";
  } else if (ship.utility) {
    menuOptions = `D dock, S send, I information${recallOption}. Global: F fleet, C contracts, M map, H help.`;
  }
  logLine(`${formatShipId(shipId)} selected (submenu mode). Valid inputs: ${menuOptions}`, "sys");
}

function showContractsForSelectedShip() {
  const contracts = visibleOpenContracts();
  if (!contracts.length) return logLine("No open contracts to assign.", "sys");
  logLine(`Assign ${formatShipId(state.selection.selectedShipId)} to what contract?`, "sys");
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
      fillContractBoard({ forceNewTarget: true });
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
      state.factionHeatEnabled = true;
      state.nextFactionCampaignRollTick = state.tick + FACTION_HEAT_CAMPAIGN_ROLL_INTERVAL_SECONDS;
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
      fillContractBoard({ forceNewTarget: true });
      logLine("Scenario 3 unlocked: Calibration Debt and Corrected Distances.", "sys");
      playScenario3Intro();
      promptScenario3LowOrbitTowIfAvailable();
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
      setupScenario4Fleet();
      state.contracts = state.contracts.filter((contract) => contract.status !== "open");
      fillContractBoard({ forceNewTarget: true });
      logLine("Scenario 4 unlocked: Exclusive Distribution.", "sys");
      playScenario4Intro();
    }
  }
}


PlayerHailFlow = createPlayerHailFlow({
  ui,
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
  const reportStatus = ship.status === "arrived_pending_report" ? "arrived" : ship.status;
  const locationOrDestination = ship.status === "enroute"
    ? `destination=${ship.destination || ship.at}`
    : `location=${ship.at}`;
  scheduleMessage(rtt, `Report ${formatShipId(ship.id)}: status=${reportStatus}, ${locationOrDestination}, eta=${eta}s (RTT ${rtt}s).`, "report");
  const captain = SHIP_CAPTAINS[ship.id];
  if (captain) {
    scheduleCharacterMessage(
      rtt,
      captain,
      "Responding after comms delay. Standing by for tasking.",
      null,
      "comms"
    );
  }
}

function scheduleTransitComms(ship, destination, distance, uplink) {
  const captain = SHIP_CAPTAINS[ship.id];
  if (captain) {
    scheduleFinalApproachDockingCall(ship, {
      fromNodeId: ship.at,
      destinationNodeId: destination,
      uplink,
      transitTime: distance,
    });
  }
  scheduleMessage(
    uplink + distance + oneWaySignalToNode(destination),
    `${formatShipId(ship.id)} final: arrived at ${nodeLabel(destination)}. Awaiting dispatch.`,
    "report"
  );
  if (captain) {
    scheduleCharacterMessage(
      uplink + distance + oneWaySignalToNode(destination),
      captain,
      `On station at ${nodeLabel(destination)}. Awaiting dispatch.`,
      null,
      "comms"
    );
  }
}

function scheduleFinalApproachDockingCall(ship, {
  fromNodeId,
  destinationNodeId,
  uplink,
  transitTime,
  departureOffset = 0,
}) {
  const captain = SHIP_CAPTAINS[ship.id];
  if (!captain || !nodes[fromNodeId] || !nodes[destinationNodeId]) return;
  const sameMoonTransit = nodes[fromNodeId].moon === nodes[destinationNodeId].moon;
  const destinationApproach = Math.max(1, Number(nodes[destinationNodeId].approach) || 1);
  const sameMoonCallDelay = 3;
  const preArrivalLead = Math.min(Math.max(2, destinationApproach), Math.max(2, Math.max(0, transitTime - 1)));
  const sameMoonOutbound = uplink + departureOffset + Math.min(sameMoonCallDelay, Math.max(0, transitTime - 1));
  const crossMoonOutbound = uplink + departureOffset + Math.max(0, transitTime - preArrivalLead);
  const shipCallAt = sameMoonTransit ? sameMoonOutbound : crossMoonOutbound;
  const approachMessageDelay = shipCallAt + oneWaySignalToNode(destinationNodeId);
  scheduleCharacterMessage(
    approachMessageDelay,
    captain,
    pickBluFreightApproachLine(captain, nodeLabel(destinationNodeId)),
    "arriving",
    "comms"
  );
  const authorityName = portAuthorityForNode(destinationNodeId);
  if (authorityName) {
    scheduleMessage(approachMessageDelay + 2, () => {
      const liveShip = state.ships.find((entry) => entry.id === ship.id);
      if (!liveShip || shipDestroyed(liveShip) || liveShip.destination !== destinationNodeId || liveShip.status !== "enroute") return null;
      liveShip.travelPlan = liveShip.travelPlan || {};
      const maintenanceHold = dockMaintenanceHoldSeconds(destinationNodeId);
      if (maintenanceHold > 0) {
        if (!liveShip.travelPlan.arrivalMaintenanceHoldNotified) {
          liveShip.travelPlan.arrivalMaintenanceHoldNotified = true;
          announcePortAuthorityMaintenanceHold(liveShip, destinationNodeId, "arrival", maintenanceHold);
        }
        liveShip.busyUntil += maintenanceHold;
        return null;
      }
      if (liveShip.travelPlan.arrivalHazardRolled) return null;
      liveShip.travelPlan.arrivalHazardRolled = true;
      const hazard = randomDockHazard(destinationNodeId, "arrival");
      if (!hazard) return null;
      recordPlayerDockHazard(liveShip, destinationNodeId, "arrival", hazard);
      const delaySeconds = dockHazardDelaySeconds(hazard);
      if (delaySeconds > 0) liveShip.busyUntil += delaySeconds;
      return null;
    }, speakerMessageType(authorityName));
  }
}



function isStationNode(nodeId) {
  return /station/i.test(String(nodeId || ""));
}

function applyTrafficControlLock(nodeId, seconds, reason) {
  if (!nodeId || !isStationNode(nodeId)) return;
  const until = state.tick + seconds;
  const current = state.trafficLocks[nodeId] || 0;
  state.trafficLocks[nodeId] = Math.max(current, until);
}

function trafficLockRemaining(nodeId) {
  const until = state.trafficLocks[nodeId] || 0;
  return Math.max(0, until - state.tick);
}
function sendShip(shipId, destination) {
  const ship = state.ships.find((s) => s.id === shipId);
  const normalizedDestination = normalizeNodeInput(destination);
  if (!ship) return logLine(`Unknown ship: ${formatShipId(shipId)}.`, "error");
  if (shipDestroyed(ship)) return logLine(`${formatShipId(ship.id)} is destroyed and unavailable.`, "error");
  if (!normalizedDestination) return logLine(`Unknown destination: ${destination}.`, "error");
  if (ship.utility && ship.status === "docked") return logLine(`${formatShipId(ship.id)} is docked. Undock before moving independently.`, "error");
  if (ship.status !== "idle") return logLine(`${formatShipId(ship.id)} is busy.`, "error");
  const driveShipId = effectiveDriveShipId(ship.id);
  const uplink = oneWaySignalToShip(ship);
  const routeSpan = safeRouteDistance(ship.at, normalizedDestination);
  const transitTime = travelTimeForRoute(driveShipId, routeSpan);
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
  basilCommsLatencyLine(ship, "orders");
  ship.status = "tasked";
  ship.departAt = state.tick + uplink;
  ship.busyUntil = ship.departAt + transitTime;
  ship.destination = normalizedDestination;
  ship.lastContactTick = state.tick;
  ship.travelPlan = {
    mode: "reposition",
    startedAt: ship.departAt,
    currentLegTransit: transitTime,
    currentLegRouteSpan: routeSpan,
    currentLegFuel: shipFuelCost,
    recallNodeId: ship.at,
    destination: normalizedDestination,
    routeSpan,
    hazards: [],
    currentLegFrom: ship.at,
    currentLegTo: normalizedDestination,
  };

  scheduleTransitComms(ship, normalizedDestination, transitTime, uplink);
  state.rep = Math.min(100, state.rep + 1);
  if (fuelBillingActive()) state.cash -= shipFuelCost;
  const departureComms = buildDepartureComms(ship, {
    fromNodeId: ship.at,
    destinationNodeId: normalizedDestination,
    actionType: "reposition",
  });
  if (departureComms) {
    scheduleCharacterMessage(
      uplink * 2,
      departureComms.captain,
      departureComms.message,
      "departing",
      "comms"
    );
  }

  const fuelBillingText = fuelBillingActive() ? `fuel ${shipFuelCost}` : `fuel ${shipFuelCost} (training waiver: not charged in Scenario 1)`;
  logLine(`Transmission sent: ${formatShipId(ship.id)} -> ${destination}. Uplink ${uplink}s, transit ${transitTime}s, route span ${routeSpan}, ${fuelBillingText}.`, "dispatch");
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
  if (shipDestroyed(requestedShip)) return logLine(`${formatShipId(shipId)} is destroyed and unavailable.`, "error");
  if (requestedShip?.utility) return logLine(`${formatShipId(shipId)} cannot be assigned to contracts. Use send/dock instead.`, "error");
  if (!idleShip(shipId)) return logLine(`${formatShipId(shipId)} is not idle.`, "error");
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine(`Unknown ship: ${formatShipId(shipId)}.`, "error");
  if (state.currentScenario >= 3 && Number.isInteger(contract.cargoRequirement)) {
    const shipCapacity = ship.cargoCapacity || SHIP_CAPACITY_BY_ID[ship.id] || 0;
    if (shipCapacity < contract.cargoRequirement) {
      return logLine(
        `${formatShipId(ship.id)} capacity ${shipCapacity} is below required cargo ${contract.cargoRequirement} for ${contract.id}.`,
        "error"
      );
    }
  }
  const driveShipId = effectiveDriveShipId(ship.id);
  const uplink = oneWaySignalToShip(ship);
  basilCommsLatencyLine(ship, "orders");
  const toPickupSpan = safeRouteDistance(ship.at, contract.from);
  const toDropSpan = safeRouteDistance(contract.from, contract.to);
  const totalRouteSpan = toPickupSpan + toDropSpan;
  const total = travelTimeForRoute(driveShipId, totalRouteSpan);
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
  fillContractBoard();
  contract.assignedShipId = ship.id;
  ship.activeContractId = contract.id;
  contract.fuelCost = fuelCost;
  const firstLegTransit = travelTimeForRoute(driveShipId, toPickupSpan);
  ship.travelPlan = {
    mode: "contract",
    startedAt: ship.departAt,
    firstLegTransit,
    secondLegTransit: Math.max(0, total - firstLegTransit),
    firstLegRouteSpan: toPickupSpan,
    secondLegRouteSpan: toDropSpan,
    firstLegFuel: fuelCostForRoute(ship.at, contract.from, driveShipId),
    secondLegFuel: fuelCostForRoute(contract.from, contract.to, driveShipId),
    firstLegTo: contract.from,
    secondLegTo: contract.to,
    totalRouteSpan,
    hazards: [],
    firstLegFrom: ship.at,
    secondLegFrom: contract.from,
  };

  const fuelBillingNote = fuelBillingActive() ? `fuel ${fuelCost}.` : `fuel ${fuelCost} (training waiver: not charged in Scenario 1).`;
  logLine(`Transmission sent: ${formatShipId(ship.id)} to ${contract.id}. Uplink ${uplink}s + mission ${total}s, ${fuelBillingNote}`, "dispatch");
  maybePromptScenario3AssignedTowSupport(ship, contract, uplink);
  const returnSignal = oneWaySignalToNode(contract.to);
  basilInform(
    `${formatShipId(ship.id)} mission timing: uplink ${uplink}s, transit ${total}s (speed ${shipSpeed(driveShipId)}), route span ${toPickupSpan + toDropSpan}, fuel ${fuelCost}, return signal ${returnSignal}s. Confirmation ETA: ${uplink + total + returnSignal}s.`
  );
  const captain = SHIP_CAPTAINS[ship.id];
  const firstLegDestination = ship.at === contract.from ? contract.to : contract.from;
  const actionType = ship.at === contract.from ? "delivery" : "pickup";
  const departureComms = buildDepartureComms(ship, {
    fromNodeId: ship.at,
    destinationNodeId: firstLegDestination,
    actionType,
  });
  if (departureComms) {
    scheduleCharacterMessage(
      uplink * 2,
      departureComms.captain,
      departureComms.message,
      "departing",
      "comms"
    );
  }
  if (ship.at !== contract.from) {
    const firstLegTransit = travelTimeForRoute(driveShipId, toPickupSpan);
    const legTwoComms = buildDepartureComms(ship, {
      fromNodeId: contract.from,
      destinationNodeId: contract.to,
      actionType: "delivery",
    });
    if (legTwoComms) {
      scheduleCharacterMessage(
        uplink + firstLegTransit + oneWaySignalToNode(contract.from),
        legTwoComms.captain,
        `Cargo loaded. ${legTwoComms.message.replace("Acknowledged, Dispatch. ", "")}`,
        "departing",
        "comms"
      );
    }
  }
  if (captain) {
    const finalLegTransit = Math.max(1, total - firstLegTransit);
    const finalLegDepartureOffset = ship.at === contract.from ? 0 : firstLegTransit;
    scheduleFinalApproachDockingCall(ship, {
      fromNodeId: contract.from,
      destinationNodeId: contract.to,
      uplink,
      transitTime: finalLegTransit,
      departureOffset: finalLegDepartureOffset,
    });
  }
  scheduleMessage(
    uplink + total + oneWaySignalToNode(contract.to),
    () => {
      const liveContract = state.contracts.find((c) => c.id === contract.id);
      const liveShip = state.ships.find((s) => s.id === ship.id);
      if (!liveContract || !liveShip) return null;
      const contractStillDelivering = ["assigned", "delivered_pending_report", "completed"].includes(liveContract.status);
      const shipConsistent = liveShip.activeContractId === contract.id || liveShip.at === contract.to;
      if (!contractStillDelivering || !shipConsistent) return null;
      return `${formatShipId(ship.id)} delivered ${contract.id} at ${nodeLabel(contract.to)}.`;
    },
    "report"
  );
  if (captain) {
    const completionLine = "Delivery complete.";
    scheduleMessage(
      uplink + total + oneWaySignalToNode(contract.to),
      () => {
        const liveContract = state.contracts.find((c) => c.id === contract.id);
        if (!liveContract || (liveContract.status !== "delivered_pending_report" && liveContract.status !== "completed")) return null;
        scheduleCharacterMessage(0, captain, completionLine, null, "comms");
        return null;
      },
      "sys"
    );
  }

  maybeIntroduceBudde();
  return true;
}

function recallShip(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine("Selected ship is unavailable.", "error");
  if (ship.status !== "tasked" && ship.status !== "enroute") {
    const uplink = oneWaySignalToShip(ship);
    const rtt = uplink * 2;
    basilInform(`Recall request queued for ${formatShipId(ship.id)}. Expected confirmation in ~${rtt}s.`);
    scheduleMessage(
      rtt,
      `${formatShipId(ship.id)} recall response: impossible. Ship has already completed the active leg.`,
      "report"
    );
    return true;
  }
  const driveShipId = effectiveDriveShipId(ship.id);
  const plan = ship.travelPlan || {};
  const elapsed = Math.max(0, state.tick - (ship.departAt || state.tick));
  let legElapsed = elapsed;
  let recallNodeId = plan.recallNodeId || ship.lastKnownAt || ship.at;
  let currentLegTransit = Number.isFinite(plan.currentLegTransit) ? plan.currentLegTransit : Math.max(1, ship.busyUntil - ship.departAt);
  let currentLegFuel = Number.isFinite(plan.currentLegFuel) ? plan.currentLegFuel : fuelCostForRoute(recallNodeId, ship.destination || recallNodeId, driveShipId);
  let currentLegFrom = plan.currentLegFrom || recallNodeId;
  let currentLegTo = plan.currentLegTo || ship.destination || recallNodeId;
  if (plan.mode === "contract") {
    const firstLegTransit = Number.isFinite(plan.firstLegTransit) ? plan.firstLegTransit : 0;
    if (elapsed > firstLegTransit) {
      recallNodeId = plan.firstLegTo || recallNodeId;
      currentLegTransit = Number.isFinite(plan.secondLegTransit) ? plan.secondLegTransit : currentLegTransit;
      currentLegFuel = Number.isFinite(plan.secondLegFuel) ? plan.secondLegFuel : currentLegFuel;
      currentLegFrom = plan.secondLegFrom || recallNodeId;
      currentLegTo = plan.secondLegTo || ship.destination || recallNodeId;
      legElapsed = elapsed - firstLegTransit;
    } else {
      recallNodeId = ship.lastKnownAt || ship.at;
      currentLegTransit = Math.max(1, firstLegTransit || currentLegTransit);
      currentLegFuel = Number.isFinite(plan.firstLegFuel) ? plan.firstLegFuel : currentLegFuel;
      currentLegFrom = plan.firstLegFrom || recallNodeId;
      currentLegTo = plan.firstLegTo || ship.destination || recallNodeId;
      legElapsed = elapsed;
    }
  }
  const legProgress = Math.min(1, Math.max(0, currentLegTransit > 0 ? legElapsed / currentLegTransit : 0));
  const proratedFuelSpent = Math.round(Math.max(0, currentLegFuel * legProgress));
  const reverseLegFuelFull = Math.max(0, fuelCostForRoute(currentLegTo, currentLegFrom, driveShipId));
  const returnFuel = Math.round(reverseLegFuelFull * legProgress);
  const recallFuel = proratedFuelSpent + returnFuel;
  const currentLegSpan = Number.isFinite(plan.currentLegRouteSpan)
    ? plan.currentLegRouteSpan
    : Number.isFinite(plan.firstLegRouteSpan) && currentLegFrom === plan.firstLegFrom && currentLegTo === plan.firstLegTo
      ? plan.firstLegRouteSpan
      : Number.isFinite(plan.secondLegRouteSpan) && currentLegFrom === plan.secondLegFrom && currentLegTo === plan.secondLegTo
        ? plan.secondLegRouteSpan
        : safeRouteDistance(currentLegFrom, currentLegTo);
  const partialOutboundDistance = Math.round(Math.max(0, currentLegSpan * legProgress));
  const returnDistance = Math.round(Math.max(0, safeRouteDistance(currentLegTo, currentLegFrom) * legProgress));
  const recallRouteDistance = partialOutboundDistance + returnDistance;
  if (fuelBillingActive()) state.cash -= recallFuel;
  if (ship.activeContractId) {
    const contract = state.contracts.find((c) => c.id === ship.activeContractId && c.status === "assigned");
    if (contract) contract.status = "open";
  }
  postTripReportToInbox(ship, {
    outcome: "Recall completed",
    contractLabel: ship.activeContractId || "Cancelled active contract",
    distanceText: `Partial current leg (${Math.round(legProgress * 100)}%) + return to ${nodeLabel(recallNodeId)}`,
    fuelSpent: fuelBillingActive() ? `${recallFuel}` : `${recallFuel} (training waiver)`,
    fuelSpentValue: recallFuel,
    elapsedTimeSeconds: elapsed,
    routeDistance: recallRouteDistance,
    earnings: 0,
    hazards: plan.hazards || [],
    damage: "None reported",
    netProceeds: fuelBillingActive() ? -recallFuel : 0,
  });
  if (ship.status === "enroute") recordPlayerDockArrival(ship, recallNodeId);
  ship.status = "idle";
  ship.at = recallNodeId;
  ship.destination = undefined;
  ship.activeContractId = undefined;
  ship.departAt = 0;
  ship.busyUntil = 0;
  ship.lastKnownAt = recallNodeId;
  ship.lastContactTick = state.tick;
  ship.travelPlan = null;
  logLine(`${formatShipId(ship.id)} recalled to ${nodeLabel(recallNodeId)}. ${fuelBillingActive() ? `Fuel billed: ${recallFuel}.` : `Fuel estimate: ${recallFuel} (training waiver in effect).`}`, "dispatch");
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
  const isScenario4Qualifying = state.currentScenario === 4 && contract.client === "UFP" && String(contract.cargoType || "").toLowerCase() === "deuterium";
  const appliedPayout = isScenario4Qualifying ? 0 : contract.payout;
  state.cash += appliedPayout - missionFuelCost - (state.escort ? 60 : 0);
  const netProceeds = appliedPayout - missionFuelCost - (state.escort ? 60 : 0);
  state.rep = Math.min(100, state.rep + 2);
  state.risk = Math.max(8, state.risk - 1);
  const countsForProgress = state.currentScenario === 4
    ? isScenario4Qualifying
    : state.currentScenario === 1 || state.currentScenario >= 3 || Boolean(contract.client);
  if (countsForProgress) state.completedContracts += 1;
  const deliveryShip = state.ships.find((ship) => ship.activeContractId === contractId) || state.ships.find((ship) => ship.id === contract.assignedShipId);
  if (deliveryShip) {
    const plan = deliveryShip.travelPlan || {};
    postTripReportToInbox(deliveryShip, {
      outcome: "Delivery completed",
      contractLabel: contract.id,
      distanceText: plan.mode === "contract"
        ? `${plan.firstLegTo ? `${nodeLabel(deliveryShip.lastKnownAt || deliveryShip.at)} -> ${nodeLabel(plan.firstLegTo)}` : "Leg 1"}; ${plan.firstLegTo && plan.secondLegTo ? `${nodeLabel(plan.firstLegTo)} -> ${nodeLabel(plan.secondLegTo)}` : "Leg 2"}`
        : "Contract route complete",
      fuelSpent: `${missionFuelCost}`,
      fuelSpentValue: missionFuelCost,
      elapsedTimeSeconds: Math.max(0, (Number.isFinite(plan.completedAt) ? plan.completedAt : deliveryShip.busyUntil || state.tick) - (Number.isFinite(plan.startedAt) ? plan.startedAt : state.tick)),
      routeDistance: Number.isFinite(plan.totalRouteSpan) ? plan.totalRouteSpan : 0,
      earnings: appliedPayout,
      hazards: plan.hazards || [],
      damage: "None reported",
      netProceeds,
    });
  }
  checkScenarioCompletion();
}

function updateSimulation() {
  updateDockMaintenanceRecovery();
  if (state.tick > 0 && state.tick % OPERATING_COST_INTERVAL_SECONDS === 0) {
    const operatingCost = Math.round((state.ships.length || 0) * OPERATING_COST_PER_SHIP_PER_INTERVAL);
    if (operatingCost > 0) {
      state.cash -= operatingCost;
      state.operatingExpenseAccrued += operatingCost;
    }
  }
  if (state.tick > 0 && state.tick % OPERATING_COST_REPORT_INTERVAL_SECONDS === 0) {
    postOperatingExpenseReport();
  }
  NpcController.update();
  updateFactionCampaigns();
  evaluateFactionCampaignTriggers();
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
      const maintenanceHold = dockMaintenanceHoldSeconds(ship.at);
      if (maintenanceHold > 0) {
        if (!ship.departureMaintenanceHoldNotified) {
          scheduleMessage(oneWaySignalToNode(ship.at), () => {
            announcePortAuthorityMaintenanceHold(ship, ship.at, "departure", maintenanceHold);
            return null;
          }, "alert");
          ship.departureMaintenanceHoldNotified = true;
        }
        return;
      }
      ship.departureMaintenanceHoldNotified = false;
      const departureHold = trafficLockRemaining(ship.at);
      if (departureHold > 0) {
        if (!ship.departureTrafficHoldNotified) {
          const authorityName = portAuthorityForNode(ship.at);
          const holdSeconds = Math.max(1, departureHold);
          if (authorityName) {
            scheduleMessage(oneWaySignalToNode(ship.at), `${authorityName} ${speakerContext(authorityName)}: Negative, ${portAuthorityShipCallsign(ship)}. Hold for ${holdSeconds}s. Debris removal is active on your launch vector. Stand by for clearance.`, "alert");
          } else {
            scheduleMessage(oneWaySignalToNode(ship.at), `Port Control [${nodeLabel(ship.at)}]: ${formatShipId(ship.id)}, hold for ${holdSeconds}s while the launch vector is cleared.`, "alert");
          }
          ship.departureTrafficHoldNotified = true;
        }
        return;
      }
      ship.departureTrafficHoldNotified = false;
      let departureHazard = null;
      if (!ship.travelPlan?.departureHazardRolled) {
        if (ship.travelPlan) ship.travelPlan.departureHazardRolled = true;
        departureHazard = randomDockHazard(ship.at, "departure");
        const hazardDelay = dockHazardDelaySeconds(departureHazard);
        if (hazardDelay > 0) {
          recordPlayerDockHazard(ship, ship.at, "departure", departureHazard);
          ship.departAt += hazardDelay;
          return;
        }
      }
      recordPlayerDockDeparture(ship, ship.at, departureHazard);
      ship.status = "enroute";
    }
    if (ship.status === "enroute" && ship.travelPlan?.mode === "contract" && !ship.travelPlan.firstLegDockRecorded) {
      const firstLegTransit = Number.isFinite(ship.travelPlan.firstLegTransit) ? ship.travelPlan.firstLegTransit : 0;
      const firstLegArrivalTick = (ship.departAt || state.tick) + firstLegTransit;
      if (ship.travelPlan.firstLegTo && ship.travelPlan.firstLegFrom !== ship.travelPlan.firstLegTo && state.tick >= firstLegArrivalTick && firstLegArrivalTick < ship.busyUntil) {
        recordPlayerDockArrival(ship, ship.travelPlan.firstLegTo);
        if ((ship.travelPlan.secondLegTransit || 0) > 0) recordPlayerDockDeparture(ship, ship.travelPlan.firstLegTo);
        ship.travelPlan.firstLegDockRecorded = true;
      } else if (state.tick >= firstLegArrivalTick) {
        ship.travelPlan.firstLegDockRecorded = true;
      }
    }
    if (ship.status === "enroute" && state.tick >= ship.busyUntil) {
      const arrivalNodeId = ship.destination;
      const returnSignal = oneWaySignalToNode(arrivalNodeId);
      const maintenanceHold = dockMaintenanceHoldSeconds(arrivalNodeId);
      if (maintenanceHold > 0) {
        if (!ship.arrivalMaintenanceHoldNotified) {
          scheduleMessage(returnSignal, () => {
            announcePortAuthorityMaintenanceHold(ship, arrivalNodeId, "arrival", maintenanceHold);
            return null;
          }, "alert");
          ship.arrivalMaintenanceHoldNotified = true;
        }
        ship.busyUntil += 1;
        return;
      }
      ship.arrivalMaintenanceHoldNotified = false;
      const arrivalLock = trafficLockRemaining(arrivalNodeId);
      if (arrivalLock > 0) {
        if (isStationNode(arrivalNodeId) && ship.faction === "blufreight" && !ship.trafficHoldNotified) {
          const holdSeconds = Math.max(1, arrivalLock);
          const authorityName = portAuthorityForNode(arrivalNodeId);
          const message = authorityName
            ? `${authorityName} ${speakerContext(authorityName)}: Negative, ${portAuthorityShipCallsign(ship)}. Hold pattern for ${holdSeconds}s. Debris removal is active in the final docking corridor. Stand by for clearance.`
            : `Port Control [${nodeLabel(arrivalNodeId)}]: ${formatShipId(ship.id)}, hold short of final docking corridor. Delay in effect for approximately ${holdSeconds}s while traffic hazards are cleared.`;
          scheduleMessage(returnSignal, message, authorityName ? "alert" : "comms");
          ship.trafficHoldNotified = true;
        }
        ship.busyUntil += 1;
        return;
      }
      ship.trafficHoldNotified = false;
      if (!isStationNode(arrivalNodeId) && Math.random() < (1 / 3)) {
        ship.travelPlan = ship.travelPlan || {};
        ship.travelPlan.hazards = Array.isArray(ship.travelPlan.hazards) ? ship.travelPlan.hazards : [];
        ship.travelPlan.hazards.push("Minor transit damage from local fire-zone traffic");
      }
      if (ship.activeContractId) {
        const contract = state.contracts.find((c) => c.id === ship.activeContractId);
        if (contract && contract.status === "assigned") {
          contract.status = "delivered_pending_report";
          scheduleMessage(returnSignal, () => {
            finalizeContractDelivery(contract.id);
            return null;
          }, "sys");
        }
      }
      recordPlayerDockArrival(ship, arrivalNodeId);
      ship.at = arrivalNodeId;
      ship.status = "arrived_pending_report";
      ship.departAt = 0;
      scheduleMessage(returnSignal, () => {
        if (shipDestroyed(ship)) return null;
        ship.destination = undefined;
        ship.activeContractId = undefined;
        ship.status = "idle";
        ship.lastKnownAt = ship.at;
        ship.lastContactTick = state.tick;
        ship.travelPlan = null;
        return null;
      }, "sys");
    }
  });

  const due = state.delayedMessages.filter((m) => m.at <= state.tick);
  due.forEach((m) => {
    const text = typeof m.text === "function" ? m.text() : m.text;
    if (!text) return;
    logLine(text, m.type);
  });
  state.delayedMessages = state.delayedMessages.filter((m) => m.at > state.tick);

  fillContractBoard();

  if (state.tick % 30 === 0) {
    state.risk += Math.random() < 0.5 ? 1 : -1;
    state.risk = Math.max(8, Math.min(70, state.risk));
  }

  const ambientRollWindowReached = state.tick % 120 === 0;
  const ambientSafetyWindowExceeded = state.tick - state.lastAmbientChatterTick >= 360;
  if (ambientRollWindowReached && (Math.random() < 0.35 || ambientSafetyWindowExceeded)) {
    const ambient = ["Cmdr. Elias Thorne", "Capt. Hadrik Venn", "Port Marshal Celia Wren"].filter(isContactPresent);
    if (ambient.length) {
      const speaker = ambient[Math.floor(Math.random() * ambient.length)];
      const tone = state.risk >= 35 ? "negative" : "neutral";
      const line = pickLine(speaker, tone) || "Traffic conditions noted.";
      if (line !== state.lastAmbientLine) {
        state.lastAmbientLine = line;
        state.lastAmbientChatterTick = state.tick;
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
  playerShipDisplayId,
  openContracts: visibleOpenContracts,
  contractNumber,
  assignContract,
  sendShip,
  recallShip,
  canRecallShip: (shipId) => shipRecallAvailable(state.ships.find((ship) => ship.id === shipId)),
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
  formatNpcShipIdentity,
  pickLine,
  speakerMessageType,
  characterSpeak,
  buddeInform,
  buildBuddeRouteBrief,
  playerHailFlow: PlayerHailFlow,
  tutorialGoal: TUTORIAL_GOAL,
  npcConflictDebugLines: () => NpcController.getConflictDebugLines(),
  bumpNpcConflictStress: (index, amount) => NpcController.bumpConflictStress(index, amount),
  factionHeatDebugLines,
  dockDebugLines,
  warmFactionHeat: debugWarmFactionHeat,
  launchFactionCampaign: debugLaunchFactionCampaign,
  debugKillPlayerShip,
  debugKillNpc: (npcId) => NpcController.debugKillNpc(npcId),
});
NpcController.bootstrap();

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

ui.copyConsole?.addEventListener("click", (event) => {
  event.preventDefault();
  copyConsoleToClipboard();
});

ui.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab || "contracts");
  });
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
    syncDockConditionsToActiveLocations();
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
  }, 1000);
}

init();
