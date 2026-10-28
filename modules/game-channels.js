import { isShipDestroyed } from "./game-selectors.js";

export const DISPATCH_CHANNEL = "anchor_station";

// A route is the finest position the simulation exposes between ports. Docked
// utility ships share their host's position, including both contract legs.
export function shipChannelPosition(ship, ships = []) {
  if (!ship || isShipDestroyed(ship)) return null;
  const host = ship.dockedTo && ships.find((entry) => entry.id === ship.dockedTo);
  if (host && host !== ship && !host.dockedTo) return shipChannelPosition(host, ships);
  if (ship.status !== "enroute" || !ship.destination) {
    return ship.at ? { key: ship.at, nodeId: ship.at } : null;
  }
  const plan = ship.travelPlan || {};
  const secondLeg = plan.mode === "contract" && (plan.firstLegDockRecorded || plan.firstLegFrom === plan.firstLegTo);
  const from = plan.mode === "contract"
    ? (secondLeg ? plan.secondLegFrom : plan.firstLegFrom) || ship.at
    : plan.currentLegFrom || ship.at;
  const to = plan.mode === "contract"
    ? (secondLeg ? plan.secondLegTo : plan.firstLegTo) || ship.destination
    : plan.currentLegTo || ship.destination;
  return { key: `route:${from}:${to}`, from, to };
}

export function occupiedChannelPositions(state) {
  const positions = new Map([[DISPATCH_CHANNEL, { key: DISPATCH_CHANNEL, nodeId: DISPATCH_CHANNEL, ships: [] }]]);
  for (const ship of state.ships || []) {
    const position = shipChannelPosition(ship, state.ships);
    if (!position || !position.nodeId) continue;
    if (!positions.has(position.key)) positions.set(position.key, { ...position, ships: [] });
    positions.get(position.key).ships.push(ship);
  }
  return positions;
}

export function sensorChannelKeys(state, nodeId) {
  const keys = new Set(nodeId === DISPATCH_CHANNEL ? [DISPATCH_CHANNEL] : []);
  for (const ship of state.ships || []) {
    const position = shipChannelPosition(ship, state.ships);
    if (!position || !position.nodeId) continue;
    const localSensors = position.nodeId === nodeId && !ship.sensorsMuted;
    if (localSensors) {
      keys.add(position.key);
    }
  }
  return [...keys];
}

export function resolveMessageChannelKeys(state, { shipId, nodeId, dispatch } = {}) {
  if (dispatch) return [DISPATCH_CHANNEL];
  if (shipId) {
    const ship = state.ships?.find((entry) => entry.id === shipId);
    const position = shipChannelPosition(ship, state.ships);
    return position ? [position.nodeId ? position.key : DISPATCH_CHANNEL] : [];
  }
  if (nodeId) return sensorChannelKeys(state, nodeId);
  return [DISPATCH_CHANNEL];
}
