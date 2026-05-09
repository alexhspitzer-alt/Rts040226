export const CIVILIAN_SHIPS = [
  { id: "civ-hauler-1", type: "hauler", callSign: "Marlin Heavy 14", startAt: "anchor_station" },
  { id: "civ-hauler-2", type: "hauler", callSign: "Lattice Bulk 22", startAt: "refinery" },
  { id: "civ-courier-1", type: "courier", callSign: "Needle Dash 3", startAt: "indigo_station" },
  { id: "civ-courier-2", type: "courier", callSign: "Comet Relay 7", startAt: "yard" },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nextDepartureTick(tick) {
  return tick + randomInt(40, 120);
}

function pickRandomDestination(currentNodeId, nodes) {
  const options = Object.keys(nodes || {}).filter((nodeId) => nodeId !== currentNodeId);
  if (!options.length) return currentNodeId;
  return options[Math.floor(Math.random() * options.length)];
}

function travelDuration(type) {
  if (type === "courier") return randomInt(20, 55);
  return randomInt(35, 80);
}

export function createCivilianTrafficState(currentTick, nodes, fallbackNode = "anchor_station") {
  const validFallback = nodes?.[fallbackNode] ? fallbackNode : Object.keys(nodes || {})[0];
  return CIVILIAN_SHIPS.map((ship) => {
    const startAt = nodes?.[ship.startAt] ? ship.startAt : validFallback;
    return {
      ...ship,
      at: startAt,
      status: "holding",
      destination: null,
      arriveAt: 0,
      departAt: nextDepartureTick(currentTick),
    };
  });
}

export function runCivilianTrafficTick({ state, tick, nodes, nodeLabel, logLine }) {
  if (!Array.isArray(state?.civilianTraffic) || !nodes) return;

  const playerShipLocations = new Set((state.ships || []).map((ship) => ship.at));

  state.civilianTraffic.forEach((ship) => {
    if (ship.status === "holding" && tick >= ship.departAt) {
      ship.destination = pickRandomDestination(ship.at, nodes);
      ship.arriveAt = tick + travelDuration(ship.type);
      ship.status = "enroute";
      return;
    }

    if (ship.status !== "enroute" || tick < ship.arriveAt) return;

    ship.at = ship.destination;
    ship.destination = null;
    ship.arriveAt = 0;
    ship.departAt = nextDepartureTick(tick);
    ship.status = "holding";

    const shouldCall = ship.at === "anchor_station" || playerShipLocations.has(ship.at);
    if (shouldCall) {
      logLine(
        `${ship.callSign}, civilian ${ship.type}, on final approach to ${nodeLabel(ship.at)}. Requesting docking clearance.`,
        "comms"
      );
    }
  });
}
