export function isShipDestroyed(ship) {
  return ship?.status === "destroyed" || ship?.combatStatus === "killed";
}

export function selectShipById(state, shipId) {
  return (state?.ships || []).find((ship) => ship.id === shipId) || null;
}

export function selectSelectedShip(state) {
  return selectShipById(state, state?.selection?.selectedShipId);
}

export function selectOpenContracts(state) {
  return (state?.contracts || []).filter((contract) => contract.status === "open");
}

export function selectPlayerControlledShipCount(state) {
  return Array.isArray(state?.ships)
    ? state.ships.filter((ship) => !isShipDestroyed(ship)).length
    : 0;
}

export function selectVisibleOpenContracts(state) {
  return selectOpenContracts(state).slice(0, selectPlayerControlledShipCount(state));
}

export function selectActiveCommsContacts(state, { excluded = [], isContactPresent = () => true } = {}) {
  const excludedSet = new Set(excluded);
  return Object.keys(state?.dialogueDb || {}).filter((name) => !excludedSet.has(name) && isContactPresent(name));
}
