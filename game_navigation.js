export function createNavigationModel({
  state,
  getNodes,
  getAdjacency,
  shipSpeedById,
  commandNodeId,
}) {
  return {
    routeDistance(from, to) {
      if (from === to) return 0;
      const adjacency = getAdjacency();
      if (!adjacency[from] || !adjacency[to]) return Infinity;

      const distances = {};
      const visited = new Set();
      Object.keys(adjacency).forEach((nodeId) => {
        distances[nodeId] = Infinity;
      });
      distances[from] = 0;

      while (true) {
        let current = null;
        let bestDistance = Infinity;
        Object.keys(distances).forEach((nodeId) => {
          if (!visited.has(nodeId) && distances[nodeId] < bestDistance) {
            current = nodeId;
            bestDistance = distances[nodeId];
          }
        });
        if (!current || bestDistance === Infinity) break;
        if (current === to) return bestDistance;
        visited.add(current);

        (adjacency[current] || []).forEach((edge) => {
          if (visited.has(edge.to)) return;
          const nextCost = bestDistance + edge.cost;
          if (nextCost < distances[edge.to]) distances[edge.to] = nextCost;
        });
      }

      return distances[to];
    },
    safeRouteDistance(from, to) {
      const distance = this.routeDistance(from, to);
      if (Number.isFinite(distance)) return Math.max(1, distance);
      return Math.max(1, Object.keys(getNodes()).length * 3);
    },
    shipSpeed(shipId) {
      return Math.max(1, shipSpeedById[shipId] || 1);
    },
    travelTimeForRoute(shipId, routeSpan = 1) {
      const speed = this.shipSpeed(shipId);
      const normalizedSpan = Math.max(1, routeSpan);
      return Math.max(1, Math.round((normalizedSpan * 12) / speed));
    },
    orbitBandValue(moonId) {
      const moon = state.mapData?.layer0?.moons?.[moonId];
      if (!moon) return 1;
      return state.mapData?.layer0?.orbits?.[moon.orbit] || 1;
    },
    fuelCostForRoute(fromNodeId, toNodeId, shipId = null) {
      const nodes = getNodes();
      const fromNode = nodes[fromNodeId];
      const toNode = nodes[toNodeId];
      if (!fromNode || !toNode) return 0;
      const distance = this.safeRouteDistance(fromNodeId, toNodeId);
      const fromBand = this.orbitBandValue(fromNode.moon);
      const toBand = this.orbitBandValue(toNode.moon);
      const bandDelta = toBand - fromBand;
      const driveShip = shipId ? state.ships.find((s) => s.id === shipId) : null;
      const uphillMultiplier = driveShip?.utility ? 1 : 2;
      const gravityMultiplier = bandDelta > 0 ? uphillMultiplier : bandDelta < 0 ? 0.35 : 1;
      return Math.max(10, Math.round(distance * 12 * gravityMultiplier));
    },
    fuelBillingActive() {
      return state.currentScenario >= 2;
    },
    oneWaySignalToNode(nodeId) {
      return this.safeRouteDistance(commandNodeId(), nodeId);
    },
    oneWaySignalToShip(ship) {
      return this.oneWaySignalToNode(ship.lastKnownAt || ship.at);
    },
  };
}

export function createBuddeAdvisor({
  state,
  getNodes,
  openContracts,
  fuelCostForRoute,
  nodeLabel,
  candidateDestinationsForShip,
  buddeInform,
  buddeSpeak,
}) {
  return {
    adviseContractOptions(shipId) {
      if (state.currentScenario < 2) return;
      const ship = state.ships.find((s) => s.id === shipId);
      const contracts = openContracts();
      if (!ship || contracts.length < 1) return;

      const scored = contracts.map((c) => ({
        contract: c,
        fuel: fuelCostForRoute(ship.at, c.from) + fuelCostForRoute(c.from, c.to),
      })).sort((a, b) => a.fuel - b.fuel);

      const best = scored[0];
      const alt = scored[1];
      const bestLabel = `${best.contract.id} (${nodeLabel(best.contract.from)} → ${nodeLabel(best.contract.to)})`;
      const preview = scored.slice(0, 2).map((entry) => `${entry.contract.id}: ${entry.fuel} fuel`).join(" | ");
      if (preview) buddeInform(`Contract fuel estimates: ${preview}.`);
      if (alt) {
        const savingsFuel = Math.max(1, alt.fuel - best.fuel);
        const savings = Math.max(1, Math.round(((alt.fuel - best.fuel) / alt.fuel) * 100));
        buddeInform(`Contract routing options available. My recommendation is ${bestLabel}. Estimated fuel reduction: ${savingsFuel} (${savings}%) versus your next best contract choice.`);
      } else {
        buddeInform(`Only one contract route available: ${bestLabel}.`);
      }

      const destinationApproach = getNodes()[best.contract.to]?.approach || 0;
      if (destinationApproach >= 7) {
        buddeSpeak("highVarianceApproach", "Destination approach variance is high. Treat ETA as an estimate, not a promise.");
      }
    },
    adviseDestinationOptions(shipId) {
      if (state.currentScenario < 2) return;
      const ship = state.ships.find((s) => s.id === shipId);
      if (!ship) return;
      const choices = candidateDestinationsForShip(ship.id)
        .map((nodeId) => ({ nodeId, fuel: fuelCostForRoute(ship.at, nodeId, ship.id) }))
        .sort((a, b) => a.fuel - b.fuel);
      if (!choices.length) return;

      const best = choices[0];
      const alt = choices[1];
      const preview = choices.slice(0, 2).map((entry) => `${nodeLabel(entry.nodeId)}: ${entry.fuel} fuel`).join(" | ");
      if (preview) buddeInform(`Destination fuel estimates: ${preview}.`);
      if (alt) {
        const savingsFuel = Math.max(1, alt.fuel - best.fuel);
        const savings = Math.max(1, Math.round(((alt.fuel - best.fuel) / alt.fuel) * 100));
        buddeInform(`Destination options available. My recommendation is ${nodeLabel(best.nodeId)}. Estimated fuel reduction: ${savingsFuel} (${savings}%) versus your other immediate option.`);
      } else {
        buddeInform(`Single reachable destination candidate: ${nodeLabel(best.nodeId)}.`);
      }

      if ((getNodes()[best.nodeId]?.approach || 0) >= 7) {
        buddeSpeak("highVarianceApproach", "Local approach spread is high at this destination. Expect variable final timing.");
      }
    },
  };
}
