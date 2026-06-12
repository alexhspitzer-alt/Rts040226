const NPC_LOITER_MIN = 40;
const NPC_LOITER_MAX = 360;
const NPC_LOITER_MODE = 200;
const NPC_LINE_REPEAT_WINDOW = 120;
const CONFLICT_HEARTBEAT_SECONDS = 10;

const AMBIENT_LOCATION_SPAWN_INTERVAL = 12;
const AMBIENT_LOCATION_SPAWN_CHANCE = 0.75;
const AMBIENT_LOCATION_MAX_SHIPS = 24;
const AMBIENT_LOCATION_MAX_PER_NODE = 4;
const AMBIENT_HOME_BASE_CAP_BONUS = 2;
const AMBIENT_HOME_BASE_FACTION_SHIP_CHANCE = 0.75;
const AMBIENT_HOME_BASE_MIN_FACTION_SHIPS = 2;
const AMBIENT_LOCATION_DIALOGUE_MIN = 360;
const AMBIENT_LOCATION_DIALOGUE_MAX = 720;
const AMBIENT_LOCATION_DIALOGUE_GLOBAL_MIN_GAP = 45;
const AMBIENT_LOCATION_REMOVE_INTERVAL = 30;
const AMBIENT_LOCATION_REMOVE_CHANCE = 0.25;
const AMBIENT_LOCATION_REMOVE_DIALOGUE_GRACE = 60;
const AMBIENT_LOCATION_MIN_AGE_BEFORE_REMOVE = 45;

const AMBIENT_NEUTRAL_LINES = [
  "Holding local pattern. Traffic looks orderly from here.",
  "Copy local traffic. We are keeping a quiet transponder and a clean lane.",
  "No priority request from us. Just logging the local drift and staying clear.",
  "Local channel check. We are standing by and monitoring the board.",
  "Routine wait on this end. Wake is low, drives are cool, patience is negotiable.",
];


const OBSERVATION_CHATTER_CHANCE = 0.25;
const QUESTION_CHATTER_CHANCE = 0.25;

const OBSERVATION_OPENERS = [
  "Anyone else",
  "Does anyone else",
  "Am I the only one",
  "Traffic control seeing this too",
  "Quick scope check",
  "Small question",
  "Not to alarm anyone, but",
];

const OBSERVATION_VERBS = [
  "seeing",
  "tracking",
  "picking up",
  "getting returns from",
  "watching",
  "reading",
];

const OBSERVATION_TAGS = {
  sensor: {
    objects: [
      "that weird blip",
      "that split return",
      "that ghost contact",
      "the lidar smear",
      "the static bloom",
    ],
    comments: [
      "Looks like a mullet.",
      "That is not moving like debris should move.",
      "It has no transponder and too much personality.",
      "The scope dislikes it.",
    ],
  },
  weather: {
    objects: [
      "that storm front",
      "that pressure curl",
      "the dust plume",
      "the thermal bloom",
      "the cold spot",
    ],
    comments: [
      "Seems like bad luck.",
      "That is either weather or a lawsuit forming.",
      "No hazard yet. Strong audition, though.",
      "I would prefer it did that somewhere else.",
    ],
  },
  debris: {
    objects: [
      "that debris cluster",
      "the loose cargo signature",
      "the tumbling object",
      "that glitter cloud",
      "the suspiciously organized debris",
    ],
    comments: [
      "Somebody lost something with opinions.",
      "If that is cargo, it has become philosophical.",
      "Probably harmless, which is what harmful things want us to think.",
      "I have seen better behavior from spilled bolts.",
    ],
  },
};

const OBSERVATION_LOCATIONS = [
  "off Indigo",
  "above Baron's Market",
  "near the Ring Transfer Lane",
  "outside Anchor Station",
  "over Oxblood",
  "below the high lane",
  "near the Corkscrew outbound marker",
  "right where the map says nothing should be",
];

