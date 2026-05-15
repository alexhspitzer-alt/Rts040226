const NPC_ARRIVAL_MIN = 40;
const NPC_ARRIVAL_MAX = 120;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPick(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
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
    const allow = Array.isArray(allowedNodeIds) && allowedNodeIds.length ? new Set(allowedNodeIds) : null;
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
      const ufpNodeIds = nodeIds.filter((nodeId) => {
        if (UFP_OR_STATION_NODE_IDS.has(nodeId)) return true;
        const label = String(getNodes()?.[nodeId]?.label || nodeLabel(nodeId) || "");
        return UFP_OR_STATION_LABEL_PATTERNS.some((pattern) => pattern.test(label));
      });
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
    },
    update() {
      const npcs = state.civilianNpcs || [];
      npcs.forEach((npc) => {
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
