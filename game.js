const nodes = {
  anchor: { label: "Anchor Station" },
  cinder_hub: { label: "Cinder Hub" },
  mirrorgate: { label: "Mirrorgate Relay" },
  ninth_moon: { label: "Ninth Moon" },
  frostline: { label: "Frostline Port" },
  driftbay: { label: "Driftbay Depot" },
};

const edges = [
  ["anchor", "cinder_hub", 6],
  ["anchor", "mirrorgate", 10],
  ["cinder_hub", "ninth_moon", 8],
  ["mirrorgate", "frostline", 7],
  ["ninth_moon", "driftbay", 6],
];

const TUTORIAL_GOAL = 3;

const state = {
  tick: 0,
  running: true,
  cash: 2200,
  rep: 58,
  risk: 22,
  escort: false,
  contracts: [],
  completedContracts: 0,
  tutorialDone: false,
  ships: [
    { id: "hauler-1", at: "anchor", status: "idle", busyUntil: 0 },
    { id: "hauler-2", at: "cinder_hub", status: "idle", busyUntil: 0 },
    { id: "courier-1", at: "anchor", status: "idle", busyUntil: 0 },
  ],
  delayedMessages: [],
  nextContract: 1,
  selection: {
    selectedShipId: null,
    pending: null,
  },
};

const ui = {
  clock: document.getElementById("clock"),
  cash: document.getElementById("cash"),
  rep: document.getElementById("rep"),
  risk: document.getElementById("risk"),
  escort: document.getElementById("escort"),
  contracts: document.getElementById("contracts"),
  fleet: document.getElementById("fleet"),
  feed: document.getElementById("feed"),
  cmdForm: document.getElementById("cmd-form"),
  cmdInput: document.getElementById("cmd"),
};

const adjacency = buildGraph();

