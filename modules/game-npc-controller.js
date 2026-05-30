const NPC_LOITER_MIN = 40;
const NPC_LOITER_MAX = 360;
const NPC_LOITER_MODE = 200;
const NPC_LINE_REPEAT_WINDOW = 120;
const CONFLICT_HEARTBEAT_SECONDS = 10;
const CONFLICT_DECAY_PER_HEARTBEAT_BASE = 0.09;
const CONFLICT_GAIN_BASE = 0.12;
const CONFLICT_MAX_STAGE_PER_HEARTBEAT = 3;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPick(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
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
      "Kill the swagger, hold vector, and submit to traffic inspection.",
      "You are now under active challenge. Keep hands visible and drives low.",
    ],
    fire: [
      "Weapons discharge reported. Breaking hard.",
      "Shots fired. Defensive pattern active.",
      "You wanted noise—now you have sirens.",
    ],
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
  fire: [
    "Taking fire. Distress beacon active and evasive action underway.",
    "Weapons contact! Logging telemetry and breaking away.",
    "You opened fire. Beacon hot, lane clear, we are gone.",
  ],
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
  onConflictStage,
}) {
  const recentNpcLineHistory = [];
  const conflictEncounters = new Map();
  let lastConflictHeartbeatTick = -Infinity;

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

  function chooseAggressor(a, b) {
    const ab = factionHostility(a.faction, b.faction);
    const ba = factionHostility(b.faction, a.faction);
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

  function shipCombatProfile(npc) {
    if (!npc?.id) return DEFAULT_NPC_COMBAT_PROFILE;
    const registry = typeof getShipRegistry === "function" ? getShipRegistry() : null;
    const registryKey = NPC_SHIP_REGISTRY_KEYS[npc.id];
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

  function playerLocalToNode(nodeId) {
    if (nodeId === "anchor_station") return true;
    return Array.isArray(state.ships) && state.ships.some((ship) => ship.at === nodeId && (ship.status === "idle" || ship.status === "tasked" || ship.status === "enroute"));
  }
  function conflictDecayPerHeartbeat() {
    const nodeCount = Object.keys(getNodes() || {}).length;
    const mapFactor = Math.max(0.55, Math.min(1, 8 / Math.max(1, nodeCount)));
    return CONFLICT_DECAY_PER_HEARTBEAT_BASE * mapFactor;
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
      notice: `[${stageLabel}] to ${responder.callsign} @ ${location}: ${randomPick(aggressorPool.notice)}`,
      verbal: `[${stageLabel}] to ${responder.callsign} @ ${location}: ${randomPick(aggressorPool.verbal)}`,
      intercept: `[${aggressorFaction === "civilian" ? "Verbal" : stageLabel}] to ${responder.callsign} @ ${location}: ${randomPick((aggressorPool.intercept || aggressorPool.verbal))}`,
      fire: `[${aggressorFaction === "civilian" ? "Verbal" : stageLabel}] to ${responder.callsign} @ ${location}: ${randomPick((aggressorPool.fire || aggressorPool.verbal))}`,
      resolved: `[Resolved] to ${responder.callsign} @ ${location}: ${randomPick((aggressorPool.resolved || ["Contact is disengaging."]))}`,
    };
    const responderLinesByStage = {
      notice: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${randomPick(CONFLICT_RESPONDER_LINES.notice)}`,
      verbal: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${randomPick(CONFLICT_RESPONDER_LINES.verbal)}`,
      intercept: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${randomPick(CONFLICT_RESPONDER_LINES.intercept)}`,
      fire: `[${stageLabel}] to ${aggressor.callsign} @ ${location}: ${randomPick(CONFLICT_RESPONDER_LINES.fire)}`,
      resolved: `[Resolved] to ${aggressor.callsign} @ ${location}: ${randomPick(CONFLICT_RESPONDER_LINES.resolved)}`,
    };
    scheduleCharacterMessage(
      1,
      aggressor.captainName || aggressor.callsign,
      aggressorLinesByStage[encounter.stage] || aggressorLinesByStage.notice,
      encounter.stage === "fire" ? "interdicting" : "arriving",
      "comms"
    );
    scheduleCharacterMessage(
      2,
      responder.captainName || responder.callsign,
      responderLinesByStage[encounter.stage] || responderLinesByStage.notice,
      encounter.stage === "fire" ? "evading" : "arriving",
      "comms"
    );

    if (encounter.stage === "fire" && hasGuns(responder) && Math.random() < 0.55) {
      const counterfireLines = [
        `[Fire] to ${aggressor.callsign} @ ${location}: Returning fire. Marking your drives and breaking across your bow.`,
        `[Fire] to ${aggressor.callsign} @ ${location}: Counterfire authorized. You fire again, you drift home in pieces.`,
        `[Fire] to ${aggressor.callsign} @ ${location}: Defensive guns active. You wanted a duel—now finish it fast.`,
      ];
      scheduleCharacterMessage(
        3,
        responder.captainName || responder.callsign,
        randomPick(counterfireLines),
        "interdicting",
        "comms"
      );
    }
  }

  function updateConflictEncounters(npcs) {
    if (state.tick - lastConflictHeartbeatTick < CONFLICT_HEARTBEAT_SECONDS) return;
    lastConflictHeartbeatTick = state.tick;
    const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
    const byNode = new Map();
    npcs.forEach((npc) => {
      if (!npc?.at) return;
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
            if (typeof onConflictStage === "function") onConflictStage({ stage: encounter.stage, nodeId, aggressorId: encounter.aggressorId, responderId: encounter.responderId });
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
    if (!shouldBroadcastFinalApproach(destinationNodeId)) return;
    const lead = Math.min(4, Math.max(1, transitTime - 1));
    const callAt = uplink + Math.max(0, transitTime - lead) + oneWaySignalToNode(destinationNodeId);
    scheduleCharacterMessage(
      callAt,
      npc.captainName || npc.callsign,
      `${npc.callsign} on final approach to ${nodeLabel(destinationNodeId)}. ${npc.faction === "ufp" ? "Announcing docking." : "Requesting docking clearance."}`,
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
      state.civilianNpcs = [
        { id: "npc-hauler-1", callsign: "Hauler Vesper-14", captainName: "Capt. Elara Voss", faction: "civilian", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-hauler-2", callsign: "Hauler Morrow-22", captainName: "Capt. Rowan Pike", faction: "civilian", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-1", callsign: "Courier Kite-7", captainName: "Capt. Nia Calder", faction: "civilian", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-2", callsign: "Courier Finch-3", captainName: "Capt. Joren Hale", faction: "civilian", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-ufp-kestrel-1", callsign: "UFP Kestrel-2", captainName: "Lt. Mara Quill", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-ufp-kestrel-2", callsign: "UFP Kestrel-3", captainName: "Lt. Arlen Dax", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-ufp-pelican-1", callsign: "UFP Pelican-1", captainName: "Cmdr. Ilya Soren", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
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
    },
    update() {
      const npcs = state.civilianNpcs || [];
      updateConflictEncounters(npcs);
      npcs.forEach((npc) => {
        if (npc.faction === "ufp") {
          const nodeIds = Object.keys(getNodes());
          const allowed = nodeIds.filter((nodeId) => {
            const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
            return [
              "ufp_outpost_alpha",
              "ufp_outpost_bravo",
              "ufp_indigo_system_administration",
              "ufp_outpost_delta",
              "ufp_science_station",
              "anchor_station",
              "indigo_station",
              "barons_market",
            ].includes(nodeId)
              || /ufp outpost alpha|ufp outpost bravo|ufp indigo system administration|ufp outpost delta|ufp science station|anchor station|indigo station|baron'?s market/i.test(label);
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
    getConflictDebugLines() {
      const entries = [...conflictEncounters.values()];
      if (!entries.length) return ["dbConflict: no active NPC conflicts."];
      return entries
        .sort((a, b) => b.stress - a.stress)
        .map((entry, idx) => `${idx + 1}. ${entry.aggressorId} -> ${entry.responderId} @ ${entry.nodeId} | stage=${entry.stage} | stress=${entry.stress.toFixed(2)} | seen=${entry.lastSeenTick}`);
    },
  };
}
