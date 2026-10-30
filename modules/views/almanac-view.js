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

function addUnreadMarker(doc, summaryNode, text = "new") {
  const marker = doc.createElement("span");
  marker.className = "new-item-marker";
  marker.textContent = text;
  summaryNode.appendChild(marker);
}

function refreshUnreadContainer(containerNode) {
  if (!containerNode) return;
  const unreadCount = containerNode.querySelectorAll(".almanac-entry.is-unread").length;
  const summaryNode = containerNode.querySelector(":scope > summary");
  const marker = summaryNode?.querySelector(".new-item-marker");
  containerNode.classList.toggle("has-unread", unreadCount > 0);
  if (unreadCount > 0 && marker) marker.textContent = `${unreadCount} new`;
  if (unreadCount === 0) marker?.remove();
}

function addAlmanacItems(doc, parentNode, groupName, entries, { unreadEntries, onEntryOpened }) {
  if (!Array.isArray(entries) || !entries.length) return;
  const unreadCount = entries.filter((entry) => unreadEntries.has(entry?.name)).length;
  const containerNode = groupName ? doc.createElement("details") : parentNode;
  if (groupName) {
    containerNode.className = "almanac-group";
    if (unreadCount) {
      containerNode.classList.add("has-unread");
      containerNode.open = true;
    }

    const groupSummary = doc.createElement("summary");
    groupSummary.textContent = groupName;
    if (unreadCount) addUnreadMarker(doc, groupSummary, `${unreadCount} new`);
    containerNode.appendChild(groupSummary);
  }

  entries.forEach((entry) => {
    const entryName = entry?.name || "Unnamed entry";
    const isUnread = unreadEntries.has(entryName);
    const itemNode = doc.createElement("details");
    itemNode.className = "almanac-entry";
    if (isUnread) itemNode.classList.add("is-unread");

    const itemSummary = doc.createElement("summary");
    itemSummary.textContent = entryName;
    if (isUnread) addUnreadMarker(doc, itemSummary);
    itemNode.appendChild(itemSummary);

    if (isUnread) {
      itemNode.addEventListener("toggle", () => {
        if (!itemNode.open || !itemNode.classList.contains("is-unread")) return;
        itemNode.classList.remove("is-unread");
        itemSummary.querySelector(".new-item-marker")?.remove();
        refreshUnreadContainer(itemNode.closest(".almanac-group"));
        refreshUnreadContainer(itemNode.closest(".almanac-category"));
        onEntryOpened?.(entryName);
      });
    }

    const description = doc.createElement("p");
    description.className = "almanac-entry-description";
    description.textContent = entry?.description || "No description available.";
    itemNode.appendChild(description);
    containerNode.appendChild(itemNode);
  });

  if (groupName) parentNode.appendChild(containerNode);
}

export function renderAlmanacView({ root, entries, unreadEntryNames = [], onEntryOpened, doc = document }) {
  if (!root) return;
  root.innerHTML = "";
  if (!entries || typeof entries !== "object") {
    const empty = doc.createElement("p");
    empty.textContent = "Handbook data unavailable.";
    root.appendChild(empty);
    return;
  }

  const normalizedEntries = buildAlmanacViewModel(entries);
  const unreadEntries = new Set(unreadEntryNames);
  let renderedCategoryCount = 0;
  Object.entries(normalizedEntries).forEach(([categoryName, categoryPayload]) => {
    const hasEntries = Array.isArray(categoryPayload)
      ? categoryPayload.length > 0
      : Object.values(categoryPayload || {}).some((groupEntries) => Array.isArray(groupEntries) && groupEntries.length > 0);
    if (!hasEntries) return;
    const categoryNode = doc.createElement("details");
    categoryNode.className = "almanac-category";
    const categoryEntries = Array.isArray(categoryPayload)
      ? categoryPayload
      : Object.values(categoryPayload || {}).flatMap((groupEntries) => Array.isArray(groupEntries) ? groupEntries : []);
    const categoryUnreadCount = categoryEntries.filter((entry) => unreadEntries.has(entry?.name)).length;
    if (categoryUnreadCount) {
      categoryNode.classList.add("has-unread");
      categoryNode.open = true;
    }

    const categorySummary = doc.createElement("summary");
    categorySummary.textContent = categoryName.replaceAll("_", " ");
    if (categoryUnreadCount) addUnreadMarker(doc, categorySummary, `${categoryUnreadCount} new`);
    categoryNode.appendChild(categorySummary);

    if (Array.isArray(categoryPayload)) {
      addAlmanacItems(doc, categoryNode, null, categoryPayload, { unreadEntries, onEntryOpened });
    } else if (categoryPayload && typeof categoryPayload === "object") {
      Object.entries(categoryPayload).forEach(([groupName, groupEntries]) => {
        addAlmanacItems(doc, categoryNode, groupName, groupEntries, { unreadEntries, onEntryOpened });
      });
    }
    root.appendChild(categoryNode);
    renderedCategoryCount += 1;
  });
  if (!renderedCategoryCount) {
    const empty = doc.createElement("p");
    empty.textContent = "Entries appear here as you encounter them.";
    root.appendChild(empty);
  }
}
