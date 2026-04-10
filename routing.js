export function buildGraphFrom(nodes, edges) {
  const graph = {};
  Object.keys(nodes || {}).forEach((key) => {
    graph[key] = [];
  });
  (edges || []).forEach(([a, b, w]) => {
    if (!graph[a]) graph[a] = [];
    if (!graph[b]) graph[b] = [];
    graph[a].push({ to: b, cost: w });
    graph[b].push({ to: a, cost: w });
  });
  return graph;
}

export function routeDistance(adjacency, from, to, visited = new Set()) {
  if (from === to) return 0;
  visited.add(from);
  const choices = (adjacency[from] || [])
    .filter((node) => !visited.has(node.to))
    .map((node) => {
      const sub = routeDistance(adjacency, node.to, to, new Set(visited));
      return sub === Infinity ? Infinity : node.cost + sub;
    });
  return choices.length ? Math.min(...choices) : Infinity;
}

export function safeRouteDistance(adjacency, nodes, from, to) {
  const distance = routeDistance(adjacency, from, to);
  if (Number.isFinite(distance)) return Math.max(1, distance);
  return Math.max(1, Object.keys(nodes || {}).length * 3);
}

export function shipSpeed(speedByShipId, shipId) {
  return Math.max(1, speedByShipId?.[shipId] || 1);
}

export function travelTimeForLegs(speedByShipId, shipId, legCount = 1) {
  const speed = shipSpeed(speedByShipId, shipId);
  const perLeg = Math.max(1, Math.round(12 / speed));
  return perLeg * Math.max(1, legCount);
}

export function orbitBandValue(layer0, moonId) {
  const moon = layer0?.moons?.[moonId];
  if (!moon) return 1;
  return layer0?.orbits?.[moon.orbit] || 1;
}

export function fuelCostForRoute({ nodes, adjacency, layer0, fromNodeId, toNodeId }) {
  const fromNode = nodes?.[fromNodeId];
  const toNode = nodes?.[toNodeId];
  if (!fromNode || !toNode) return 0;
  const distance = safeRouteDistance(adjacency, nodes, fromNodeId, toNodeId);
  const fromBand = orbitBandValue(layer0, fromNode.moon);
  const toBand = orbitBandValue(layer0, toNode.moon);
  const bandDelta = toBand - fromBand;
  const gravityMultiplier = bandDelta > 0 ? 2 : bandDelta < 0 ? 0.35 : 1;
  return Math.max(10, Math.round(distance * 12 * gravityMultiplier));
}