function buildGraph() {
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

function fmtTime(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function logLine(text, type = "sys") {
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = `[${fmtTime(state.tick)}][${type.toUpperCase()}] ${text}`;
  ui.feed.appendChild(div);
  ui.feed.scrollTop = ui.feed.scrollHeight;
}

function routeDistance(from, to, visited = new Set()) {
  if (from === to) return 0;
  visited.add(from);
  const choices = adjacency[from]
    .filter((n) => !visited.has(n.to))
    .map((n) => {
      const sub = routeDistance(n.to, to, new Set(visited));
      return sub === Infinity ? Infinity : n.cost + sub;
    });
  return choices.length ? Math.min(...choices) : Infinity;
}

function scheduleMessage(delay, text, type = "report") {
  state.delayedMessages.push({ at: state.tick + delay, text, type });
}

function generateContract() {
  const origins = Object.keys(nodes);
  const from = origins[Math.floor(Math.random() * origins.length)];
  let to = from;
  while (to === from) to = origins[Math.floor(Math.random() * origins.length)];

  state.contracts.push({
    id: `C-${state.nextContract++}`,
    from,
    to,
    payout: 300 + Math.floor(Math.random() * 160),
    status: "open",
  });
}

function openContracts() {
  return state.contracts.filter((c) => c.status === "open");
}

function idleShip(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  return ship && ship.status === "idle";
}

function render() {
  ui.clock.textContent = fmtTime(state.tick);
  ui.cash.textContent = String(state.cash);
  ui.rep.textContent = String(state.rep);
  ui.risk.textContent = String(state.risk);
  ui.escort.textContent = state.escort ? "On" : "Off";

  ui.contracts.innerHTML = "";
  openContracts().slice(0, 7).forEach((c, idx) => {
    const li = document.createElement("li");
    li.textContent = `${idx + 1}. ${c.id} ${nodes[c.from].label} → ${nodes[c.to].label} | +$${c.payout}`;
    ui.contracts.appendChild(li);
  });
  if (!ui.contracts.children.length) {
    const li = document.createElement("li");
    li.textContent = state.tutorialDone ? "Tutorial complete. No required contracts left." : "No open contracts.";
    ui.contracts.appendChild(li);
  }

  ui.fleet.innerHTML = "";
  state.ships.forEach((s, idx) => {
    const li = document.createElement("li");
    li.textContent = `${idx + 1}. ${s.id} @ ${nodes[s.at].label} | ${s.status}`;
    ui.fleet.appendChild(li);
  });
}

function showShipsList() {
  state.ships.forEach((s, idx) => {
    logLine(`${idx + 1}. ${s.id} (${s.status}) @ ${s.at}`, "sys");
  });
  logLine("Choose ship by number, or type: select <ship-id>", "sys");
}

function showShipMenu(shipId) {
  logLine(`${shipId} selected. A. Assign contract  S. Send to destination  R. Report  B. Back`, "sys");
}

function showContractsForSelectedShip() {
  const contracts = openContracts();
  if (!contracts.length) return logLine("No open contracts to assign.", "sys");
  logLine(`Assign ${state.selection.selectedShipId} to what contract?`, "sys");
  contracts.forEach((c, idx) => logLine(`${idx + 1}. ${c.id} ${c.from} -> ${c.to} (+$${c.payout})`, "sys"));
  logLine("Pick a number or type contract ID.", "sys");
}

function showDestinationsForSelectedShip() {
  logLine(`Send ${state.selection.selectedShipId} to what destination?`, "sys");
  Object.keys(nodes).forEach((nodeId, idx) => {
    logLine(`${idx + 1}. ${nodeId} (${nodes[nodeId].label})`, "sys");
  });
  logLine("Pick a number or type destination ID.", "sys");
}

function shipReport(shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine("Selected ship is unavailable.", "error");
  const eta = ship.status === "enroute" ? Math.max(0, ship.busyUntil - state.tick) : 0;
  logLine(`Report ${ship.id}: status=${ship.status}, location=${ship.at}, eta=${eta}s.`, "report");
}

function scheduleTransitComms(ship, destination, distance) {
  const midpoint = Math.max(1, Math.floor(distance / 2));
  scheduleMessage(midpoint, `${ship.id} update: passing relay corridor toward ${nodes[destination].label}.`, "report");
  scheduleMessage(distance, `${ship.id} final: arrived at ${nodes[destination].label}. Awaiting dispatch.`, "report");
}

function sendShip(shipId, destination) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  if (!nodes[destination]) return logLine(`Unknown destination: ${destination}.`, "error");
  if (ship.status !== "idle") return logLine(`${ship.id} is busy.`, "error");

  const distance = routeDistance(ship.at, destination);
  ship.status = "enroute";
  ship.busyUntil = state.tick + distance;
  ship.destination = destination;

  const effectiveRisk = state.risk + (state.escort ? -10 : 8);
  if (Math.random() * 100 < effectiveRisk * 0.3) {
    scheduleMessage(distance, `${ship.id} detained briefly at ${nodes[destination].label}. Cargo released after inspection.`, "alert");
    state.cash -= 70;
    state.rep -= 1;
  } else {
    scheduleTransitComms(ship, destination, distance);
    state.rep = Math.min(100, state.rep + 1);
  }

  logLine(`Order accepted: ${ship.id} -> ${destination} (${distance}s).`, "dispatch");
}

function assignContract(contractId, shipId) {
  const contract = state.contracts.find((c) => c.id.toLowerCase() === contractId.toLowerCase() && c.status === "open");
  if (!contract) return logLine(`Contract ${contractId} not found/open.`, "error");
  if (!idleShip(shipId)) return logLine(`${shipId} is not idle.`, "error");

  const ship = state.ships.find((s) => s.id === shipId);
  const toPickup = routeDistance(ship.at, contract.from);
  const toDrop = routeDistance(contract.from, contract.to);
  const total = toPickup + toDrop;

  ship.status = "enroute";
  ship.busyUntil = state.tick + total;
  ship.destination = contract.to;
  contract.status = "assigned";

  logLine(`Assigned ${ship.id} to ${contract.id}. Pickup ${toPickup}s + delivery ${toDrop}s.`, "dispatch");
  scheduleMessage(Math.max(1, Math.floor(total / 2)), `${ship.id} mid-route check-in for ${contract.id}: cargo stable.`, "report");
  scheduleMessage(total, `${ship.id} delivered ${contract.id} at ${nodes[contract.to].label}.`, "report");

  state.cash += contract.payout - (state.escort ? 60 : 0);
  state.rep = Math.min(100, state.rep + 2);
  state.risk = Math.max(8, state.risk - 1);
  state.completedContracts += 1;

  if (!state.tutorialDone && state.completedContracts >= TUTORIAL_GOAL) {
    state.tutorialDone = true;
    logLine("Tutorial complete: 3 contracts delivered.", "sys");
  }
}

function tryNumericSelection(numericInput) {
  const n = Number(numericInput);
  if (!Number.isInteger(n) || n < 1) return false;

  if (state.selection.pending === "await_ship") {
    const ship = state.ships[n - 1];
    if (!ship) return logLine("Invalid ship number.", "error");
    state.selection.selectedShipId = ship.id;
    state.selection.pending = "ship_menu";
    return showShipMenu(ship.id);
  }

  if (state.selection.pending === "await_contract") {
    const contract = openContracts()[n - 1];
    if (!contract) return logLine("Invalid contract number.", "error");
    assignContract(contract.id, state.selection.selectedShipId);
    state.selection.pending = "ship_menu";
    return showShipMenu(state.selection.selectedShipId);
  }

  if (state.selection.pending === "await_destination") {
    const nodeId = Object.keys(nodes)[n - 1];
    if (!nodeId) return logLine("Invalid destination number.", "error");
    sendShip(state.selection.selectedShipId, nodeId);
    state.selection.pending = "ship_menu";
    return showShipMenu(state.selection.selectedShipId);
  }

  return false;
}

function handleShipMenuLetter(letter) {
  const shipId = state.selection.selectedShipId;
  if (!shipId) return false;

  if (letter === "a") {
    state.selection.pending = "await_contract";
    showContractsForSelectedShip();
    return true;
  }
  if (letter === "s") {
    state.selection.pending = "await_destination";
    showDestinationsForSelectedShip();
    return true;
  }
  if (letter === "r") {
    shipReport(shipId);
    showShipMenu(shipId);
    return true;
  }
  if (letter === "b") {
    state.selection.selectedShipId = null;
    state.selection.pending = "await_ship";
    showShipsList();
    return true;
  }

  return false;
}

function handleLongForm(parts) {
  if (parts[0] === "help") {
    logLine("Commands: help, status, map, ships, select <ship>, assign <contract> <ship>, send <ship> <destination>, escort on/off, pause", "sys");
    return true;
  }

  if (parts[0] === "status") {
    logLine(`Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Tutorial ${state.completedContracts}/${TUTORIAL_GOAL}`, "sys");
    return true;
  }

  if (parts[0] === "map") {
    logLine(edges.map((e) => `${e[0]}<->${e[1]}:${e[2]}s`).join(" | "), "sys");
    return true;
  }

  if (parts[0] === "ships") {
    state.selection.pending = "await_ship";
    showShipsList();
    return true;
  }

  if (parts[0] === "select" && parts[1]) {
    const shipId = parts[1];
    const ship = state.ships.find((s) => s.id === shipId);
    if (!ship) logLine(`Unknown ship ${shipId}.`, "error");
    else {
      state.selection.selectedShipId = shipId;
      state.selection.pending = "ship_menu";
      showShipMenu(shipId);
    }
    return true;
  }

  if (parts[0] === "contracts") {
    openContracts().forEach((c, idx) => logLine(`${idx + 1}. ${c.id} ${c.from} -> ${c.to}, $${c.payout}`, "sys"));
    return true;
  }

  if (parts[0] === "assign" && parts.length >= 3) {
    assignContract(parts[1], parts[2]);
    return true;
  }

  if (parts[0] === "send" && parts.length >= 3) {
    sendShip(parts[1], parts[2]);
    return true;
  }

  if (parts[0] === "escort" && parts[1] === "on") {
    state.escort = true;
    logLine("Escort posture enabled.", "sys");
    return true;
  }

  if (parts[0] === "escort" && parts[1] === "off") {
    state.escort = false;
    logLine("Escort posture disabled.", "sys");
    return true;
  }

  if (parts[0] === "pause") {
    state.running = !state.running;
    logLine(state.running ? "Simulation resumed." : "Simulation paused.", "sys");
    return true;
  }

  return false;
}

function handleCommand(raw) {
  const input = raw.trim();
  if (!input) return;

  logLine(`> ${raw}`, "cmd");
  const lower = input.toLowerCase();
  const parts = lower.split(/\s+/);

  if (tryNumericSelection(lower) !== false) return;

  if (state.selection.pending === "ship_menu" && lower.length === 1 && handleShipMenuLetter(lower)) return;

  if (state.selection.pending === "await_contract") {
    const contract = openContracts().find((c) => c.id.toLowerCase() === lower);
    if (contract) {
      assignContract(contract.id, state.selection.selectedShipId);
      state.selection.pending = "ship_menu";
      return showShipMenu(state.selection.selectedShipId);
    }
  }

  if (state.selection.pending === "await_destination") {
    if (nodes[lower]) {
      sendShip(state.selection.selectedShipId, lower);
      state.selection.pending = "ship_menu";
      return showShipMenu(state.selection.selectedShipId);
    }
  }

  if (!handleLongForm(parts)) logLine("Command not recognized. Try: help or ships", "error");
}

function updateSimulation() {
  state.ships.forEach((ship) => {
    if (ship.status === "enroute" && state.tick >= ship.busyUntil) {
      ship.at = ship.destination;
      ship.destination = undefined;
      ship.status = "idle";
    }
  });

  const due = state.delayedMessages.filter((m) => m.at <= state.tick);
  due.forEach((m) => logLine(m.text, m.type));
  state.delayedMessages = state.delayedMessages.filter((m) => m.at > state.tick);

  if (!state.tutorialDone && openContracts().length < 4 && state.tick % 10 === 0) generateContract();

  if (state.tick % 30 === 0) {
    state.risk += Math.random() < 0.5 ? 1 : -1;
    state.risk = Math.max(8, Math.min(70, state.risk));
  }

  if (state.cash <= -600 || state.rep <= 0) {
    logLine("bluFreight insolvency event. Simulation halted.", "alert");
    state.running = false;
  }
}

ui.cmdForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(ui.cmdInput.value);
  ui.cmdInput.value = "";
  render();
});

generateContract();
generateContract();
state.selection.pending = "await_ship";
logLine("Tutorial mode online. Type ships, then choose by number.", "sys");
showShipsList();
render();

setInterval(() => {
  if (!state.running) return;
  state.tick += 1;
  updateSimulation();
  render();
}, 1000);
