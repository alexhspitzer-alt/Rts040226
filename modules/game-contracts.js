let randomNumber = () => globalThis.Math.random();

const CONTRACT_PAYOUT_VARIABILITY = 240;
const CONTRACT_PAYOUT_BASE = 260;
const CONTRACT_CLIENT_PAYOUT_ADJUSTMENTS = {
  ufp: 60,
  civilian: 0,
  station_municipal: -60,
};

function normalizedClientKey(client) {
  return String(client || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function contractPayoutForClient(client) {
  const clientKey = normalizedClientKey(client);
  const clientAdjustment = CONTRACT_CLIENT_PAYOUT_ADJUSTMENTS[clientKey] ?? 0;
  return CONTRACT_PAYOUT_BASE + clientAdjustment + Math.floor(randomNumber() * CONTRACT_PAYOUT_VARIABILITY);
}

export function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(randomNumber() * (high - low + 1)) + low;
}

export function randomFrom(pool) {
  if (!Array.isArray(pool) || !pool.length) return null;
  return pool[Math.floor(randomNumber() * pool.length)];
}

function idsForLocationNames(names = [], labelToId = {}) {
  return names.map((name) => labelToId[name]).filter(Boolean);
}

function cargoRequirementForType(cargoType, cargoRules) {
  const sizeRules = cargoRules.cargoSizeRules || {};
  const globalRule = sizeRules.global || { min: 1, max: 10 };
  const byType = sizeRules.byCargoType?.[cargoType] || {};
  if (Number.isInteger(byType.exact)) return byType.exact;
  const min = Number.isInteger(byType.min) ? byType.min : globalRule.min;
  const max = Number.isInteger(byType.max) ? byType.max : globalRule.max;
  const nonVip = sizeRules.nonVIP || { min: 2, max: 10 };
  const finalMin = cargoType === "VIP" ? min : Math.max(min, nonVip.min);
  const finalMax = cargoType === "VIP" ? max : Math.min(max, nonVip.max);
  return randomInt(finalMin, finalMax);
}

export function createContractTools({
  state,
  getNodes,
  shipCapacityById,
  cargoGenerationRules,
  isTransferLaneNode,
  randomProvider = null,
}) {
  randomNumber = typeof randomProvider?.number === "function" ? () => randomProvider.number() : randomNumber;
  function generateCargoContractData() {
    const nodes = getNodes();
    const labelToId = Object.fromEntries(Object.entries(nodes).map(([nodeId, node]) => [node.label, nodeId]));
    const allNodeIds = Object.keys(nodes);
    if (allNodeIds.length < 2) return null;

    const cargoType = randomFrom(Object.keys(cargoGenerationRules.cargoClients));
    const client = randomFrom(cargoGenerationRules.cargoClients[cargoType] || []);
    if (!cargoType || !client) return null;

    const cargoRequirement = cargoRequirementForType(cargoType, cargoGenerationRules);
    const maxNonUtilityCapacity = Math.max(
      0,
      ...state.ships.filter((ship) => !ship.utility).map((ship) => ship.cargoCapacity || shipCapacityById[ship.id] || 0)
    );
    if (cargoRequirement > maxNonUtilityCapacity) return null;

    const { locationSets, cargoOriginRules, globalOriginOverrides, clientDestinationRules, globalRules } = cargoGenerationRules;
    const transferLaneNodeIds = new Set(idsForLocationNames(locationSets.transfer_lanes, labelToId));
    const stationNodeIds = idsForLocationNames(locationSets.stations, labelToId);
    const outpostNodeIds = idsForLocationNames(locationSets.ufp_outposts, labelToId);

    const originRule = cargoOriginRules[cargoType];
    let originPool = [];
    if (Array.isArray(originRule)) {
      originPool = idsForLocationNames(originRule, labelToId);
    } else if (originRule === "stations") {
      originPool = [...stationNodeIds];
    } else if (originRule === "any_non_transfer_lane") {
      originPool = allNodeIds.filter((nodeId) => !transferLaneNodeIds.has(nodeId) && !isTransferLaneNode(nodeId));
    }
    originPool.push(...idsForLocationNames(globalOriginOverrides, labelToId));
    originPool = [...new Set(originPool)];
    if (globalRules.no_origin_from_transfer_lanes) {
      originPool = originPool.filter((nodeId) => !transferLaneNodeIds.has(nodeId) && !isTransferLaneNode(nodeId));
    }
    if (!originPool.length) return null;

    const destinationRule = clientDestinationRules[client];
    let destinationPool = [];
    if (destinationRule === "ufp_outposts") {
      destinationPool = [...outpostNodeIds];
    } else if (destinationRule === "stations") {
      destinationPool = [...stationNodeIds];
    } else if (destinationRule === "any_valid_destination") {
      destinationPool = [...allNodeIds];
    }

    const transferAllowedCargo = globalRules.transfer_lane_destinations?.allowed_cargo || [];
    if (!transferAllowedCargo.includes(cargoType)) {
      destinationPool = destinationPool.filter((nodeId) => !transferLaneNodeIds.has(nodeId) && !isTransferLaneNode(nodeId));
    }
    destinationPool = [...new Set(destinationPool)];
    if (!destinationPool.length) return null;

    const eligibleShips = state.ships.filter(
      (ship) => !ship.utility && (ship.cargoCapacity || shipCapacityById[ship.id] || 0) >= cargoRequirement
    );
    if (!eligibleShips.length) return null;

    const origin = randomFrom(originPool);
    const destinationCandidates = destinationPool.filter((nodeId) => !globalRules.origin_cannot_equal_destination || nodeId !== origin);
    if (!origin || !destinationCandidates.length) return null;
    const destination = randomFrom(destinationCandidates);

    return {
      from: origin,
      to: destination,
      client: client.replace(/_/g, " "),
      cargoType: cargoType.replace(/_/g, " "),
      cargoRequirement,
    };
  }

  function generateContract() {
    const nodes = getNodes();
    const origins = Object.keys(nodes);
    if (origins.length < 2) return null;
    let from = origins[Math.floor(randomNumber() * origins.length)];
    let to = from;
    let client = null;
    let cargoType = null;
    let cargoRequirement = null;

    if (state.currentScenario >= 2) {
      const generated = generateCargoContractData();
      if (generated) {
        from = generated.from;
        to = generated.to;
        client = generated.client;
        cargoType = generated.cargoType;
        cargoRequirement = generated.cargoRequirement;
      } else {
        while (to === from) to = origins[Math.floor(randomNumber() * origins.length)];
        const scenario2Fields = state.scenario2Dialogue?.metadata?.contractFields || {};
        const clients = Array.isArray(scenario2Fields.client) ? scenario2Fields.client : [];
        const cargoTypes = Array.isArray(scenario2Fields.cargoType) ? scenario2Fields.cargoType : [];
        client = clients.length ? clients[Math.floor(randomNumber() * clients.length)] : null;
        cargoType = cargoTypes.length ? cargoTypes[Math.floor(randomNumber() * cargoTypes.length)] : null;
      }
    } else {
      while (to === from) to = origins[Math.floor(randomNumber() * origins.length)];
    }

    const isScenario4DeuteriumExclusive = state.currentScenario >= 4
      && String(client || "").toLowerCase() === "ufp"
      && String(cargoType || "").toLowerCase() === "deuterium";
    const contract = {
      id: `C-${state.nextContract++}`,
      from,
      to,
      payout: isScenario4DeuteriumExclusive ? 0 : contractPayoutForClient(client),
      status: "open",
      client,
      cargoType,
      cargoRequirement,
    };
    state.contracts.push(contract);
    return contract;
  }

  return { generateContract, generateCargoContractData };
}
