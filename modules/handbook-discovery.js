const ENTRY_ALIASES = {
  "union of free planets": ["ufp"],
  "station municipal authorities": ["station municipal", "station_municipal"],
  "consumer goods": ["consumer_goods"],
  "approach variability": ["approach value", "approach variance"],
};

const PARENT_DISCOVERIES = {
  "Orbit Bands": ["Low Orbit", "Ring Orbit", "High Orbit", "Outer Orbit"],
  "Transfer Lanes": [
    "Ring Transfer Lane",
    "Low Orbit Transfer Lane",
    "High Orbit Transfer Lane",
    "Deep Space Transfer Lane",
  ],
};

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(corpus, term) {
  const normalizedTerm = normalizedText(term);
  if (!normalizedTerm) return false;
  return ` ${corpus} `.includes(` ${normalizedTerm} `);
}

function appendObjectText(parts, value) {
  if (value === null || value === undefined) return;
  if (typeof value === "string" || typeof value === "number") {
    parts.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => appendObjectText(parts, item));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => appendObjectText(parts, item));
  }
}

function orbitLabelForNode(nodeId, nodes, mapData) {
  const moonId = nodes?.[nodeId]?.moon;
  const orbit = moonId ? mapData?.layer0?.moons?.[moonId]?.orbit : null;
  if (!orbit) return null;
  return `${orbit.charAt(0).toUpperCase()}${orbit.slice(1)} Orbit`;
}

function addLocationNames(target, nodeId, nodes, mapData) {
  const node = nodes?.[nodeId];
  if (!node) return;
  [node.label, node.moonName, orbitLabelForNode(nodeId, nodes, mapData)]
    .filter(Boolean)
    .forEach((name) => target.add(name));
}

function addMapLocationNames(target, mapData) {
  Object.values(mapData?.layer0?.moons || {}).forEach((moon) => {
    if (moon?.name) target.add(moon.name);
    if (moon?.orbit) {
      target.add(`${moon.orbit.charAt(0).toUpperCase()}${moon.orbit.slice(1)} Orbit`);
    }
  });

  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (!Array.isArray(value) && value.locations && typeof value.locations === "object") {
      Object.values(value.locations).forEach((location) => {
        if (location?.name) target.add(location.name);
      });
    }
    Object.values(value).forEach(visit);
  };
  visit(mapData);
}

export function collectHandbookLocationDiscovery({ state, nodes } = {}) {
  const physicalNames = new Set(["Indigo"]);
  const confirmedNames = new Set(["Indigo"]);

  addMapLocationNames(physicalNames, state?.mapData);
  Object.keys(nodes || {}).forEach((nodeId) => {
    addLocationNames(physicalNames, nodeId, nodes, state?.mapData);
  });

  (state?.ships || []).forEach((ship) => {
    addLocationNames(confirmedNames, ship?.lastKnownAt, nodes, state?.mapData);
  });

  return {
    physicalNames: [...physicalNames],
    confirmedNames: [...confirmedNames],
  };
}

export function collectHandbookEncounterText({ state, nodes, nodeLabel, consoleText = "" } = {}) {
  const parts = ["Indigo", "bluFreight", consoleText];
  const encounteredNodeIds = new Set();

  (state?.ships || []).forEach((ship) => {
    parts.push(ship.id);
    [ship.at, ship.lastKnownAt, ship.destination].filter(Boolean).forEach((nodeId) => encounteredNodeIds.add(nodeId));
  });

  (state?.contracts || []).forEach((contract) => {
    appendObjectText(parts, contract.client);
    [contract.from, contract.to].filter(Boolean).forEach((nodeId) => encounteredNodeIds.add(nodeId));
  });

  appendObjectText(parts, state?.inbox || []);
  appendObjectText(parts, state?.news || []);

  encounteredNodeIds.forEach((nodeId) => {
    parts.push(typeof nodeLabel === "function" ? nodeLabel(nodeId) : nodes?.[nodeId]?.label || nodeId);
    parts.push(nodes?.[nodeId]?.moonName || "");
    parts.push(orbitLabelForNode(nodeId, nodes, state?.mapData) || "");
  });

  return parts.filter(Boolean);
}

export function discoverHandbookEntries(entries, priorDiscoveries = [], encounterText = [], discoveryContext = null) {
  const discovered = new Set(priorDiscoveries);
  const corpus = normalizedText(Array.isArray(encounterText) ? encounterText.join(" ") : encounterText);
  const physicalLocationNames = new Set(
    (discoveryContext?.physicalNames || []).map((name) => normalizedText(name)),
  );
  const confirmedLocationNames = new Set(
    (discoveryContext?.confirmedNames || []).map((name) => normalizedText(name)),
  );
  const encounteredCargoTypes = new Set(
    (discoveryContext?.encounteredCargoTypes || []).map((name) => normalizedText(name)),
  );

  Object.entries(entries || {}).forEach(([categoryName, category]) => {
    const lists = Array.isArray(category)
      ? [category]
      : Object.values(category || {}).filter((group) => Array.isArray(group));
    lists.forEach((list) => {
      list.forEach((entry) => {
        const name = entry?.name;
        if (!name) return;
        const normalizedName = normalizedText(name);
        if (categoryName === "locations" && physicalLocationNames.has(normalizedName)) {
          if (confirmedLocationNames.has(normalizedName)) discovered.add(name);
          return;
        }
        if (categoryName === "cargo_types" && Array.isArray(discoveryContext?.encounteredCargoTypes)) {
          if (encounteredCargoTypes.has(normalizedName)) discovered.add(name);
          return;
        }
        const aliases = ENTRY_ALIASES[normalizedText(name)] || [];
        if ([name, ...aliases].some((term) => containsTerm(corpus, term))) discovered.add(name);
      });
    });
  });

  Object.entries(PARENT_DISCOVERIES).forEach(([parent, children]) => {
    if (children.some((child) => discovered.has(child))) discovered.add(parent);
  });

  return [...discovered].sort((a, b) => a.localeCompare(b));
}

export function rememberEncounteredCargoType(cargoTypes = [], cargoType = "") {
  const knownCargoTypes = Array.isArray(cargoTypes) ? cargoTypes : [];
  const normalizedCargoType = normalizedText(cargoType);
  if (!normalizedCargoType) return [...knownCargoTypes];
  if (knownCargoTypes.some((name) => normalizedText(name) === normalizedCargoType)) return [...knownCargoTypes];
  return [...knownCargoTypes, cargoType].sort((a, b) => a.localeCompare(b));
}

export function filterHandbookEntries(entries, discoveries = []) {
  const discovered = new Set(discoveries);
  const filtered = {};

  Object.entries(entries || {}).forEach(([categoryName, category]) => {
    if (Array.isArray(category)) {
      const visible = category.filter((entry) => discovered.has(entry?.name));
      if (visible.length) filtered[categoryName] = visible;
      return;
    }
    if (!category || typeof category !== "object") return;
    const visibleGroups = {};
    Object.entries(category).forEach(([groupName, group]) => {
      if (!Array.isArray(group)) return;
      const visible = group.filter((entry) => discovered.has(entry?.name));
      if (visible.length) visibleGroups[groupName] = visible;
    });
    if (Object.keys(visibleGroups).length) filtered[categoryName] = visibleGroups;
  });

  return filtered;
}
