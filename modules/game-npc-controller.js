const NPC_LOITER_MIN = 40;
const NPC_LOITER_MAX = 360;
const NPC_LOITER_MODE = 200;
const NPC_LINE_REPEAT_WINDOW = 120;

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
}) {
  const recentNpcLineHistory = [];

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
  };
}
