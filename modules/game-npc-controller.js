const NPC_ARRIVAL_MIN = 40;
const NPC_ARRIVAL_MAX = 120;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPick(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}


const NPC_APPROACH_TONES = {
  civilian: [
    (ship, destination, dockingLine) => `${ship} on final approach to ${destination}. ${dockingLine}`,
    (ship, destination, dockingLine) => `${ship} inbound ${destination}. ${dockingLine}`,
    (ship, destination, dockingLine) => `${ship} checking in for ${destination} approach. ${dockingLine}`,
  ],
  ufp: [
    (ship, destination) => `${ship} on final approach to ${destination}. Announcing docking.`,
    (ship, destination) => `${ship} inbound ${destination}. Docking announcement follows.`,
    (ship, destination) => `${ship} final vector for ${destination}. Announcing docking.`,
  ],
  arcworks: [
    (ship, destination, dockingLine) => `${ship} on final approach to ${destination}. ${dockingLine}`,
    (ship, destination, dockingLine) => `${ship} transit authority approach notice for ${destination}. ${dockingLine}`,
    (ship, destination, dockingLine) => `${ship} arrival protocol active at ${destination}. ${dockingLine}`,
  ],
  blister: [
    (ship) => `${ship}, activating transponder on local channel.`,
    (ship) => `${ship}, local channel transponder now active.`,
    (ship) => `${ship}, broadcasting transponder mark on this channel.`,
  ],
};

function pickStyleLine(faction, ship, destination, dockingLine) {
  const pool = NPC_APPROACH_TONES[faction] || NPC_APPROACH_TONES.civilian;
  const builder = pool[Math.floor(Math.random() * pool.length)] || pool[0];
  return builder(ship, destination, dockingLine);
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
  function idleNpcAtNode(npc, nodeId) {
    npc.at = nodeId;
    npc.destination = null;
    npc.status = "idle";
    npc.arrivalTick = 0;
    npc.departAt = state.tick + randomInt(NPC_ARRIVAL_MIN, NPC_ARRIVAL_MAX);
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
    const destinationLabel = nodeLabel(destinationNodeId);
    if (npc.faction === "blister") {
      return pickStyleLine("blister", npc.callsign, destinationLabel, "");
    }
    if (npc.faction === "arcworks") {
      const dockingLine = isArcworksNode(destinationNodeId) ? "Announcing docking." : "Requesting docking clearance.";
      return pickStyleLine("arcworks", npc.callsign, destinationLabel, dockingLine);
    }
    if (npc.faction === "ufp") {
      return pickStyleLine("ufp", npc.callsign, destinationLabel, "Announcing docking.");
    }
    return pickStyleLine("civilian", npc.callsign, destinationLabel, "Requesting docking clearance.");
  }

  function scheduleFinalApproach(npc, fromNodeId, destinationNodeId, uplink, transitTime) {
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
        { id: "npc-hauler-1", callsign: "Hauler Vesper-14", captainName: "Capt. Elara Voss", faction: "civilian", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-hauler-2", callsign: "Hauler Morrow-22", captainName: "Capt. Rowan Pike", faction: "civilian", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-1", callsign: "Courier Kite-7", captainName: "Capt. Nia Calder", faction: "civilian", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-2", callsign: "Courier Finch-3", captainName: "Capt. Joren Hale", faction: "civilian", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-ufp-kestrel-1", callsign: "UFP Kestrel-2", captainName: "Lt. Mara Quill", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-ufp-kestrel-2", callsign: "UFP Kestrel-3", captainName: "Lt. Arlen Dax", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-ufp-pelican-1", callsign: "UFP Pelican-1", captainName: "Cmdr. Ilya Soren", faction: "ufp", role: "patrol", at: spawnUfp(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: ufpNodeIds },
        { id: "npc-blister-dragoon-1", callsign: "Blister Dragoon-2", captainName: "Capt. Rysa Korr", faction: "blister", role: "raider", at: spawnBlister(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: blisterNodeIds },
        { id: "npc-blister-dragoon-2", callsign: "Blister Dragoon-3", captainName: "Capt. Varek Noll", faction: "blister", role: "raider", at: spawnBlister(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: blisterNodeIds },
        { id: "npc-arcworks-mk4-1", callsign: "Arcworks MK-IV", captainName: "Supervisor Edda Marr", faction: "arcworks", role: "industrial", at: spawnArcworks(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: arcworksNodeIds },
        { id: "npc-arcworks-mm9-1", callsign: "Arcworks MM-IX", captainName: "Supervisor Tal Ren", faction: "arcworks", role: "industrial", at: spawnArcworks(), status: "idle", departAt: 0, arrivalTick: 0, allowedNodeIds: arcworksNodeIds },
      ];
      state.civilianNpcs.forEach((npc) => {
        const wait = randomInt(NPC_ARRIVAL_MIN, NPC_ARRIVAL_MAX);
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
    },
    update() {
      const npcs = state.civilianNpcs || [];
      npcs.forEach((npc) => {
        if (npc.faction === "ufp" || npc.faction === "blister" || npc.faction === "arcworks") {
          const nodeIds = Object.keys(getNodes());
          const allowed = nodeIds.filter((nodeId) => {
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
  };
}