function capitalizeFirst(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function makeObservation(category = null) {
  const categories = Object.keys(OBSERVATION_TAGS);
  const tag = OBSERVATION_TAGS[category] ? OBSERVATION_TAGS[category] : OBSERVATION_TAGS[randomPick(categories)];
  const opener = randomPick(OBSERVATION_OPENERS);
  const verb = randomPick(OBSERVATION_VERBS);
  const object = randomPick(tag.objects);
  const location = randomPick(OBSERVATION_LOCATIONS);
  const comment = randomPick(tag.comments);
  const questionOpeners = ["Anyone else", "Does anyone else", "Am I the only one", "Not to alarm anyone, but"];
  const openerTemplates = questionOpeners.includes(opener)
    ? [
      `${opener} ${verb} ${object} ${location}? ${comment}`,
      `${opener} ${verb} ${object}? ${comment}`,
    ]
    : [
      `${opener}: ${verb} ${object} ${location}. ${comment}`,
      `${opener}: ${verb} ${object}. ${comment}`,
    ];
  const templates = [
    randomPick(openerTemplates),
    `${capitalizeFirst(verb)} ${object} ${location}. ${comment}`,
    `${capitalizeFirst(object)} ${location}. ${comment}`,
  ];

  return randomPick(templates);
}


const QUESTION_BANKS = {
  food: {
    openers: [
      "Any recommendations for",
      "Anyone know where to get",
      "Looking for",
      "Trying to find",
      "Can anyone recommend",
      "Before morale gets worse, anyone know where to find",
      "Station traffic, requesting leads on",
      "Does anyone here trust",
    ],
    needs: [
      "good huevos rancheros",
      "coffee that tastes less like battery rinse",
      "breakfast near the docks",
      "noodles open past second shift",
      "fried plantains that are not load-bearing",
      "soup with visible ingredients",
      "a bar with actual chairs",
      "dumplings from a vendor with survivable reviews",
      "something green and recently alive",
      "eggs that did not come from a printer",
      "a sandwich that understands gravity",
      "cheap rice bowls near the commercial locks",
      "tea that does not taste like warm gasket water",
      "a pastry not wrapped in compliance plastic",
    ],
    locations: [
      "on Anchor Station",
      "near Baron's Market",
      "at Indigo Station",
      "around the Oxblood dock ring",
      "near the refinery concourse",
      "inside the low orbit transfer office",
      "by the tug berths",
      "near the commercial locks",
      "under the old arrivals board",
      "somewhere with chairs and fewer alarms",
    ],
    tags: [
      "Low gravity acceptable. Low hygiene negotiable.",
      "Crew morale is entering the soup phase.",
      "Bonus if they do not ask what ship I came in on.",
      "Preferably somewhere that accepts tired people as currency.",
      "My last vending machine interaction was personal.",
      "Asking before the captain starts eating checklist laminate.",
      "Will trade gossip, filters, or one sincere apology.",
      "Please do not recommend the place with the decorative shrimp tank again.",
      "I am not strong enough for another protein rectangle.",
    ],
  },
  repair: {
    openers: [
      "Looking for",
      "Anyone know",
      "Does anyone have",
      "Can anyone recommend",
      "Trying to find",
      "Station traffic, requesting",
      "Before we call this character-building, does anyone know",
      "Asking before maintenance becomes a spiritual issue",
    ],
    needs: [
      "someone who knows how to fix a thermoacoustic generator panel",
      "a shop that can reseal a cracked heat exchanger",
      "a tech willing to look at a whining pump bearing",
      "replacement ceramic bushings for a tug coupler",
      "a pressure-rated patch kit that is not expired",
      "a dockside welder who answers comms",
      "someone with a clean diagnostic rig",
      "a spare actuator for an old Blue-series cargo clamp",
      "a mechanic who understands pre-war refrigeration loops",
      "a panel shop that will not laugh at legacy wiring",
      "coolant hose by the meter",
      "a replacement valve that does not come with a curse",
      "a used intake fan with most of its dignity",
      "someone who can convince a cargo latch to believe in itself",
    ],
    locations: [
      "near Anchor Station",
      "at Baron's Market",
      "around Oxblood",
      "on Indigo Station",
      "near the refinery stacks",
      "by the cargo elevators",
      "inside the old maintenance arcade",
      "somewhere that is not technically a scrapyard",
      "behind the dockmaster's office",
      "near any shop with lights still on",
    ],
    tags: [
      "Preferably someone who will not call it vintage.",
      "No questions about how it happened.",
      "It is making a sound the manual describes as impossible.",
      "We already tried hitting it. That was phase one.",
      "Need skill, not confidence. Already have confidence.",
      "Cash is available. Pride is not.",
      "The smell is new, which feels diagnostically relevant.",
      "It still works if nobody looks directly at it.",
      "The panel is warm in a way I would describe as personal.",
      "Manual says replace assembly. Manual has clearly never had a budget.",
    ],
  },
  personal: {
    openers: [
      "Anyone know",
      "Looking for",
      "Trying to find",
      "Does anyone have",
      "Can anyone recommend",
      "Station traffic, deeply regrettable question",
      "Before this becomes a legal matter, anyone know",
      "Asking for someone who has made poor choices",
    ],
    needs: [
      "someone's ex-girlfriend who still has a cargo locker key",
      "a roommate willing to move out before docking fees become shared property",
      "a trading card collection appraiser who understands emotional damage",
      "a person named Kel who may or may not owe me a helmet",
      "someone who can mediate a dispute over freezer space",
      "a buyer for several thousand pre-collapse trading cards",
      "a witness who remembers who owned the purple suitcase",
      "a way to return a jacket without restarting a relationship",
      "someone who knows if holographic rookies are still worth anything",
      "a neutral third party for a roommate with ferret energy",
      "a place to sell cards without being judged by a twelve-year-old",
      "someone who can explain why my ex is listed as emergency contact on a tug lease",
      "a polite way to ask a former roommate where the good wrench went",
      "anyone who collects tournament misprints and bad decisions",
    ],
    locations: [
      "on Anchor Station",
      "near Baron's Market",
      "at Indigo Station",
      "around the Oxblood dock ring",
      "near the old market concourse",
      "by the tug berths",
      "inside the cheap lockers",
      "near customs but not too near customs",
      "somewhere discreet",
      "preferably off-channel, actually",
    ],
    tags: [
      "Payment available in cash or humiliation.",
      "No authorities unless emotionally necessary.",
      "This is not an emergency, but it is getting louder.",
      "Please do not ask follow-up questions on main channel.",
      "I have been told this is technically my fault.",
      "The cards are sleeved. The feelings are not.",
      "I need someone calm, cheap, and not friends with Mara.",
      "Prefer answers from people with no stake in the breakup.",
      "If you know what this is about, no you don't.",
      "I am trying to make the responsible choice before lunch.",
    ],
  },
};

const QUESTION_MIX_INS = {
  food: [
    "Bonus if the place is not next to my ex's favorite noodle counter.",
    "Will also accept trades for unopened card sleeves.",
    "Repair shop nearby would help, since the captain broke morale and the kettle.",
    "Need somewhere my roommate has not been banned from.",
  ],
  repair: [
    "Nearby food recommendations also accepted for the crew member holding the panel shut.",
    "Bonus if the shop accepts trading cards as collateral, hypothetically.",
    "Preferably not operated by my former roommate.",
    "If Mara works there, forget I asked.",
  ],
  personal: [
    "Food recommendations nearby also welcome because this may take a while.",
    "A repair shop with a forgiving back room would also solve part of this.",
    "Will trade coolant hose, dumplings, or rare foils.",
    "If this is about the dockside incident, different incident.",
  ],
};

function makeStationQuestion(category = null, opts = {}) {
  const categories = Object.keys(QUESTION_BANKS);
  const primary = QUESTION_BANKS[category] ? category : randomPick(categories);
  const bank = QUESTION_BANKS[primary];
  const opener = randomPick(bank.openers);
  const need = randomPick(bank.needs);
  const location = randomPick(bank.locations);
  const tagChance = opts.tagChance ?? 0.72;
  const mixChance = opts.mixChance ?? 0.24;
  const tag = Math.random() < tagChance ? ` ${randomPick(bank.tags)}` : "";
  const templates = [
    `${opener} ${need} ${location}?${tag}`,
    `${opener} ${need}?${tag}`,
    `${capitalizeFirst(need)} ${location}. Anyone have a lead?${tag}`,
    `${opener} ${location} for ${need}?${tag}`,
  ];
  let line = randomPick(templates);

  if (Math.random() < mixChance) {
    line += ` ${randomPick(QUESTION_MIX_INS[primary])}`;
  }

  return line.replace(/\s+/g, " ").trim();
}

const AMBIENT_HOME_BASE_NODE_IDS = {
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

const AMBIENT_LOCATION_SHIP_RULES = [
  {
    key: "arcworks-core",
    matches: (nodeId, label) => ["arcworks_operations_hub", "arcworks_militia_barracks", "condenser_columns", "arcworks_fuel_depot"].includes(nodeId)
      || /arcworks operations hub|arcworks militia barracks|condenser columns|arcworks fuel depot/i.test(label),
    ships: [
      { registryKey: "j-i", className: "J-I", faction: "arcworks", role: "industrial", rarity: "common", weight: 6, speed: 3 },
      { registryKey: "mm-ix", className: "MM-IX", faction: "arcworks", role: "industrial", rarity: "uncommon", weight: 3, speed: 2 },
      { registryKey: "ml-x", className: "ML-X", faction: "arcworks", role: "industrial", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "ufp-administration-science",
    matches: (nodeId, label) => ["ufp_indigo_system_administration", "ufp_science_station"].includes(nodeId)
      || /ufp indigo system administration|ufp science station/i.test(label),
    ships: [
      { registryKey: "pelican", className: "Pelican", faction: "ufp", role: "patrol", rarity: "common", weight: 6, speed: 3 },
      { registryKey: "piper", className: "Piper", faction: "ufp", role: "patrol", rarity: "uncommon", weight: 3, speed: 4 },
      { registryKey: "ibis", className: "Ibis", faction: "ufp", role: "patrol", rarity: "uncommon", weight: 3, speed: 4 },
      { registryKey: "condor", className: "Condor", faction: "ufp", role: "patrol", rarity: "uncommon", weight: 3, speed: 3 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "ufp",
    matches: (nodeId, label) => /^ufp_/i.test(nodeId) || /ufp outpost/i.test(label),
    ships: [
      { registryKey: "piper", className: "Piper", faction: "ufp", role: "patrol", rarity: "uncommon", weight: 3, speed: 4 },
      { registryKey: "ibis", className: "Ibis", faction: "ufp", role: "patrol", rarity: "uncommon", weight: 3, speed: 4 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "transfer-lanes",
    matches: (nodeId, label) => /transfer_lane/i.test(nodeId) || /transfer lane/i.test(label),
    ships: [
      { registryKey: "trawler", className: "Trawler", faction: "civilian", role: "hauler", rarity: "uncommon", weight: 3, speed: 2 },
      { registryKey: "sledge", className: "Sledge", faction: "blister", role: "raider", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "refinery",
    matches: (nodeId, label) => nodeId === "refinery" || /refinery/i.test(label),
    ships: [
      { registryKey: "mm-ix", className: "MM-IX", faction: "arcworks", role: "industrial", rarity: "uncommon", weight: 3, speed: 2 },
      { registryKey: "sledge", className: "Sledge", faction: "blister", role: "raider", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "yard",
    matches: (nodeId, label) => nodeId === "yard" || /yard/i.test(label),
    ships: [
      { registryKey: "sledge", className: "Sledge", faction: "blister", role: "raider", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "barons-market",
    matches: (nodeId, label) => nodeId === "barons_market" || /baron'?s market/i.test(label),
    ships: [
      { registryKey: "skiff", className: "Skiff", faction: "civilian", role: "civilian", rarity: "common", weight: 6, speed: 4 },
      { registryKey: "trawler", className: "Trawler", faction: "civilian", role: "hauler", rarity: "uncommon", weight: 3, speed: 2 },
      { registryKey: "constable", className: "Constable", faction: "civilian", role: "patrol", rarity: "rare", weight: 1, speed: 3 },
      { registryKey: "j-viii", className: "J-VIII", faction: "arcworks", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "pelican", className: "Pelican", faction: "ufp", role: "patrol", rarity: "rare", weight: 1, speed: 3 },
      { registryKey: "sledge", className: "Sledge", faction: "blister", role: "raider", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "ml-x", className: "ML-X", faction: "arcworks", role: "industrial", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
  {
    key: "stations",
    matches: (nodeId, label) => ["anchor_station", "indigo_station"].includes(nodeId)
      || /station/i.test(label),
    ships: [
      { registryKey: "skiff", className: "Skiff", faction: "civilian", role: "civilian", rarity: "common", weight: 6, speed: 4 },
      { registryKey: "trawler", className: "Trawler", faction: "civilian", role: "hauler", rarity: "uncommon", weight: 3, speed: 2 },
      { registryKey: "constable", className: "Constable", faction: "civilian", role: "patrol", rarity: "rare", weight: 1, speed: 3 },
      { registryKey: "j-viii", className: "J-VIII", faction: "arcworks", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
      { registryKey: "pelican", className: "Pelican", faction: "ufp", role: "patrol", rarity: "rare", weight: 1, speed: 3 },
      { registryKey: "hauler", className: "Hauler", faction: "civilian", role: "hauler", rarity: "rare", weight: 1, speed: 2 },
    ],
  },
];

const AMBIENT_CALLSIGN_WORDS = ["Bright", "Swift", "Steady", "Ready", "Brisk", "Keen", "True", "Bold", "Quick", "Calm", "Daring", "Able"];
const AMBIENT_AUTOPILOT_CAPTAIN_NAME = "Capt. AUTOPILOTv6.9";
const CONFLICT_DECAY_PER_HEARTBEAT_BASE = 0.09;
const CONFLICT_GAIN_BASE = 0.12;
const CONFLICT_MAX_STAGE_PER_HEARTBEAT = 3;
const COLLATERAL_REPRISAL_CHANCE_NO_EFFECT = 0.03;
const COLLATERAL_REPRISAL_CHANCE_MINOR_DAMAGE = 0.35;
const CAMPAIGN_ATTACK_WINDOW_SECONDS = 60;
const CAMPAIGN_ATTACKS_PER_WINDOW = 6;
const CAMPAIGN_ATTACKER_COOLDOWN_SECONDS = 25;
const CAMPAIGN_ATTACK_TICK_SECONDS = 10;
const CAMPAIGN_HEAT_HOSTILITY_MAX = 0.16;

const CAMPAIGN_ATTACKER_CLASSES_BY_FACTION = {
  ufp: {
    capital: [
      { registryKey: "condor", className: "Condor", speed: 3 },
    ],
    support: [
      { registryKey: "pelican", className: "Pelican", speed: 2 },
    ],
    light: [
      { registryKey: "kestrel", className: "Kestrel", speed: 6 },
      { registryKey: "ibis", className: "Ibis", speed: 4 },
    ],
  },
  arcworks: {
    capital: [
      { registryKey: "ml-x", className: "ML-X", speed: 1 },
    ],
    support: [
      { registryKey: "mm-ix", className: "MM-IX", speed: 2 },
    ],
    light: [
      { registryKey: "mk-iv", className: "MK-IV", speed: 3 },
    ],
  },
  blister: {
    capital: [
      { registryKey: "matador", className: "Matador", speed: 3 },
    ],
    support: [
      { registryKey: "sledge", className: "Sledge", speed: 2 },
    ],
    light: [
      { registryKey: "dragoon", className: "Dragoon", speed: 4 },
    ],
  },
};

const CAMPAIGN_SHIP_COUNT_BY_CLASS = {
  capital: { min: 1, max: 3 },
  support: { min: 2, max: 4 },
  light: { min: 3, max: 5 },
};
const CAMPAIGN_MIN_DURATION_SECONDS = 180;
const CAMPAIGN_MAX_DURATION_SECONDS = 540;
const CAMPAIGN_MIN_SHIPS = 7;
const CAMPAIGN_MAX_SHIPS = 11;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPick(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function randomLoiterSeconds() {
  const min = NPC_LOITER_MIN;
  const max = NPC_LOITER_MAX;
  const mode = NPC_LOITER_MODE;
  const u = Math.random();
  const split = (mode - min) / (max - min);
  if (u < split) {
    return Math.round(min + Math.sqrt(u * (max - min) * (mode - min)));
  }
  return Math.round(max - Math.sqrt((1 - u) * (max - min) * (max - mode)));
}

function titleCase(value) {
  return String(value || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}


const NPC_APPROACH_FACTORS = {
  civilian: {
    prefixes: ["Final approach", "Inbound", "Approach check-in", "Closing vector", "Traffic update", "On terminal approach"],
    cores: [
      (ship, destination) => `${ship} to ${destination}`,
      (ship, destination) => `${ship}, route locked for ${destination}`,
      (ship, destination) => `${ship}, descending into ${destination} corridor`,
      (ship, destination) => `${ship}, crossing onto ${destination} local traffic`,
    ],
    suffixes: [
      "requesting docking clearance.",
      "requesting dock clearance.",
      "requesting berth assignment.",
      "requesting clearance; holding published approach.",
    ],
  },
  ufp: {
    prefixes: ["Final vector", "Approach notice", "Patrol approach", "Traffic advisory", "Terminal approach", "Entry update"],
    cores: [
      (ship, destination) => `${ship} to ${destination}`,
      (ship, destination) => `${ship}, inbound ${destination}`,
      (ship, destination) => `${ship}, committing to ${destination} approach lane`,
      (ship, destination) => `${ship}, crossing onto ${destination} control volume`,
    ],
    suffixes: [
      "announcing docking.",
      "docking announcement follows.",
      "declaring docking intent.",
      "announcing terminal docking.",
    ],
  },
  arcworks: {
    prefixes: ["Transit authority notice", "Operations approach", "Arcworks traffic update", "Arrival protocol", "Control message", "Approach declaration"],
    cores: [
      (ship, destination) => `${ship} to ${destination}`,
      (ship, destination) => `${ship}, approach profile set for ${destination}`,
      (ship, destination) => `${ship}, entering ${destination} local control`,
      (ship, destination) => `${ship}, executing ${destination} arrival protocol`,
    ],
    suffixesByMode: {
      announce: ["announcing docking.", "docking declaration logged.", "announcing scheduled docking.", "docking status transmitted."],
      request: ["requesting docking clearance.", "requesting berth clearance.", "requesting local docking permission.", "requesting controlled docking access."],
    },
  },
  blister: {
    prefixes: ["Local channel", "Traffic ping", "Signal burst", "Proximity broadcast", "Open channel", "Marking channel"],
    cores: [
      (ship, destination) => `${ship} near ${destination}`,
      (ship, destination) => `${ship}, local mark active at ${destination}`,
      (ship, destination) => `${ship}, transponder hot approaching ${destination}`,
      (ship, destination) => `${ship}, signal on this channel by ${destination}`,
    ],
    suffixes: [
      (destination) => `activating transponder on local channel near ${destination}.`,
      (destination) => `local channel transponder now active for ${destination} traffic.`,
      (destination) => `broadcasting transponder mark on this channel at ${destination}.`,
      (destination) => `transponder identifier is now live near ${destination}.`,
    ],
  },
};

function pickLineVariant(pool, excludeIndex = -1) {
  if (!Array.isArray(pool) || !pool.length) return { value: null, index: -1 };
  const options = pool.map((_, idx) => idx).filter((idx) => idx !== excludeIndex);
  const idx = randomPick(options.length ? options : pool.map((_, i) => i));
  return { value: pool[idx], index: idx };
}



const FIRE_AGGRESSOR_LOCKS = [
  "Target locked",
  "Guns hot",
  "Missile lock confirmed",
  "Cannon batteries live",
  "Target solution confirmed",
  "Launch tubes green",
  "Hard lock achieved",
  "Main batteries hot",
];

const FIRE_AGGRESSOR_ACTIONS = [
  "weapons free",
  "fire at will",
  "launching missiles",
  "opening cannon fire",
  "firing on their drive section",
  "commence firing pass",
  "missiles away",
  "engage the target",
  "send the missiles",
  "all guns fire",
];

const FIRE_RESPONSE_ALERTS = [
  "Countermeasures launched",
  "Ordnance incoming",
  "We're under attack",
  "Missiles inbound",
  "Cannon fire incoming",
  "Weapons impact warning",
  "Hostile launch detected",
  "They have opened fire",
  "Direct fire incoming",
  "Hull is under fire",
];

const FIRE_RESPONSE_ACTIONS = [
  "break hard",
  "engines to full",
  "distress beacon active",
  "dumping decoys",
  "countermeasures away",
  "emergency burn now",
  "evasive burn now",
  "roll and burn clear",
  "damage crews stand by",
  "broadcasting distress",
];

function sentenceCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function buildFireBark(openers, actions) {
  return `${sentenceCase(randomPick(openers))}. ${sentenceCase(randomPick(actions))}.`;
}

function buildAggressorFireBark() {
  return buildFireBark(FIRE_AGGRESSOR_LOCKS, FIRE_AGGRESSOR_ACTIONS);
}

function buildResponderFireBark() {
  return buildFireBark(FIRE_RESPONSE_ALERTS, FIRE_RESPONSE_ACTIONS);
}

function pickConflictBark(pool) {
  if (typeof pool === "function") return pool();
  return randomPick(pool);
}

const CONFLICT_AGGRESSOR_LINES = {
  civilian: {
    notice: [
      "Civilian traffic advisory. Keep separation and confirm lane intent.",
      "Watch your wake. Civilian corridor is not your sparring ring.",
      "You are crowding commercial traffic. Correct your vector now.",
    ],
    verbal: [
      "Logging unsafe conduct and escalating to port authority review.",
      "Cute intimidation routine. I am filing this whole exchange with the marshal.",
      "Keep flexing on civilians and enjoy your hearing transcript.",
      "You are one bad turn from becoming an insurance case file.",
    ],
  },
  armed: {
    notice: [
      "Contact noted. Keep your vector predictable.",
      "You are close enough to be a problem. Fly straight.",
      "Reading your burn. Stay disciplined and this stays quiet.",
    ],
    verbal: [
      "Maintain your lane and keep your profile clean.",
      "That was a reckless line cut. Try that again and we escalate.",
      "You are broadcasting panic with your throttle. Fix it.",
      "If that attitude had a transponder code, it'd be contraband.",
    ],
    intercept: [
      "Reduce burn and prepare to be checked.",
      "Kill the swagger, hold vector, and wait for traffic control.",
      "You are now under active challenge. Keep hands visible and drives low.",
    ],
    fire: buildAggressorFireBark,
    resolved: [
      "Contact is disengaging.",
      "Disengaging. Keep your ego outside this lane.",
    ],
  },
};

const CONFLICT_RESPONDER_LINES = {
  notice: [
    "Copy. Holding vector and monitoring separation.",
    "Acknowledged. Staying in lane.",
    "Copy traffic call. Holding steady.",
  ],
  verbal: [
    "Acknowledged. Your transmission is logged.",
    "Heard you. Keep lecturing if it helps you steer better.",
    "Message received. Maybe save the drama for debrief.",
    "Copy your warning. Confidence noted; skill unconfirmed.",
  ],
  intercept: [
    "Complying under protest. Broadcasting this interaction to traffic control.",
    "Complying. This challenge is being recorded and forwarded.",
    "Holding vector under protest. Do not push this further.",
  ],
  fire: buildResponderFireBark,
  resolved: [
    "Copy disengagement. Resuming planned route.",
    "Disengagement acknowledged. Returning to traffic pattern.",
  ],
};


const NPC_SHIP_REGISTRY = {
  "npc-hauler-1": { guns: 0, armor: 1 },
  "npc-hauler-2": { guns: 0, armor: 1 },
  "npc-courier-1": { guns: 0, armor: 1 },
  "npc-courier-2": { guns: 0, armor: 1 },
  "npc-ufp-kestrel-1": { guns: 2, armor: 2 },
  "npc-ufp-kestrel-2": { guns: 2, armor: 2 },
  "npc-ufp-pelican-1": { guns: 1, armor: 3 },
  "npc-blister-dragoon-1": { guns: 2, armor: 2 },
  "npc-blister-dragoon-2": { guns: 2, armor: 2 },
  "npc-arcworks-mk4-1": { guns: 1, armor: 2 },
  "npc-arcworks-mm9-1": { guns: 1, armor: 2 },
};

const DEFAULT_NPC_COMBAT_PROFILE = { guns: 0, armor: 1 };

const NPC_SHIP_REGISTRY_KEYS = {
  "npc-hauler-1": "hauler",
  "npc-hauler-2": "hauler",
  "npc-courier-1": "courier",
  "npc-courier-2": "courier",
  "npc-ufp-kestrel-1": "kestrel",
  "npc-ufp-kestrel-2": "kestrel",
  "npc-ufp-pelican-1": "pelican",
  "npc-blister-dragoon-1": "dragoon",
  "npc-blister-dragoon-2": "dragoon",
  "npc-arcworks-mk4-1": "mk-iv",
  "npc-arcworks-mm9-1": "mm-ix",
};

export function createNpcController({
  state,
  getNodes,
  getAdjacency,
  safeRouteDistance,
  travelTimeForRoute,
  oneWaySignalToNode,
  shipSpeedById,
  playerNodeId,
  nodeLabel,
  scheduleCharacterMessage,
  getShipRegistry,
  getConflictOutcomes,
  playerShipCallsign,
  playerShipCaptainById,
  onConflictStage,
  onConflictFire,
}) {
  const recentNpcLineHistory = [];
  const conflictEncounters = new Map();
  let lastConflictHeartbeatTick = -Infinity;

  let nextAmbientLocationSpawnTick = 0;
  let nextAmbientLocationRemoveTick = 0;
  let ambientLocationSpawnSerial = 1;
  let ambientIbisFlockSerial = 1;
  let nextAmbientLocationDialogueBroadcastTick = 0;
  const ambientLocationSpawnCooldowns = new Map();
  const usedAmbientCaptainNames = new Set();

  function nodeLabelText(nodeId) {
    return String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
  }

  function weightedPick(entries) {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight || 0), 0);
    if (total <= 0) return randomPick(entries);
    let roll = Math.random() * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight || 0);
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1] || null;
  }

  function ambientRuleForNode(nodeId) {
    const label = nodeLabelText(nodeId);
    return AMBIENT_LOCATION_SHIP_RULES.find((rule) => rule.matches(nodeId, label)) || null;
  }

  function homeBaseFactionsForNode(nodeId) {
    return Object.entries(AMBIENT_HOME_BASE_NODE_IDS)
      .filter(([, nodeIds]) => nodeIds.includes(nodeId))
      .map(([faction]) => faction);
  }

  function isAmbientHomeBaseNode(nodeId) {
    return homeBaseFactionsForNode(nodeId).length > 0;
  }

  function ambientCapForNode(nodeId) {
    return AMBIENT_LOCATION_MAX_PER_NODE + (isAmbientHomeBaseNode(nodeId) ? AMBIENT_HOME_BASE_CAP_BONUS : 0);
  }

  function homeBaseNodeIds() {
    const nodeSet = new Set(Object.values(AMBIENT_HOME_BASE_NODE_IDS).flat());
    return [...nodeSet].filter((nodeId) => getNodes()?.[nodeId] && ambientRuleForNode(nodeId));
  }

  function occupiedPlayerNodeIds() {
    const occupied = new Set();
    (state.ships || []).forEach((ship) => {
      if (!ship?.at) return;
      if (["idle", "tasked", "arrived_pending_report"].includes(ship.status)) occupied.add(ship.at);
    });
    return [...occupied].filter((nodeId) => getNodes()?.[nodeId]);
  }

  function ambientNpcs() {
    return (state.civilianNpcs || []).filter((npc) => npc.ambientLocationSpawn);
  }

  function countAmbientNpcsAt(nodeId) {
    return ambientNpcs().filter((npc) => npc.at === nodeId).length;
  }

  function countAmbientNpcsAtByFaction(nodeId, faction) {
    return ambientNpcs().filter((npc) => npc.at === nodeId && npc.faction === faction).length;
  }

  function countCivilianAmbientNpcsAt(nodeId) {
    return countAmbientNpcsAtByFaction(nodeId, "civilian");
  }

  function randomAmbientCallsign(className) {
    return `${className} ${randomPick(AMBIENT_CALLSIGN_WORDS)}-${randomInt(10, 98)}`;
  }

  function normalizeFactionName(value) {
    const text = String(value || "").toLowerCase();
    if (text === "ufp" || text.includes("union of free planets")) return "ufp";
    if (text === "blister") return "blister";
    if (text === "arcworks") return "arcworks";
    if (text === "civilian" || text === "blufreight") return "civilian";
    return "civilian";
  }

  function factionForShipType(ship) {
    const registry = typeof getShipRegistry === "function" ? getShipRegistry() : null;
    const registryFaction = ship?.registryKey ? registry?.[ship.registryKey]?.faction : null;
    return normalizeFactionName(registryFaction || ship?.faction);
  }

  function chooseAmbientShipForNode(nodeId, rule) {
    const ships = Array.isArray(rule?.ships) ? rule.ships : [];
    const civilianShips = ships.filter((ship) => factionForShipType(ship) === "civilian");
    const cap = ambientCapForNode(nodeId);
    const localCount = countAmbientNpcsAt(nodeId);
    const needsCivilianReserve = countCivilianAmbientNpcsAt(nodeId) === 0;
    if (needsCivilianReserve && localCount >= cap - 1 && civilianShips.length) return weightedPick(civilianShips);

    const homeFactions = homeBaseFactionsForNode(nodeId);
    const needsHomeFaction = homeFactions.some((faction) => countAmbientNpcsAtByFaction(nodeId, faction) < AMBIENT_HOME_BASE_MIN_FACTION_SHIPS);
    if (homeFactions.length && needsHomeFaction && Math.random() < AMBIENT_HOME_BASE_FACTION_SHIP_CHANCE) {
      const homeFactionShips = ships.filter((ship) => homeFactions.includes(factionForShipType(ship)));
      if (homeFactionShips.length) return weightedPick(homeFactionShips);
    }

    return weightedPick(ships);
  }

  function formatAmbientCaptainName(name) {
    if (/^(capt\.|cmdr\.|lt\.|supervisor|dockmaster|traffic officer|port marshal)\b/i.test(name)) return name;
    return `Capt. ${name}`;
  }

  function drawAmbientCaptainName() {
    const pool = Array.isArray(state.characterNameRegistry?.randomAssignmentPool)
      ? state.characterNameRegistry.randomAssignmentPool
      : [];
    const available = pool.filter((name) => name && !usedAmbientCaptainNames.has(name));
    const name = randomPick(available);
    if (!name) return AMBIENT_AUTOPILOT_CAPTAIN_NAME;
    usedAmbientCaptainNames.add(name);
    return formatAmbientCaptainName(name);
  }

  function numberWord(value) {
    const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const number = Math.max(0, Math.floor(Number(value) || 0));
    if (number < ones.length) return ones[number];
    if (number < 100) {
      const ten = Math.floor(number / 10);
      const one = number % 10;
      return one ? `${tens[ten]}-${ones[one]}` : tens[ten];
    }
    return String(number);
  }

  function drawAmbientShipName(ship) {
    if (ship?.registryKey === "ibis") {
      const name = `Flock ${numberWord(ambientIbisFlockSerial)}`;
      ambientIbisFlockSerial += 1;
      return name;
    }
    return drawAmbientCaptainName();
  }

  function nextAmbientDialogueTick() {
    return state.tick + randomInt(AMBIENT_LOCATION_DIALOGUE_MIN, AMBIENT_LOCATION_DIALOGUE_MAX);
  }

  function neutralDialoguePool(npc = null) {
    const registryPool = npc?.registryKey
      ? state.ambientDialoguePools?.byRegistryKey?.[npc.registryKey]?.lines
      : null;
    if (Array.isArray(registryPool) && registryPool.length) return registryPool;
    if (Array.isArray(state.ambientNeutralConversation) && state.ambientNeutralConversation.length) {
      return state.ambientNeutralConversation;
    }
    const characters = state.dialogueDb || {};
    const lines = Object.values(characters).flatMap((entry) => Array.isArray(entry?.dialogue?.neutral) ? entry.dialogue.neutral : []);
    return lines.length ? lines : AMBIENT_NEUTRAL_LINES;
  }

  function commsTypeForFaction(faction) {
    if (faction === "ufp") return "comms-ufp";
    if (faction === "blister") return "comms-blister";
    if (faction === "arcworks") return "comms-arcworks";
    return "comms";
  }

  function scheduleAmbientNeutralLine(npc) {
    const chatterRoll = Math.random();
    const line = chatterRoll < OBSERVATION_CHATTER_CHANCE
      ? makeObservation()
      : chatterRoll < OBSERVATION_CHATTER_CHANCE + QUESTION_CHATTER_CHANCE
        ? makeStationQuestion()
        : randomPick(neutralDialoguePool(npc)) || randomPick(AMBIENT_NEUTRAL_LINES);
    const delay = 1;
    npc.lastDialogueTick = state.tick + delay;
    npc.dialogueCount = (npc.dialogueCount || 0) + 1;
    npc.nextDialogueTick = nextAmbientDialogueTick();
    scheduleCharacterMessage(
      delay,
      npc.captainName || npc.callsign,
      line,
      `ambient-npc:${npc.id}`,
      commsTypeForFaction(npc.faction),
      () => playerLocalToNode(npc.at)
    );
  }

  function spawnAmbientLocationShip(nodeId) {
    const rule = ambientRuleForNode(nodeId);
    if (!rule) return null;
    const ship = chooseAmbientShipForNode(nodeId, rule);
    if (!ship) return null;
    const id = `npc-local-${ship.registryKey}-${ambientLocationSpawnSerial}`;
    ambientLocationSpawnSerial += 1;
    const npc = {
      id,
      callsign: randomAmbientCallsign(ship.className),
      captainName: drawAmbientShipName(ship),
      faction: factionForShipType(ship),
      role: ship.role || "local",
      registryKey: ship.registryKey,
      at: nodeId,
      status: "idle",
      departAt: Infinity,
      arrivalTick: 0,
      ambientLocationSpawn: true,
      spawnedAtTick: state.tick,
      lastDialogueTick: -Infinity,
      dialogueCount: 0,
      nextDialogueTick: nextAmbientDialogueTick(),
    };
    if (!Array.isArray(state.civilianNpcs)) state.civilianNpcs = [];
    state.civilianNpcs.push(npc);
    const registry = typeof getShipRegistry === "function" ? getShipRegistry() : null;
    shipSpeedById[id] = registry?.[ship.registryKey]?.speed || ship.speed || 3;
    const cooldownMax = isAmbientHomeBaseNode(nodeId) ? 55 : 100;
    ambientLocationSpawnCooldowns.set(nodeId, state.tick + randomInt(25, cooldownMax));
    return npc;
  }

  function updateAmbientLocationSpawns() {
    if (state.tick < nextAmbientLocationSpawnTick) return;
    nextAmbientLocationSpawnTick = state.tick + AMBIENT_LOCATION_SPAWN_INTERVAL;
    if (ambientNpcs().length >= AMBIENT_LOCATION_MAX_SHIPS) return;
    const candidatePool = [
      ...occupiedPlayerNodeIds(),
      ...homeBaseNodeIds(),
      ...homeBaseNodeIds(),
    ];
    const candidates = candidatePool.filter((nodeId) => {
      if (!ambientRuleForNode(nodeId)) return false;
      if (countAmbientNpcsAt(nodeId) >= ambientCapForNode(nodeId)) return false;
      return state.tick >= (ambientLocationSpawnCooldowns.get(nodeId) || 0);
    });
    if (!candidates.length || Math.random() > AMBIENT_LOCATION_SPAWN_CHANCE) return;
    spawnAmbientLocationShip(randomPick(candidates));
  }

  function updateAmbientLocationDialogue() {
    ambientNpcs().forEach((npc) => {
      if (npc.status !== "idle" || !npc.at) return;
      if (state.tick < nextAmbientLocationDialogueBroadcastTick) return;
      if (state.tick >= (npc.nextDialogueTick || 0) && playerLocalToNode(npc.at)) {
        scheduleAmbientNeutralLine(npc);
        nextAmbientLocationDialogueBroadcastTick = state.tick + AMBIENT_LOCATION_DIALOGUE_GLOBAL_MIN_GAP;
      }
    });
  }

  function updateAmbientLocationRemovals() {
    if (state.tick < nextAmbientLocationRemoveTick) return;
    nextAmbientLocationRemoveTick = state.tick + AMBIENT_LOCATION_REMOVE_INTERVAL;
    if (Math.random() > AMBIENT_LOCATION_REMOVE_CHANCE) return;
    const removable = ambientNpcs().filter((npc) => {
      const oldEnough = state.tick - (npc.spawnedAtTick || 0) >= AMBIENT_LOCATION_MIN_AGE_BEFORE_REMOVE;
      const dialogueSafe = state.tick - (npc.lastDialogueTick ?? -Infinity) >= AMBIENT_LOCATION_REMOVE_DIALOGUE_GRACE;
      const protectsCivilianReserve = npc.faction === "civilian" && countCivilianAmbientNpcsAt(npc.at) <= 1;
      return oldEnough && dialogueSafe && !protectsCivilianReserve;
    });
    const npc = randomPick(removable);
    if (!npc) return;
    state.civilianNpcs = (state.civilianNpcs || []).filter((entry) => entry.id !== npc.id);
    delete shipSpeedById[npc.id];
  }

  function encounterKey(aId, bId) {
    return [aId, bId].sort().join("|");
  }

  function factionHostility(aFaction, bFaction) {
    if (aFaction === "blister" && bFaction !== "blister") return 1.25;
    if (bFaction === "blister" && aFaction !== "blister") return 1.1;
    if (aFaction === "blister" && bFaction === "blister") return 0.45;
    if ((aFaction === "ufp" || aFaction === "arcworks") && bFaction === "civilian") return 0.4;
    if ((bFaction === "ufp" || bFaction === "arcworks") && aFaction === "civilian") return 0.35;
    return 0.1;
  }

  function heatHostilityToward(targetFaction, sourceFaction) {
    if (!targetFaction || targetFaction === "civilian" || targetFaction === sourceFaction) return 0;
    const heat = Number(state.factionHeat?.[targetFaction] || 0);
    if (!Number.isFinite(heat) || heat <= 0) return 0;
    return clamp(0, CAMPAIGN_HEAT_HOSTILITY_MAX, (heat / 120) * CAMPAIGN_HEAT_HOSTILITY_MAX);
  }

  function localHostilityScore(source, target) {
    return factionHostility(source?.faction, target?.faction) + heatHostilityToward(target?.faction, source?.faction);
  }

  function chooseAggressor(a, b) {
    const ab = localHostilityScore(a, b);
    const ba = localHostilityScore(b, a);
    if (ab > ba) return { aggressor: a, responder: b, hostility: ab };
    if (ba > ab) return { aggressor: b, responder: a, hostility: ba };
    return String(a.id) <= String(b.id)
      ? { aggressor: a, responder: b, hostility: ab }
      : { aggressor: b, responder: a, hostility: ba };
  }

  function conflictStageForStress(stress) {
    if (stress >= 0.88) return "fire";
    if (stress >= 0.62) return "intercept";
    if (stress >= 0.34) return "verbal";
    return "notice";
  }

  function playerRegistryKey(ship) {
    return String(ship?.id || "").split("-")[0] || null;
  }

  function playerCollateralCandidate(ship) {
    if (!ship?.id) return null;
    const registryKey = playerRegistryKey(ship);
    const fallbackCallsign = `${titleCase(registryKey || "Ship")} Blue`;
    return {
      ...ship,
      id: ship.id,
      playerShip: true,
      sourceShip: ship,
      callsign: typeof playerShipCallsign === "function" ? playerShipCallsign(ship) : fallbackCallsign,
      captainName: typeof playerShipCaptainById === "function" ? playerShipCaptainById(ship.id) : null,
      faction: "blufreight",
      registryKey,
    };
  }

  function playerShipAvailableForCollateral(ship) {
    return ship?.id
      && ship.status !== "disabled"
      && ship.status !== "enroute"
      && ship.status !== "docked"
      && ship.combatStatus !== "major_damage"
      && ship.combatStatus !== "killed";
  }

  function shipCombatProfile(npc) {
    if (!npc?.id) return DEFAULT_NPC_COMBAT_PROFILE;
    const registry = typeof getShipRegistry === "function" ? getShipRegistry() : null;
    const registryKey = npc.registryKey || (npc.playerShip ? playerRegistryKey(npc) : null) || NPC_SHIP_REGISTRY_KEYS[npc.id];
    const registryProfile = registryKey ? registry?.[registryKey] : null;
    const guns = Number.isFinite(registryProfile?.guns) ? registryProfile.guns : null;
    const armor = Number.isFinite(registryProfile?.armor) ? registryProfile.armor : null;
    if (guns !== null || armor !== null) {
      return { guns: guns ?? DEFAULT_NPC_COMBAT_PROFILE.guns, armor: armor ?? DEFAULT_NPC_COMBAT_PROFILE.armor };
    }
    return NPC_SHIP_REGISTRY[npc.id] || DEFAULT_NPC_COMBAT_PROFILE;
  }

  function hasGuns(npc) {
    return (shipCombatProfile(npc).guns || 0) > 0;
  }

  function capStageForAggressor(stage, aggressorNpc) {
    if (!hasGuns(aggressorNpc)) {
      if (stage === "fire" || stage === "intercept") return "verbal";
    }
    return stage;
  }

  function damageChance(guns, armor) {
    if (guns <= 0) return 0;
    const safeArmor = Math.max(0, armor || 0);
    const base = safeArmor <= 0 ? 1 : guns / (guns + safeArmor);
    const underpoweredPenalty = safeArmor > guns ? Math.min(0.09, (safeArmor - guns) * 0.01) : 0;
    return clamp(0, 0.995, base - underpoweredPenalty);
  }

  function rollWeightedOutcome(weights) {
    const entries = Object.entries(weights).filter(([, probability]) => probability > 0);
    if (!entries.length) return "no_effect";
    const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
    let roll = Math.random() * total;
    for (const [outcome, probability] of entries) {
      roll -= probability;
      if (roll <= 0) return outcome;
    }
    return entries[entries.length - 1][0];
  }

  function directCombatWeights(attacker, defender) {
    const attackerProfile = shipCombatProfile(attacker);
    const defenderProfile = shipCombatProfile(defender);
    const guns = Math.max(0, attackerProfile.guns || 0);
    const armor = Math.max(0, defenderProfile.armor || 0);
    const pDamage = damageChance(guns, armor);
    const overmatch = guns - armor;
    const killShare = clamp(0.005, 0.35, 0.06 + overmatch * 0.025);
    const majorShare = clamp(0.15, 0.55, 0.30 + overmatch * 0.025);
    const minorShare = Math.max(0, 1 - killShare - majorShare);
    return {
      kill: pDamage * killShare,
      major_damage: pDamage * majorShare,
      minor_damage: pDamage * minorShare,
      no_effect: Math.max(0, 1 - pDamage),
    };
  }

  function collateralCombatWeights(attacker, defender) {
    const attackerProfile = shipCombatProfile(attacker);
    const defenderProfile = shipCombatProfile(defender);
    const pDamage = Math.min(0.2, damageChance(attackerProfile.guns || 0, defenderProfile.armor || 0) * 0.18);
    return {
      major_damage: pDamage * 0.25,
      minor_damage: pDamage * 0.75,
      no_effect: Math.max(0, 1 - pDamage),
    };
  }

  function combatStatusRank(status) {
    if (status === "killed") return 3;
    if (status === "major_damage") return 2;
    if (status === "minor_damage") return 1;
    return 0;
  }

  function applyPlayerCollateralOutcome(shipLike, outcome) {
    const ship = shipLike?.sourceShip || shipLike;
    if (!ship || outcome === "no_effect") return;
    const normalizedOutcome = outcome === "kill" ? "major_damage" : outcome;
    if (combatStatusRank(normalizedOutcome) <= combatStatusRank(ship.combatStatus)) return;
    ship.combatStatus = normalizedOutcome;
    ship.lastCombatTick = state.tick;
    if (normalizedOutcome === "major_damage") {
      ship.status = "disabled";
      ship.busyUntil = 0;
      ship.departAt = 0;
      return;
    }
    if (normalizedOutcome === "minor_damage" && ship.status === "idle") {
      ship.status = "damaged";
    }
  }

  function applyCombatOutcome(npc, outcome) {
    if (!npc || outcome === "no_effect") return;
    if (npc.playerShip) {
      applyPlayerCollateralOutcome(npc, outcome);
      return;
    }
    const normalizedOutcome = outcome === "kill" ? "killed" : outcome;
    if (combatStatusRank(normalizedOutcome) <= combatStatusRank(npc.combatStatus)) return;
    npc.combatStatus = normalizedOutcome;
    npc.lastCombatTick = state.tick;
    if (normalizedOutcome === "killed") {
      npc.status = "disabled";
      npc.departAt = Infinity;
      npc.arrivalTick = 0;
      return;
    }
    if (normalizedOutcome === "major_damage") {
      npc.status = "disabled";
      npc.departAt = Infinity;
      npc.arrivalTick = 0;
    }
  }

  function combatCapable(npc) {
    return npc && npc.combatStatus !== "killed" && npc.combatStatus !== "major_damage";
  }

  function resolveDirectCombat(attacker, defender) {
    const outcome = rollWeightedOutcome(directCombatWeights(attacker, defender));
    applyCombatOutcome(defender, outcome);
    return { attacker, defender, outcome };
  }

  function resolveCollateralCombat(attacker, defender) {
    const outcome = rollWeightedOutcome(collateralCombatWeights(attacker, defender));
    applyCombatOutcome(defender, outcome);
    return { attacker, defender, outcome };
  }

  function outcomeLabel(outcome) {
    if (outcome === "kill" || outcome === "killed") return "kill";
    if (outcome === "major_damage") return "major damage";
    if (outcome === "minor_damage") return "minor damage";
    return "no effect";
  }

  function formatCombatResultLine(result, prefix = "Fire") {
    return `[${prefix}] ${result.attacker.callsign} -> ${result.defender.callsign}: ${outcomeLabel(result.outcome)}.`;
  }

  function collateralDamageResults(results) {
    return results.filter((result) => result.outcome !== "no_effect");
  }

  function collateralReprisalChance(outcome) {
    if (outcome === "minor_damage") return COLLATERAL_REPRISAL_CHANCE_MINOR_DAMAGE;
    if (outcome === "no_effect") return COLLATERAL_REPRISAL_CHANCE_NO_EFFECT;
    return 0;
  }

  function sameFactionReprisalBlocked(attacker, target) {
    const attackerFaction = attacker?.faction || "civilian";
    const targetFaction = target?.faction || "civilian";
    return attackerFaction === targetFaction && (attackerFaction === "ufp" || attackerFaction === "arcworks");
  }

  function shouldCollateralReturnFire(result, target) {
    return combatCapable(result?.defender)
      && combatCapable(target)
      && hasGuns(result.defender)
      && !sameFactionReprisalBlocked(result.defender, target)
      && Math.random() < collateralReprisalChance(result.outcome);
  }

  function resolveCollateralVolley(attacker, primaryTarget, nodeId, excludedIds = new Set()) {
    const idsToSkip = new Set(excludedIds);
    if (attacker?.id) idsToSkip.add(attacker.id);
    if (primaryTarget?.id) idsToSkip.add(primaryTarget.id);
    const npcTargets = (state.civilianNpcs || [])
      .filter((npc) => (
        npc?.at === nodeId
        && !idsToSkip.has(npc.id)
        && mutedNpcActiveForConflict(npc)
        && npc.combatStatus !== "killed"
      ));
    const playerTargets = (state.ships || [])
      .filter((ship) => (
        ship?.at === nodeId
        && !idsToSkip.has(ship.id)
        && playerShipAvailableForCollateral(ship)
      ))
      .map(playerCollateralCandidate)
      .filter(Boolean);
    return [...npcTargets, ...playerTargets]
      .map((target) => resolveCollateralCombat(attacker, target));
  }

  function resolveCollateralReprisals(triggerResults, target, nodeId, reprisalShipIds = new Set()) {
    const reprisalEvents = [];
    const reprisalQueue = triggerResults.map((trigger) => ({ trigger, target }));
    while (reprisalQueue.length) {
      const eventSeed = reprisalQueue.shift();
      const reprisalAttacker = eventSeed.trigger.defender;
      if (!reprisalAttacker?.id || reprisalShipIds.has(reprisalAttacker.id)) continue;
      if (!shouldCollateralReturnFire(eventSeed.trigger, eventSeed.target)) continue;
      reprisalShipIds.add(reprisalAttacker.id);
      const direct = resolveDirectCombat(reprisalAttacker, eventSeed.target);
      const collateralResults = resolveCollateralVolley(reprisalAttacker, eventSeed.target, nodeId);
      reprisalEvents.push({
        trigger: eventSeed.trigger,
        direct,
        collateral: collateralDamageResults(collateralResults),
      });
      collateralResults.forEach((trigger) => {
        reprisalQueue.push({ trigger, target: reprisalAttacker });
      });
    }
    return reprisalEvents;
  }

  function collateralReprisalTriggerLabel(outcome) {
    if (outcome === "no_effect") return "shrugged off collateral fire";
    return `took ${outcomeLabel(outcome)} collateral damage`;
  }

  function formatCollateralReprisalLine(event) {
    return `${formatCombatResultLine(event.direct, "Reprisal")} Trigger: ${event.trigger.defender.callsign} ${collateralReprisalTriggerLabel(event.trigger.outcome)}.`;
  }

  function prosecutionSpeakerKeyCandidates(npc) {
    const registryKey = String(npc?.registryKey || "").toLowerCase();
    const callsign = String(npc?.callsign || "").toLowerCase();
    if (registryKey === "kestrel" || callsign.includes("kestrel")) return ["UFP Kestrels", "Kestrels", "Kestrel"];
    if (registryKey === "ibis" || callsign.includes("ibis")) return ["Ibis drones", "Ibis"];
    if (registryKey === "condor" || callsign.includes("condor")) return ["Condor"];
    if (registryKey === "mk-iv" || callsign.includes("mk-iv")) return ["MK-IV"];
    if (registryKey === "ml-x" || callsign.includes("ml-x")) return ["ML-X"];
    if (registryKey === "mm-ix" || callsign.includes("mm-ix")) return ["MM-IX"];
    if (registryKey === "sledge" || callsign.includes("sledge")) return ["sledge", "sledges", "Sledge", "Sledges"];
    if (registryKey === "dragoon" || callsign.includes("dragoon")) return ["dragoons", "Dragoon", "Dragoons"];
    if (registryKey === "matador" || callsign.includes("matador")) return ["Matador"];
    return [];
  }

  function prosecutionDialogueSet(attacker, target) {
    const attackerFaction = attacker?.campaignFaction || attacker?.faction || "civilian";
    const targetFaction = target?.campaignFaction || target?.faction || "civilian";
    const sets = typeof getConflictOutcomes === "function" ? getConflictOutcomes()?.prosecutionDialogue : null;
    if (!Array.isArray(sets)) return null;
    return sets.find((entry) => entry?.aggressorFaction === attackerFaction && entry?.targetFaction === targetFaction) || null;
  }

  function pickProsecutionLine(attacker, target, chatterKey = "speakers") {
    const set = prosecutionDialogueSet(attacker, target);
    const groups = set?.[chatterKey];
    if (!groups || typeof groups !== "object") return null;
    const candidates = prosecutionSpeakerKeyCandidates(attacker);
    const matchingKey = Object.keys(groups).find((key) => candidates.some((candidate) => key.toLowerCase() === candidate.toLowerCase()));
    const lines = matchingKey ? groups[matchingKey] : groups[randomPick(Object.keys(groups))];
    return randomPick(Array.isArray(lines) ? lines : []);
  }

  function campaignAttackLine(attacker, target, nodeId, label = "Fire") {
    const location = titleCase(nodeLabel(nodeId));
    const prosecutionLine = pickProsecutionLine(attacker, target, "speakers");
    if (prosecutionLine) return `[${label}] to ${target.callsign} @ ${location}: ${prosecutionLine}`;
    const attackerFaction = attacker?.faction || "civilian";
    const aggressorPool = attackerFaction === "civilian" ? CONFLICT_AGGRESSOR_LINES.civilian : CONFLICT_AGGRESSOR_LINES.armed;
    const barkPool = aggressorPool.fire || aggressorPool.verbal || aggressorPool.notice;
    return `[${label}] to ${target.callsign} @ ${location}: ${pickConflictBark(barkPool)}`;
  }

  function campaignDefenseLine(defender, attacker, nodeId, label = "Defending") {
    const location = titleCase(nodeLabel(nodeId));
    return `[${label}] to ${attacker.callsign} @ ${location}: ${pickConflictBark(CONFLICT_RESPONDER_LINES.fire)}`;
  }

  function scheduleCombatExchangeMessages(exchange, nodeId, initialDelay = 1, directPrefix = "Fire") {
    scheduleNpcConflictMessage(
      initialDelay,
      exchange.direct.attacker,
      campaignAttackLine(exchange.direct.attacker, exchange.direct.defender, nodeId, directPrefix),
      "interdicting",
      "comms"
    );
    scheduleNpcConflictMessage(
      initialDelay + 1,
      exchange.direct.defender,
      campaignDefenseLine(exchange.direct.defender, exchange.direct.attacker, nodeId),
      "evading",
      "comms"
    );
    scheduleNpcConflictMessage(
      initialDelay + 2,
      exchange.direct.attacker,
      `${formatCombatResultLine(exchange.direct, directPrefix)} ${exchange.direct.outcome === "major_damage" || exchange.direct.outcome === "kill" ? `${exchange.direct.defender.callsign} cannot return fire.` : ""}`.trim(),
      "interdicting",
      "comms"
    );
    exchange.collateral.forEach((result, idx) => {
      scheduleNpcConflictMessage(initialDelay + 3 + idx, result.defender, formatCombatResultLine(result, "Collateral"), "damaged", "comms");
    });
    if (exchange.returnFire) {
      const delay = initialDelay + 3 + exchange.collateral.length;
      scheduleNpcConflictMessage(
        delay,
        exchange.returnFire.attacker,
        campaignAttackLine(exchange.returnFire.attacker, exchange.returnFire.defender, nodeId, "Return fire"),
        "returning fire",
        "comms"
      );
      scheduleNpcConflictMessage(
        delay + 1,
        exchange.returnFire.defender,
        campaignDefenseLine(exchange.returnFire.defender, exchange.returnFire.attacker, nodeId),
        "evading",
        "comms"
      );
      scheduleNpcConflictMessage(
        delay + 2,
        exchange.returnFire.attacker,
        formatCombatResultLine(exchange.returnFire, "Return fire"),
        exchange.returnFire.outcome === "major_damage" || exchange.returnFire.outcome === "kill" ? "interdicting" : "returning fire",
        "comms"
      );
      exchange.returnCollateral.forEach((result, idx) => {
        scheduleNpcConflictMessage(delay + 3 + idx, result.defender, formatCombatResultLine(result, "Collateral"), "damaged", "comms");
      });
    }
  }

  function resolveCombatExchange(aggressor, responder, nodeId) {
    const direct = resolveDirectCombat(aggressor, responder);
    const collateralResults = resolveCollateralVolley(aggressor, responder, nodeId);
    const collateral = collateralDamageResults(collateralResults);
    const canReturn = combatCapable(responder) && hasGuns(responder);
    const returnFire = canReturn ? resolveDirectCombat(responder, aggressor) : null;
    const returnCollateralResults = returnFire ? resolveCollateralVolley(responder, aggressor, nodeId) : [];
    const returnCollateral = collateralDamageResults(returnCollateralResults);
    const reprisalShipIds = new Set([aggressor.id, responder.id]);
    const collateralReprisals = resolveCollateralReprisals(collateralResults, aggressor, nodeId, reprisalShipIds);
    const returnCollateralReprisals = returnFire
      ? resolveCollateralReprisals(returnCollateralResults, responder, nodeId, reprisalShipIds)
      : [];
    return {
      direct,
      collateral,
      returnFire,
      returnCollateral,
      collateralReprisals,
      returnCollateralReprisals,
      canReturn,
    };
  }

  function notifyConflictFire(result, nodeId, collateral = false, campaignId = null) {
    if (typeof onConflictFire !== "function" || !result?.attacker) return;
    onConflictFire({
      nodeId,
      collateral,
      campaignId,
      campaignCombat: Boolean(campaignId),
      result: {
        attackerId: result.attacker.id,
        attackerFaction: result.attacker.faction || "civilian",
        defenderId: result.defender?.id || null,
        defenderFaction: result.defender?.faction || "civilian",
        outcome: result.outcome,
      },
    });
  }

  function notifyCombatExchangeHeat(exchange, nodeId, campaignId = null) {
    notifyConflictFire(exchange.direct, nodeId, false, campaignId);
    (exchange.collateral || []).forEach((result) => notifyConflictFire(result, nodeId, true, campaignId));
    if (exchange.returnFire) notifyConflictFire(exchange.returnFire, nodeId, false, campaignId);
    (exchange.returnCollateral || []).forEach((result) => notifyConflictFire(result, nodeId, true, campaignId));
    (exchange.collateralReprisals || []).forEach((event) => {
      notifyConflictFire(event.direct, nodeId, false, campaignId);
      (event.collateral || []).forEach((result) => notifyConflictFire(result, nodeId, true, campaignId));
    });
    (exchange.returnCollateralReprisals || []).forEach((event) => {
      notifyConflictFire(event.direct, nodeId, false, campaignId);
      (event.collateral || []).forEach((result) => notifyConflictFire(result, nodeId, true, campaignId));
    });
  }

  function campaignCountPlan(durationSeconds) {
    const durationRatio = clamp(
      0,
      1,
      (durationSeconds - CAMPAIGN_MIN_DURATION_SECONDS) / (CAMPAIGN_MAX_DURATION_SECONDS - CAMPAIGN_MIN_DURATION_SECONDS)
    );
    const targetTotal = Math.round(CAMPAIGN_MIN_SHIPS + durationRatio * (CAMPAIGN_MAX_SHIPS - CAMPAIGN_MIN_SHIPS));
    const counts = Object.fromEntries(
      Object.entries(CAMPAIGN_SHIP_COUNT_BY_CLASS).map(([group, range]) => [group, range.min])
    );
    let remaining = targetTotal - Object.values(counts).reduce((sum, count) => sum + count, 0);
    while (remaining > 0) {
      const availableGroups = Object.entries(CAMPAIGN_SHIP_COUNT_BY_CLASS)
        .filter(([group, range]) => counts[group] < range.max)
        .map(([group]) => group);
      const group = randomPick(availableGroups);
      if (!group) break;
      counts[group] += 1;
      remaining -= 1;
    }
    return counts;
  }

  function makeCampaignAttacker(campaign, template, ordinal) {
    const id = `${campaign.id}-${template.registryKey}-${ordinal}`.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const callsign = `${template.className} Campaign-${ordinal}`;
    return {
      id,
      callsign,
      captainName: `${template.className} Attack Lead ${ordinal}`,
      faction: campaign.aggressorFaction,
      campaignFaction: campaign.aggressorFaction,
      role: "campaign_attacker",
      registryKey: template.registryKey,
      at: campaign.locationNodeId,
      status: "idle",
      departAt: Infinity,
      arrivalTick: 0,
      allowedNodeIds: [campaign.locationNodeId],
      campaignId: campaign.id,
      mutedFromChatter: false,
    };
  }

  function activeCampaignNpcs(campaign, factionRole = null) {
    return (state.civilianNpcs || []).filter((npc) => {
      if (!npc || !combatCapable(npc) || npc.at !== campaign.locationNodeId) return false;
      if (factionRole === "attacker") return npc.campaignId === campaign.id;
      if (factionRole === "defender") return npc.faction === campaign.defenderFaction && npc.campaignId !== campaign.id;
      return true;
    });
  }

  function campaignAttackerClasses(campaign, group) {
    const faction = campaign?.aggressorFaction || "";
    return CAMPAIGN_ATTACKER_CLASSES_BY_FACTION[faction]?.[group] || [];
  }

  function spawnCampaignAttackers(campaign) {
    const counts = campaignCountPlan(Number(campaign.durationSeconds || 180));
    const spawnedIds = [];
    let ordinal = 1;
    Object.entries(counts).forEach(([group, count]) => {
      const classPool = campaignAttackerClasses(campaign, group);
      for (let i = 0; i < count; i += 1) {
        const template = randomPick(classPool);
        if (!template) continue;
        const npc = makeCampaignAttacker(campaign, template, ordinal);
        ordinal += 1;
        state.civilianNpcs.push(npc);
        shipSpeedById[npc.id] = template.speed;
        spawnedIds.push(npc.id);
      }
    });
    campaign.attackerShipIds = spawnedIds;
    campaign.attackWindowStartedAt = state.tick;
    campaign.attackWindowShots = 0;
    campaign.attackerCooldowns = {};
    campaign.nextAttackTick = state.tick + CAMPAIGN_ATTACK_TICK_SECONDS;
    return spawnedIds;
  }

  function ensureCampaignDefendersAtLocation(campaign) {
    const defenders = (state.civilianNpcs || []).filter((npc) => (
      npc?.faction === campaign.defenderFaction
      && npc.campaignId !== campaign.id
      && combatCapable(npc)
    ));
    const alreadyLocal = defenders.filter((npc) => npc.at === campaign.locationNodeId);
    if (alreadyLocal.length || !defenders.length) return alreadyLocal;
    const defender = randomPick(defenders);
    defender.at = campaign.locationNodeId;
    defender.destination = null;
    defender.status = "idle";
    defender.departAt = campaign.endsAt || Infinity;
    defender.arrivalTick = 0;
    return [defender];
  }

  function campaignCanFire(campaign, attacker) {
    if (!attacker?.id) return false;
    if (state.tick - (campaign.attackWindowStartedAt || campaign.startedAt || state.tick) >= CAMPAIGN_ATTACK_WINDOW_SECONDS) {
      campaign.attackWindowStartedAt = state.tick;
      campaign.attackWindowShots = 0;
    }
    if ((campaign.attackWindowShots || 0) >= CAMPAIGN_ATTACKS_PER_WINDOW) return false;
    return state.tick >= (campaign.attackerCooldowns?.[attacker.id] || 0);
  }

  function recordCampaignFire(campaign, attacker) {
    campaign.attackWindowShots = (campaign.attackWindowShots || 0) + 1;
    campaign.attackerCooldowns = campaign.attackerCooldowns || {};
    campaign.attackerCooldowns[attacker.id] = state.tick + CAMPAIGN_ATTACKER_COOLDOWN_SECONDS;
  }

  function campaignOpeningFire(campaign) {
    const attackers = activeCampaignNpcs(campaign, "attacker");
    const defenders = ensureCampaignDefendersAtLocation(campaign).filter((npc) => hasGuns(npc));
    defenders.forEach((defender, idx) => {
      const target = randomPick(attackers.filter(combatCapable));
      if (!target) return;
      const exchange = resolveCombatExchange(defender, target, campaign.locationNodeId);
      notifyCombatExchangeHeat(exchange, campaign.locationNodeId, campaign.id);
      if (playerLocalToNode(campaign.locationNodeId)) scheduleCombatExchangeMessages(exchange, campaign.locationNodeId, 2 + idx, "Defender fire");
    });
  }

  function updateCampaignCombat() {
    (state.activeFactionCampaigns || []).forEach((campaign) => {
      if (!campaign || campaign.resolved || campaign.endsAt <= state.tick) return;
      if (!campaign.attackerShipIds?.length) spawnCampaignAttackers(campaign);
      if (state.tick < (campaign.nextAttackTick || 0)) return;
      campaign.nextAttackTick = state.tick + CAMPAIGN_ATTACK_TICK_SECONDS;
      const attackers = activeCampaignNpcs(campaign, "attacker").filter((npc) => campaignCanFire(campaign, npc));
      const defenders = activeCampaignNpcs(campaign, "defender");
      const attacker = randomPick(attackers);
      const target = randomPick(defenders);
      if (!attacker || !target) return;
      recordCampaignFire(campaign, attacker);
      const exchange = resolveCombatExchange(attacker, target, campaign.locationNodeId);
      notifyCombatExchangeHeat(exchange, campaign.locationNodeId, campaign.id);
      if (playerLocalToNode(campaign.locationNodeId)) scheduleCombatExchangeMessages(exchange, campaign.locationNodeId, 1, "Campaign fire");
    });
  }

  function removeCampaignAttackers(campaign) {
    const ids = new Set(campaign?.attackerShipIds || []);
    if (!ids.size) return;
    state.civilianNpcs = (state.civilianNpcs || []).filter((npc) => {
      if (!ids.has(npc.id)) return true;
      delete shipSpeedById[npc.id];
      return false;
    });
  }

  function playerShipListensAtNode(ship, nodeId) {
    if (!ship || ship.at !== nodeId) return false;
    if (ship.status === "enroute") return false;
    return ["idle", "tasked", "arrived_pending_report", "docked", "damaged", "disabled"].includes(ship.status);
  }

  function playerLocalToNode(nodeId) {
    if (nodeId === "anchor_station") return true;
    return Array.isArray(state.ships) && state.ships.some((ship) => playerShipListensAtNode(ship, nodeId));
  }
  function conflictDecayPerHeartbeat() {
    const nodeCount = Object.keys(getNodes() || {}).length;
    const mapFactor = Math.max(0.55, Math.min(1, 8 / Math.max(1, nodeCount)));
    return CONFLICT_DECAY_PER_HEARTBEAT_BASE * mapFactor;
  }


  function scheduleNpcConflictMessage(delay, npc, message, status, type, nodeId = null) {
    if (npc?.mutedFromChatter) return;
    const localNodeId = nodeId || npc?.at || null;
    scheduleCharacterMessage(
      delay,
      npc?.captainName || npc?.callsign,
      message,
      status,
      type,
      localNodeId ? () => playerLocalToNode(localNodeId) : null
    );
  }

  function emitConflictLine(encounter, npcById) {
    const aggressor = npcById.get(encounter.aggressorId || encounter.aId);
    const responder = npcById.get(encounter.responderId || encounter.bId);
    if (!aggressor || !responder) return;
    const location = titleCase(nodeLabel(encounter.nodeId));
    const stageLabel = titleCase(encounter.stage);
    const aggressorFaction = aggressor.faction || "civilian";
    const aggressorPool = aggressorFaction === "civilian" ? CONFLICT_AGGRESSOR_LINES.civilian : CONFLICT_AGGRESSOR_LINES.armed;
    const aggressorLinesByStage = {
      notice: `[${stageLabel}] to ${responder.callsign} @ ${location}: ${pickConflictBark(aggressorPool.notice)}`,
      verbal: `[${stageLabel}] to ${responder.callsign} @ ${location}: ${pickConflictBark(aggressorPool.verbal)}`,
      intercept: `[${aggressorFaction === "civilian" ? "Verbal" : stageLabel}] to ${responder.callsign} @ ${location}: ${pickConflictBark((aggressorPool.intercept || aggressorPool.verbal))}`,
      fire: `[${aggressorFaction === "civilian" ? "Verbal" : stageLabel}] to ${responder.callsign} @ ${location}: ${pickConflictBark((aggressorPool.fire || aggressorPool.verbal))}`,
      resolved: `[Resolved] to ${responder.callsign} @ ${location}: ${pickConflictBark((aggressorPool.resolved || ["Contact is disengaging."]))}`,
    };
    const responderLinesByStage = {
      notice: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${pickConflictBark(CONFLICT_RESPONDER_LINES.notice)}`,
      verbal: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${pickConflictBark(CONFLICT_RESPONDER_LINES.verbal)}`,
      intercept: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${pickConflictBark(CONFLICT_RESPONDER_LINES.intercept)}`,
      fire: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${pickConflictBark(CONFLICT_RESPONDER_LINES.fire)}`,
      resolved: `[Resolved] to ${aggressor.callsign} @ ${location}: ${pickConflictBark(CONFLICT_RESPONDER_LINES.resolved)}`,
    };
    scheduleNpcConflictMessage(
      1,
      aggressor,
      aggressorLinesByStage[encounter.stage] || aggressorLinesByStage.notice,
      encounter.stage === "fire" ? "interdicting" : "arriving",
      "comms"
    );
    scheduleNpcConflictMessage(
      2,
      responder,
      responderLinesByStage[encounter.stage] || responderLinesByStage.notice,
      encounter.stage === "fire" ? "evading" : "arriving",
      "comms"
    );

    if (encounter.stage === "fire") {
      const exchange = resolveCombatExchange(aggressor, responder, encounter.nodeId);
      notifyCombatExchangeHeat(exchange, encounter.nodeId);
      scheduleNpcConflictMessage(
        3,
        aggressor,
        `${formatCombatResultLine(exchange.direct)} ${exchange.direct.outcome === "major_damage" || exchange.direct.outcome === "kill" ? `${responder.callsign} cannot return fire.` : ""}`.trim(),
        "interdicting",
        "comms"
      );
      exchange.collateral.forEach((result, idx) => {
        scheduleNpcConflictMessage(
          4 + idx,
          result.defender,
          formatCombatResultLine(result, "Collateral"),
          "damaged",
          "comms"
        );
      });
      if (exchange.returnFire) {
        const delay = 4 + exchange.collateral.length;
        scheduleNpcConflictMessage(
          delay,
          responder,
          formatCombatResultLine(exchange.returnFire),
          exchange.returnFire.outcome === "major_damage" || exchange.returnFire.outcome === "kill" ? "interdicting" : "returning fire",
          "comms"
        );
        exchange.returnCollateral.forEach((result, idx) => {
          scheduleNpcConflictMessage(
            delay + 1 + idx,
            result.defender,
            formatCombatResultLine(result, "Collateral"),
            "damaged",
            "comms"
          );
        });
      }
      let reprisalDelay = 4 + exchange.collateral.length;
      if (exchange.returnFire) reprisalDelay += 1 + exchange.returnCollateral.length;
      const scheduleReprisal = (event) => {
        scheduleNpcConflictMessage(
          reprisalDelay,
          event.direct.attacker,
          formatCollateralReprisalLine(event),
          event.direct.outcome === "major_damage" || event.direct.outcome === "kill" ? "interdicting" : "returning fire",
          "comms"
        );
        reprisalDelay += 1;
        event.collateral.forEach((result) => {
          scheduleNpcConflictMessage(
            reprisalDelay,
            result.defender,
            formatCombatResultLine(result, "Collateral"),
            "damaged",
            "comms"
          );
          reprisalDelay += 1;
        });
      };
      exchange.collateralReprisals.forEach(scheduleReprisal);
      exchange.returnCollateralReprisals.forEach(scheduleReprisal);
    }
  }

  function updateConflictEncounters(npcs) {
    if (state.tick - lastConflictHeartbeatTick < CONFLICT_HEARTBEAT_SECONDS) return;
    lastConflictHeartbeatTick = state.tick;
    const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
    const byNode = new Map();
    npcs.forEach((npc) => {
      if (!npc?.at || !combatCapable(npc)) return;
      if (!byNode.has(npc.at)) byNode.set(npc.at, []);
      byNode.get(npc.at).push(npc);
    });

    // Decay existing encounters first.
    for (const encounter of conflictEncounters.values()) {
      encounter.stress = Math.max(0, encounter.stress - conflictDecayPerHeartbeat());
      if (encounter.stress <= 0.02 && state.tick - encounter.lastSeenTick > CONFLICT_HEARTBEAT_SECONDS * 3) {
        encounter.stage = "resolved";
      }
    }

    let transitions = 0;
    for (const [nodeId, nodeNpcs] of byNode.entries()) {
      for (let i = 0; i < nodeNpcs.length; i += 1) {
        for (let j = i + 1; j < nodeNpcs.length; j += 1) {
          const a = nodeNpcs[i];
          const b = nodeNpcs[j];
          const key = encounterKey(a.id, b.id);
          const pairing = chooseAggressor(a, b);
          const hostility = pairing.hostility;
          let encounter = conflictEncounters.get(key);
          if (!encounter) {
            encounter = {
              key,
              aId: a.id,
              bId: b.id,
              aggressorId: pairing.aggressor.id,
              responderId: pairing.responder.id,
              nodeId,
              stress: 0,
              stage: "notice",
              lastSeenTick: state.tick,
            };
            conflictEncounters.set(key, encounter);
          }
          const riskFactor = Math.max(0.5, (state.risk || 20) / 30);
          encounter.nodeId = nodeId;
          encounter.lastSeenTick = state.tick;
          encounter.aggressorId = pairing.aggressor.id;
          encounter.responderId = pairing.responder.id;
          encounter.stress = Math.min(1, encounter.stress + (CONFLICT_GAIN_BASE * hostility * riskFactor));
          const nextStage = capStageForAggressor(conflictStageForStress(encounter.stress), pairing.aggressor);
          if (nextStage !== encounter.stage && transitions < CONFLICT_MAX_STAGE_PER_HEARTBEAT) {
            encounter.stage = nextStage;
            transitions += 1;
            if (typeof onConflictStage === "function") onConflictStage({
              stage: encounter.stage,
              nodeId,
              aggressorId: encounter.aggressorId,
              responderId: encounter.responderId,
              aggressorFaction: pairing.aggressor.faction || "civilian",
              responderFaction: pairing.responder.faction || "civilian",
            });
            if (playerLocalToNode(nodeId)) emitConflictLine(encounter, npcById);
          }
        }
      }
    }

    for (const [key, encounter] of conflictEncounters.entries()) {
      if (encounter.stage === "resolved" || (encounter.stress <= 0.02 && state.tick - encounter.lastSeenTick > CONFLICT_HEARTBEAT_SECONDS * 6)) {
        conflictEncounters.delete(key);
      }
    }
  }

  function pruneRecentLineHistory() {
    while (recentNpcLineHistory.length && (state.tick - recentNpcLineHistory[0].tick) > NPC_LINE_REPEAT_WINDOW) {
      recentNpcLineHistory.shift();
    }
  }

  function buildFactionLine(npc, destinationNodeId) {
    pruneRecentLineHistory();
    const destinationLabel = nodeLabel(destinationNodeId);
    const faction = npc.faction || "civilian";
    const recent = recentNpcLineHistory.filter((item) => state.tick - item.tick <= NPC_LINE_REPEAT_WINDOW);
    const lastByFaction = recent.filter((item) => item.faction === faction).at(-1);

    if (faction === "arcworks") {
      const pool = NPC_APPROACH_FACTORS.arcworks;
      const mode = isArcworksNode(destinationNodeId) ? "announce" : "request";
      const prefix = pickLineVariant(pool.prefixes, lastByFaction?.prefixIndex ?? -1);
      const core = pickLineVariant(pool.cores, lastByFaction?.coreIndex ?? -1);
      const suffix = pickLineVariant(pool.suffixesByMode[mode], lastByFaction?.suffixIndex ?? -1);
      const line = `${prefix.value}: ${core.value(npc.callsign, destinationLabel)}; ${suffix.value}`;
      recentNpcLineHistory.push({ tick: state.tick, faction, prefixIndex: prefix.index, coreIndex: core.index, suffixIndex: suffix.index });
      return line;
    }

    const pool = NPC_APPROACH_FACTORS[faction] || NPC_APPROACH_FACTORS.civilian;
    const prefix = pickLineVariant(pool.prefixes, lastByFaction?.prefixIndex ?? -1);
    const core = pickLineVariant(pool.cores, lastByFaction?.coreIndex ?? -1);
    const suffix = pickLineVariant(pool.suffixes, lastByFaction?.suffixIndex ?? -1);
    const suffixText = typeof suffix.value === "function" ? suffix.value(destinationLabel) : suffix.value;
    const line = `${prefix.value}: ${core.value(npc.callsign, destinationLabel)}; ${suffixText}`;
    recentNpcLineHistory.push({ tick: state.tick, faction, prefixIndex: prefix.index, coreIndex: core.index, suffixIndex: suffix.index });
    return line;
  }

  function idleNpcAtNode(npc, nodeId) {
    npc.at = nodeId;
    npc.destination = null;
    npc.status = "idle";
    npc.arrivalTick = 0;
    npc.departAt = state.tick + randomLoiterSeconds();
  }

  function nodeSearchText(nodeId) {
    const node = getNodes()?.[nodeId] || {};
    return `${nodeId} ${node.label || ""} ${node.moonName || ""}`.toLowerCase();
  }

  function nodeMatchesAny(nodeId, patterns = []) {
    const text = nodeSearchText(nodeId);
    return patterns.some((pattern) => pattern.test(text));
  }

  function lowOrRingOrbitNodeIds(nodeIds) {
    return nodeIds.filter((nodeId) => nodeMatchesAny(nodeId, [
      /low_orbit_transfer_lane/,
      /deep_space_transfer_lane/,
      /indigo_station/,
      /ufp_indigo_system_administration/,
      /ufp_outpost_alpha/,
      /refinery/,
      /yard/,
      /ufp_outpost_bravo/,
      /arcworks_operations_hub/,
      /arcworks_militia_barracks/,
      /oxblood/,
      /patch/,
      /onion skin/,
      /shooter/,
      /sulphide/,
    ]));
  }

  function outerOrbitNodeIds(nodeIds) {
    return nodeIds.filter((nodeId) => nodeMatchesAny(nodeId, [
      /high_orbit_transfer_lane/,
      /condenser_columns/,
      /ufp_science_station/,
      /clambroth/,
      /end-of-day/,
      /end_of_day/,
    ]));
  }

  function anywhereExceptOnionSkinNodeIds(nodeIds) {
    return nodeIds.filter((nodeId) => !nodeMatchesAny(nodeId, [/onion skin/, /onion_skin/, /arcworks_operations_hub/, /arcworks_militia_barracks/]));
  }

  function anywhereExceptUfpCoreNodeIds(nodeIds) {
    return nodeIds.filter((nodeId) => !nodeMatchesAny(nodeId, [
      /ufp_indigo_system_administration/,
      /ufp system administration/,
      /ufp outpost alpha/,
      /ufp_outpost_alpha/,
      /ufp outpost bravo/,
      /ufp_outpost_bravo/,
    ]));
  }

  function matadorRouteNodeIds(nodeIds) {
    const outer = outerOrbitNodeIds(nodeIds);
    const anchor = nodeIds.filter((nodeId) => nodeMatchesAny(nodeId, [/anchor_station/, /anchor station/]));
    return [...new Set([...outer, ...anchor])];
  }

  function mutedNpcActiveForConflict(npc) {
    return !npc?.muteUntilHeatEnabled || Boolean(state.factionHeatEnabled);
  }

  function pickDestination(fromNodeId, allowedNodeIds = null) {
    const adjacency = getAdjacency();
    const hasWhitelist = Array.isArray(allowedNodeIds);
    if (hasWhitelist && allowedNodeIds.length === 0) return null;
    const allow = hasWhitelist ? new Set(allowedNodeIds) : null;
    const options = (adjacency[fromNodeId] || []).map((edge) => edge.to).filter((nodeId) => nodeId && (!allow || allow.has(nodeId)));
    if (options.length) return randomPick(options);
    const allNodes = allow ? [...allow] : Object.keys(getNodes());
    const fallback = allNodes.filter((nodeId) => nodeId !== fromNodeId);
    return randomPick(fallback);
  }

  function shouldBroadcastFinalApproach(destinationNodeId) {
    if (destinationNodeId === playerNodeId) return true;
    return state.ships.some((ship) => ship.at === destinationNodeId && ship.status === "idle");
  }


  function isArcworksNode(nodeId) {
    const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
    return /onion skin|refinery|condenser columns|baron'?s market|indigo station/i.test(label);
  }

  function buildFactionMessage(npc, destinationNodeId) {
    return buildFactionLine(npc, destinationNodeId);
  }

  function scheduleFinalApproach(npc, fromNodeId, destinationNodeId, uplink, transitTime) {
    if (npc?.mutedFromChatter) return;
    if (!shouldBroadcastFinalApproach(destinationNodeId)) return;
    const lead = Math.min(4, Math.max(1, transitTime - 1));
    const callAt = uplink + Math.max(0, transitTime - lead) + oneWaySignalToNode(destinationNodeId);
    scheduleCharacterMessage(
      callAt,
      npc.captainName || npc.callsign,
      buildFactionMessage(npc, destinationNodeId),
      "arriving",
      "comms"
    );
  }

  function startTransit(npc) {
    const destinationNodeId = pickDestination(npc.at, npc.allowedNodeIds);
    if (!destinationNodeId) return;
    const routeSpan = safeRouteDistance(npc.at, destinationNodeId);
    const transitTime = travelTimeForRoute(npc.id, routeSpan);
    const uplink = oneWaySignalToNode(npc.at);
    scheduleFinalApproach(npc, npc.at, destinationNodeId, uplink, transitTime);
    npc.origin = npc.at;
    npc.destination = destinationNodeId;
    npc.status = "enroute";
    npc.departAt = 0;
    npc.arrivalTick = state.tick + uplink + transitTime;
  }

  function sortedConflictDebugEntries() {
    return [...conflictEncounters.values()].sort((a, b) => b.stress - a.stress);
  }

  function formatConflictDebugEntry(entry, idx) {
    return `${idx + 1}. ${entry.aggressorId} -> ${entry.responderId} @ ${entry.nodeId} | stage=${entry.stage} | stress=${entry.stress.toFixed(2)} | seen=${entry.lastSeenTick}`;
  }

  function bumpConflictStress(index, amount = 0.4) {
    const entries = sortedConflictDebugEntries();
    const entry = entries[index - 1];
    if (!entry) return [`dbConflict: no conflict pair #${index}. Run dbconflict to list active pairs.`];
    const npcs = state.civilianNpcs || [];
    const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
    const aggressor = npcById.get(entry.aggressorId || entry.aId);
    const priorStage = entry.stage;
    const priorStress = entry.stress;
    entry.stress = Math.min(1, entry.stress + amount);
    entry.lastSeenTick = state.tick;
    const nextStage = capStageForAggressor(conflictStageForStress(entry.stress), aggressor);
    if (nextStage !== entry.stage) {
      entry.stage = nextStage;
      if (typeof onConflictStage === "function") onConflictStage({
        stage: entry.stage,
        nodeId: entry.nodeId,
        aggressorId: entry.aggressorId,
        responderId: entry.responderId,
        aggressorFaction: aggressor?.faction || "civilian",
        responderFaction: npcById.get(entry.responderId || entry.bId)?.faction || "civilian",
      });
      if (playerLocalToNode(entry.nodeId)) emitConflictLine(entry, npcById);
    }
    return [
      `dbConflict: stressed pair #${index} by +${amount.toFixed(2)} (${priorStress.toFixed(2)} -> ${entry.stress.toFixed(2)}, ${priorStage} -> ${entry.stage}).`,
      formatConflictDebugEntry(entry, index - 1),
    ];
  }

  return {
    bootstrap() {
      if (Array.isArray(state.civilianNpcs) && state.civilianNpcs.length) return;
      const nodeIds = Object.keys(getNodes());
      const spawn = () => randomPick(nodeIds) || playerNodeId;
      const UFP_OR_STATION_NODE_IDS = new Set([
        "ufp_outpost_alpha",
        "ufp_outpost_bravo",
        "ufp_indigo_system_administration",
        "ufp_outpost_delta",
        "ufp_science_station",
        "anchor_station",
        "indigo_station",
        "barons_market",
      ]);
      const UFP_OR_STATION_LABEL_PATTERNS = [
        /ufp outpost alpha/i,
        /ufp outpost bravo/i,
        /ufp indigo system administration/i,
        /ufp outpost delta/i,
        /ufp science station/i,
        /anchor station/i,
        /indigo station/i,
        /baron'?s market/i,
      ];
      const resolveUfpNodeIds = () => nodeIds.filter((nodeId) => {
        if (UFP_OR_STATION_NODE_IDS.has(nodeId)) return true;
        const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
        return UFP_OR_STATION_LABEL_PATTERNS.some((pattern) => pattern.test(label));
      });
      const ufpNodeIds = resolveUfpNodeIds();
      const spawnUfp = () => randomPick(ufpNodeIds) || spawn();
      const blisterNodeIds = nodeIds.filter((nodeId) => {
        const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
        return ["deep_space_transfer_lane", "high_orbit_transfer_lane", "ring_transfer_lane", "low_orbit_transfer_lane", "yard", "refinery", "barons_market"].includes(nodeId)
          || /transfer lane|yard|refinery|baron'?s market/i.test(label);
      });
      const arcworksNodeIds = nodeIds.filter((nodeId) => {
        const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
        return ["onion_skin", "refinery", "condenser_columns", "barons_market", "indigo_station"].includes(nodeId)
          || /onion skin|refinery|condenser columns|baron'?s market|indigo station/i.test(label);
      });
      const spawnBlister = () => randomPick(blisterNodeIds) || spawn();
      const spawnArcworks = () => randomPick(arcworksNodeIds) || spawn();
      state.civilianNpcs = [
        { id: "npc-hauler-1", callsign: "Hauler Steady-14", captainName: "Capt. Elara Kade", faction: "civilian", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-hauler-2", callsign: "Hauler Brisk-22", captainName: "Capt. Rowan Pike", faction: "civilian", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-1", callsign: "Courier Swift-7", captainName: "Capt. Nia Calder", faction: "civilian", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-2", callsign: "Courier Quick-3", captainName: "Capt. Joren Hale", faction: "civilian", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-ufp-kestrel-1", callsign: "Kestrel Alert-2", captainName: "Capt. Sera Malk", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-ufp-kestrel-2", callsign: "Kestrel Keen-3", captainName: "Capt. Arlen Dax", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-ufp-pelican-1", callsign: "Pelican Ready-1", captainName: "Capt. Ilya Soren", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-blister-dragoon-1", callsign: "Dragoon Bold-2", captainName: "Capt. Rysa Korr", faction: "blister", role: "raider", at: spawnBlister(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: blisterNodeIds },
        { id: "npc-blister-dragoon-2", callsign: "Dragoon Daring-3", captainName: "Capt. Varek Noll", faction: "blister", role: "raider", at: spawnBlister(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: blisterNodeIds },
        { id: "npc-arcworks-mk4-1", callsign: "MK-IV Able-4", captainName: "Capt. Edda Marr", faction: "arcworks", role: "industrial", at: spawnArcworks(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: arcworksNodeIds },
        { id: "npc-arcworks-mm9-1", callsign: "MM-IX True-9", captainName: "Capt. Tal Ren", faction: "arcworks", role: "industrial", at: spawnArcworks(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: arcworksNodeIds },
        { id: "npc-ufp-kestrel-wide-1", callsign: "Kestrel Wide-4", captainName: "Capt. Mira Sol", faction: "ufp", role: "patrol", registryKey: "kestrel", at: randomPick(anywhereExceptOnionSkinNodeIds(nodeIds)) || spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: anywhereExceptOnionSkinNodeIds(nodeIds), routeProfile: "anywhere_except_onion_skin", mutedFromChatter: true, muteUntilHeatEnabled: true },
        { id: "npc-arcworks-j8-1", callsign: "J-VIII Carry-8", captainName: "Capt. Oren Vale", faction: "arcworks", role: "hauler", registryKey: "j-viii", at: randomPick(anywhereExceptUfpCoreNodeIds(nodeIds)) || spawnArcworks(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: anywhereExceptUfpCoreNodeIds(nodeIds), routeProfile: "anywhere_except_ufp_core", mutedFromChatter: true, muteUntilHeatEnabled: true },
        { id: "npc-arcworks-mm9-wide-1", callsign: "MM-IX Rigid-6", captainName: "Capt. Mara Quell", faction: "arcworks", role: "industrial", registryKey: "mm-ix", at: randomPick(anywhereExceptUfpCoreNodeIds(nodeIds)) || spawnArcworks(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: anywhereExceptUfpCoreNodeIds(nodeIds), routeProfile: "anywhere_except_ufp_core", mutedFromChatter: true, muteUntilHeatEnabled: true },
        { id: "npc-blister-matador-1", callsign: "Matador Crown-1", captainName: "Capt. Daska Rill", faction: "blister", role: "raider", registryKey: "matador", at: randomPick(matadorRouteNodeIds(nodeIds)) || spawnBlister(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: matadorRouteNodeIds(nodeIds), routeProfile: "outer_orbit_and_anchor", mutedFromChatter: true, muteUntilHeatEnabled: true },
        { id: "npc-civilian-trawler-low-1", callsign: "Trawler Low-17", captainName: "Capt. Sel Nadir", faction: "civilian", role: "hauler", registryKey: "trawler", at: randomPick(lowOrRingOrbitNodeIds(nodeIds)) || spawn(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: lowOrRingOrbitNodeIds(nodeIds), routeProfile: "low_and_ring_orbit", mutedFromChatter: true, muteUntilHeatEnabled: true },
        { id: "npc-civilian-trawler-ring-1", callsign: "Trawler Ring-19", captainName: "Capt. Hessa Dorne", faction: "civilian", role: "hauler", registryKey: "trawler", at: randomPick(lowOrRingOrbitNodeIds(nodeIds)) || spawn(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: lowOrRingOrbitNodeIds(nodeIds), routeProfile: "low_and_ring_orbit", mutedFromChatter: true, muteUntilHeatEnabled: true },
      ];
      state.civilianNpcs.forEach((npc) => {
        const wait = randomLoiterSeconds();
        npc.departAt = state.tick + wait;
      });
      shipSpeedById["npc-hauler-1"] = 2;
      shipSpeedById["npc-hauler-2"] = 2;
      shipSpeedById["npc-courier-1"] = 4;
      shipSpeedById["npc-courier-2"] = 4;
      shipSpeedById["npc-ufp-kestrel-1"] = 4;
      shipSpeedById["npc-ufp-kestrel-2"] = 4;
      shipSpeedById["npc-ufp-pelican-1"] = 3;
      shipSpeedById["npc-blister-dragoon-1"] = 4;
      shipSpeedById["npc-blister-dragoon-2"] = 4;
      shipSpeedById["npc-arcworks-mk4-1"] = 2;
      shipSpeedById["npc-arcworks-mm9-1"] = 2;
      shipSpeedById["npc-ufp-kestrel-wide-1"] = 4;
      shipSpeedById["npc-arcworks-j8-1"] = 2;
      shipSpeedById["npc-arcworks-mm9-wide-1"] = 2;
      shipSpeedById["npc-blister-matador-1"] = 3;
      shipSpeedById["npc-civilian-trawler-low-1"] = 2;
      shipSpeedById["npc-civilian-trawler-ring-1"] = 2;
    },
    update() {
      updateAmbientLocationSpawns();
      updateAmbientLocationDialogue();
      updateAmbientLocationRemovals();
      updateCampaignCombat();
      const npcs = state.civilianNpcs || [];
      updateConflictEncounters(npcs.filter((npc) => !npc.ambientLocationSpawn && !npc.campaignId && mutedNpcActiveForConflict(npc)));
      npcs.forEach((npc) => {
        if (npc.ambientLocationSpawn || npc.campaignId) return;
        if (!combatCapable(npc)) return;
        if (npc.faction === "ufp" || npc.faction === "blister" || npc.faction === "arcworks" || npc.routeProfile) {
          const nodeIds = Object.keys(getNodes());
          let allowed = null;
          if (npc.routeProfile === "anywhere_except_onion_skin") allowed = anywhereExceptOnionSkinNodeIds(nodeIds);
          else if (npc.routeProfile === "anywhere_except_ufp_core") allowed = anywhereExceptUfpCoreNodeIds(nodeIds);
          else if (npc.routeProfile === "outer_orbit_and_anchor") allowed = matadorRouteNodeIds(nodeIds);
          else if (npc.routeProfile === "low_and_ring_orbit") allowed = lowOrRingOrbitNodeIds(nodeIds);
          else allowed = nodeIds.filter((nodeId) => {
            const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
            if (npc.faction === "ufp") {
              return ["ufp_outpost_alpha","ufp_outpost_bravo","ufp_indigo_system_administration","ufp_outpost_delta","ufp_science_station","anchor_station","indigo_station","barons_market"].includes(nodeId)
                || /ufp outpost alpha|ufp outpost bravo|ufp indigo system administration|ufp outpost delta|ufp science station|anchor station|indigo station|baron'?s market/i.test(label);
            }
            if (npc.faction === "blister") {
              return ["deep_space_transfer_lane","high_orbit_transfer_lane","ring_transfer_lane","low_orbit_transfer_lane","yard","refinery","barons_market"].includes(nodeId)
                || /transfer lane|yard|refinery|baron'?s market/i.test(label);
            }
            return ["onion_skin","refinery","condenser_columns","barons_market","indigo_station"].includes(nodeId)
              || /onion skin|refinery|condenser columns|baron'?s market|indigo station/i.test(label);
          });
          npc.allowedNodeIds = allowed;
          if (npc.at && !allowed.includes(npc.at) && allowed.length) {
            npc.at = randomPick(allowed);
          }
        }
        if (npc.status === "idle" && state.tick >= npc.departAt) {
          startTransit(npc);
          return;
        }
        if (npc.status === "enroute" && state.tick >= npc.arrivalTick) {
          idleNpcAtNode(npc, npc.destination || npc.at);
        }
      });
    },
    startCampaign(campaign) {
      if (!campaign?.id || !campaign.locationNodeId) return [];
      const spawned = spawnCampaignAttackers(campaign);
      campaignOpeningFire(campaign);
      return spawned;
    },
    endCampaign(campaign) {
      removeCampaignAttackers(campaign);
    },
    getConflictDebugLines() {
      const entries = sortedConflictDebugEntries();
      if (!entries.length) return ["dbConflict: no active NPC conflicts."];
      return entries.map((entry, idx) => formatConflictDebugEntry(entry, idx));
    },
    bumpConflictStress(index, amount) {
      return bumpConflictStress(index, amount);
    },
  };
}
