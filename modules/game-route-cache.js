export function createRouteCache({ enabled = true, getVersion = () => 0 } = {}) {
  const routeDistances = new Map();
  const safeRouteDistances = new Map();
  const fuelCosts = new Map();
  const candidateDestinations = new Map();
  const stats = { hits: 0, misses: 0 };

  function cacheKey(parts) {
    return [getVersion(), ...parts].join("|");
  }

  function cached(map, keyParts, compute) {
    if (!enabled) return compute();
    const key = cacheKey(keyParts);
    if (map.has(key)) {
      stats.hits += 1;
      return map.get(key);
    }
    stats.misses += 1;
    const value = compute();
    map.set(key, value);
    return value;
  }

  function invalidate() {
    routeDistances.clear();
    safeRouteDistances.clear();
    fuelCosts.clear();
    candidateDestinations.clear();
  }

  function wrapNavigationModel(model) {
    const wrapped = Object.create(model);
    wrapped.routeDistance = (from, to) => cached(routeDistances, ["route", from, to], () => model.routeDistance(from, to));
    wrapped.safeRouteDistance = (from, to) => cached(safeRouteDistances, ["safe", from, to], () => model.safeRouteDistance.call(wrapped, from, to));
    wrapped.fuelCostForRoute = (from, to, shipId = null) => cached(
      fuelCosts,
      ["fuel", from, to, shipId || "none", model.fuelBillingActive()],
      () => model.fuelCostForRoute.call(wrapped, from, to, shipId),
    );
    wrapped.oneWaySignalToNode = (nodeId) => cached(
      safeRouteDistances,
      ["signal", nodeId],
      () => model.oneWaySignalToNode.call(wrapped, nodeId),
    );
    wrapped.oneWaySignalToShip = (ship) => wrapped.oneWaySignalToNode(ship.lastKnownAt || ship.at);
    return wrapped;
  }

  function candidateDestinationsForShip(shipId, shipAt, compute) {
    return cached(candidateDestinations, ["candidates", shipId, shipAt || "unknown"], () => compute());
  }

  return {
    enabled,
    stats,
    invalidate,
    wrapNavigationModel,
    candidateDestinationsForShip,
  };
}
