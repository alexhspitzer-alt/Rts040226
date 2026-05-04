export function buildGraph(nodes, edges) {
  const graph = {};
  Object.keys(nodes).forEach((k) => {
    graph[k] = [];
  });
  edges.forEach(([a, b, w]) => {
    graph[a].push({ to: b, cost: w });
    graph[b].push({ to: a, cost: w });
  });
  return graph;
}

function angleDelta(a, b) {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

function orbitRadiusForScenario(orbitId, layer0, options = {}) {
  const baseRadius = layer0?.orbits?.[orbitId] || 1;
  if (!options.exponentialOrbitStretch) return baseRadius;
  const orbitIndex = Math.max(1, baseRadius);
  const stretch = Math.exp((orbitIndex - 1) * 0.45);
  return baseRadius * stretch;
}

function estimateRouteCost(fromNode, toNode, layer0, options = {}) {
  if (fromNode.id === toNode.id) return 0;
  if (fromNode.moon === toNode.moon) {
    return Math.max(1, 2 + Math.round((fromNode.approach + toNode.approach) / 3));
  }

  const moonA = layer0.moons[fromNode.moon];
  const moonB = layer0.moons[toNode.moon];
  const orbitBands = layer0.orbits;
  const orbitDelta = Math.abs((orbitBands[moonA.orbit] || 1) - (orbitBands[moonB.orbit] || 1));
  const arc = angleDelta(moonA.angle, moonB.angle);
  const arcRadians = (arc * Math.PI) / 180;
  const radiusA = orbitRadiusForScenario(moonA.orbit, layer0, options);
  const radiusB = orbitRadiusForScenario(moonB.orbit, layer0, options);
  const averageRadius = (radiusA + radiusB) / 2;
  const arcCost = Math.max(1, Math.round(arcRadians * averageRadius * 3.5));
  const approachVariance = Math.round((fromNode.approach + toNode.approach) / 4);
  return Math.max(2, arcCost + orbitDelta * 2 + approachVariance);
}

function mergeScenarioLayers(scenarios = []) {
  const mergedMoons = {};
  scenarios.forEach((scenario) => {
    if (!scenario?.activeMoons) return;
    Object.entries(scenario.activeMoons).forEach(([moonId, moon]) => {
      if (!mergedMoons[moonId]) {
        mergedMoons[moonId] = { name: moon?.name || moonId, locations: {} };
      }
      if (moon?.name) mergedMoons[moonId].name = moon.name;
      Object.assign(mergedMoons[moonId].locations, moon?.locations || {});
    });
  });
  return mergedMoons;
}

function summedScenarioFromLayers(mapData, layerKeys = []) {
  const scenarioByLayer = {
    layer1: mapData?.layer1?.tutorialScenario,
    layer2: mapData?.layer2?.scenario2,
    layer3: mapData?.layer3?.scenario3,
  };
  const scenarios = layerKeys.map((key) => scenarioByLayer[key]).filter(Boolean);
  return {
    activeMoons: mergeScenarioLayers(scenarios),
  };
}

function buildCanonicalScenarioMap(scenarios, layer0, options = {}) {
  if (!Array.isArray(scenarios) || !scenarios.length || !layer0) return null;

  const builtNodes = {};
  const locationEntries = [];
  const mergedMoons = mergeScenarioLayers(scenarios);
  Object.entries(mergedMoons).forEach(([moonId, moon]) => {
    Object.entries(moon.locations || {}).forEach(([locId, location]) => {
      builtNodes[locId] = {
        label: location.name,
        moon: moonId,
        moonName: moon.name,
        approach: location.approach,
      };
      locationEntries.push({ id: locId, moon: moonId, approach: location.approach });
    });
  });

  if (!Object.keys(builtNodes).length) return null;

  const builtEdges = [];
  for (let i = 0; i < locationEntries.length; i += 1) {
    for (let j = i + 1; j < locationEntries.length; j += 1) {
      const a = locationEntries[i];
      const b = locationEntries[j];
      const cost = estimateRouteCost(a, b, layer0, options);
      builtEdges.push([a.id, b.id, cost]);
    }
  }

  return {
    nodes: builtNodes,
    edges: builtEdges,
    adjacency: buildGraph(builtNodes, builtEdges),
  };
}

export function buildCanonicalTutorialMap(mapData) {
  const scenario1Summed = summedScenarioFromLayers(mapData, ["layer1"]);
  return buildCanonicalScenarioMap([scenario1Summed], mapData?.layer0);
}

export function buildScenario2Map(mapData) {
  const scenario2Summed = summedScenarioFromLayers(mapData, ["layer1", "layer2"]);
  return buildCanonicalScenarioMap([scenario2Summed], mapData?.layer0);
}

export function buildScenario3Map(mapData) {
  const scenario3Summed = summedScenarioFromLayers(mapData, ["layer1", "layer2", "layer3"]);
  return buildCanonicalScenarioMap([scenario3Summed], mapData?.layer0, { exponentialOrbitStretch: true });
}

export function commandNodeId(nodes, playerNode) {
  if (nodes[playerNode]) return playerNode;
  const [firstNode] = Object.keys(nodes);
  return firstNode || playerNode;
}

export function syncShipLocationsToActiveMap(state, nodes, playerNode) {
  const fallbackNode = commandNodeId(nodes, playerNode);
  state.ships.forEach((ship) => {
    if (!nodes[ship.at]) ship.at = fallbackNode;
    if (!nodes[ship.lastKnownAt]) ship.lastKnownAt = ship.at;
    if (ship.destination && !nodes[ship.destination] && ship.status === "idle") {
      ship.destination = undefined;
    }
  });
}

export function nodeLabel(nodes, nodeId) {
  const node = nodes[nodeId];
  if (!node) return nodeId;
  return `${node.label}${node.moonName ? ` (${node.moonName})` : ""}`;
}

export function normalizeNodeInput(rawNodeId, nodes, legacyNodeAliases = {}) {
  if (!rawNodeId) return null;
  if (nodes[rawNodeId]) return rawNodeId;
  const alias = legacyNodeAliases[rawNodeId];
  if (alias && nodes[alias]) return alias;
  return null;
}

export function orbitBandForNode(nodeId, nodes, mapData) {
  const node = nodes[nodeId];
  const moon = node ? mapData?.layer0?.moons?.[node.moon] : null;
  if (!moon) return null;
  return mapData?.layer0?.orbits?.[moon.orbit] || null;
}

export function candidateDestinationsForShip(shipId, state, nodes, mapData) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return [];
  const currentBand = orbitBandForNode(ship.at, nodes, mapData);
  if (!currentBand) return Object.keys(nodes).filter((nodeId) => nodeId !== ship.at).slice(0, 7);

  const entries = Object.keys(nodes).filter((nodeId) => nodeId !== ship.at).map((nodeId) => ({
    nodeId,
    band: orbitBandForNode(nodeId, nodes, mapData),
  }));

  const sameBand = entries
    .filter((entry) => entry.band === currentBand)
    .map((entry) => entry.nodeId)
    .slice(0, 5);

  const findTransferLane = (band) => entries
    .filter((entry) => entry.band === band && /transfer_lane/i.test(entry.nodeId))
    .map((entry) => entry.nodeId)[0];

  const upperLane = findTransferLane(currentBand + 1);
  const lowerLane = findTransferLane(currentBand - 1);

  const ordered = [...sameBand];
  if (upperLane) ordered.push(upperLane);
  if (lowerLane) ordered.push(lowerLane);

  return [...new Set(ordered)].slice(0, 7);
}

export function isTransferLaneNode(nodeId, nodes) {
  return /transfer lane/i.test(nodes[nodeId]?.label || "");
}
