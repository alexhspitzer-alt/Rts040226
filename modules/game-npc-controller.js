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

  function pickDestination(fromNodeId) {
    const adjacency = getAdjacency();
    const options = (adjacency[fromNodeId] || []).map((edge) => edge.to).filter(Boolean);
    if (options.length) return randomPick(options);
    const allNodes = Object.keys(getNodes());
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
      npc.callsign,
      `${npc.callsign} on final approach to ${nodeLabel(destinationNodeId)}. Requesting docking clearance.`,
      "arriving",
      "comms"
    );
  }

  function startTransit(npc) {
    const destinationNodeId = pickDestination(npc.at);
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
      state.civilianNpcs = [
        { id: "npc-hauler-1", callsign: "CIV Hauler Vesper-14", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-hauler-2", callsign: "CIV Hauler Morrow-22", role: "hauler", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-1", callsign: "CIV Courier Kite-7", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
        { id: "npc-courier-2", callsign: "CIV Courier Finch-3", role: "courier", at: spawn(), status: "idle", departAt: 0, arrivalTick: 0 },
      ];
      state.civilianNpcs.forEach((npc) => {
        const wait = randomInt(NPC_ARRIVAL_MIN, NPC_ARRIVAL_MAX);
        npc.departAt = state.tick + wait;
      });
      shipSpeedById["npc-hauler-1"] = 2;
      shipSpeedById["npc-hauler-2"] = 2;
      shipSpeedById["npc-courier-1"] = 4;
      shipSpeedById["npc-courier-2"] = 4;
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
