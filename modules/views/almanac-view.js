export function buildAlmanacViewModel(entries) {
  const locations = entries?.locations || {};
  const organizations = entries?.organizations || {};
  const indigoSystemEntries = Array.isArray(locations?.["Indigo System"]) ? locations["Indigo System"] : [];
  const transferLaneEntries = Array.isArray(locations?.["Transfer Lanes"]) ? locations["Transfer Lanes"] : [];
  const moonEntries = Array.isArray(locations?.Moons) ? locations.Moons : [];
  const stationEntries = Array.isArray(locations?.["Stations, Outposts, and Facilities"])
    ? locations["Stations, Outposts, and Facilities"]
    : [];
  const organizationEntries = Array.isArray(organizations)
    ? organizations
    : [
        ...(Array.isArray(organizations?.["Factions and Institutions"]) ? organizations["Factions and Institutions"] : []),
        ...(Array.isArray(organizations?.Clients) ? organizations.Clients : []),
      ];

  const orbitBandsEntry = indigoSystemEntries.find((entry) => entry?.name === "Orbit Bands");
  const orbitBandChildren = indigoSystemEntries.filter((entry) => (
    ["Low Orbit", "Ring Orbit", "High Orbit", "Outer Orbit"].includes(entry?.name)
  ));
  const indigoSystemCoreEntries = indigoSystemEntries.filter((entry) => (
    !["Low Orbit", "Ring Orbit", "High Orbit", "Outer Orbit", "Orbit Bands"].includes(entry?.name)
  ));
  const orbitBandsGroup = [];
  if (orbitBandsEntry) orbitBandsGroup.push(orbitBandsEntry);
  orbitBandsGroup.push(...orbitBandChildren);

  return {
    "Indigo System": {
      Overview: indigoSystemCoreEntries,
      "Orbit Bands": orbitBandsGroup,
      Moons: moonEntries,
      "Stations, Outposts, and Facilities": stationEntries,
      "Transfer Lanes": transferLaneEntries,
    },
    Organizations: organizationEntries,
    "Ships and Classes": Array.isArray(entries?.ships_and_classes) ? entries.ships_and_classes : [],
    "Cargo Types": Array.isArray(entries?.cargo_types) ? entries.cargo_types : [],
  };
}

function addAlmanacItems(doc, parentNode, groupName, entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const containerNode = groupName ? doc.createElement("details") : parentNode;
  if (groupName) {
    containerNode.className = "almanac-group";

    const groupSummary = doc.createElement("summary");
    groupSummary.textContent = groupName;
    containerNode.appendChild(groupSummary);
  }

  entries.forEach((entry) => {
    const itemNode = doc.createElement("details");
    itemNode.className = "almanac-entry";

    const itemSummary = doc.createElement("summary");
    itemSummary.textContent = entry?.name || "Unnamed entry";
    itemNode.appendChild(itemSummary);

    const description = doc.createElement("p");
    description.className = "almanac-entry-description";
    description.textContent = entry?.description || "No description available.";
    itemNode.appendChild(description);
    containerNode.appendChild(itemNode);
  });

  if (groupName) parentNode.appendChild(containerNode);
}

export function renderAlmanacView({ root, entries, doc = document }) {
  if (!root) return;
  root.innerHTML = "";
  if (!entries || typeof entries !== "object") {
    const empty = doc.createElement("p");
    empty.textContent = "Almanac data unavailable.";
    root.appendChild(empty);
    return;
  }

  const normalizedEntries = buildAlmanacViewModel(entries);
  Object.entries(normalizedEntries).forEach(([categoryName, categoryPayload]) => {
    const categoryNode = doc.createElement("details");
    categoryNode.className = "almanac-category";

    const categorySummary = doc.createElement("summary");
    categorySummary.textContent = categoryName.replaceAll("_", " ");
    categoryNode.appendChild(categorySummary);

    if (Array.isArray(categoryPayload)) {
      addAlmanacItems(doc, categoryNode, null, categoryPayload);
    } else if (categoryPayload && typeof categoryPayload === "object") {
      Object.entries(categoryPayload).forEach(([groupName, groupEntries]) => {
        addAlmanacItems(doc, categoryNode, groupName, groupEntries);
      });
    }
    root.appendChild(categoryNode);
  });
}
