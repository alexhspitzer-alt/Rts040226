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
  if (choices.length === 0) return Infinity;
  return Math.min(...choices);
}

function scheduleMessage(delay, text, type = "report") {
  state.delayedMessages.push({ at: state.tick + delay, text, type });
}

function generateContract() {
  const origins = Object.keys(nodes);
  const from = origins[Math.floor(Math.random() * origins.length)];
  let to = from;
  while (to === from) {
    to = origins[Math.floor(Math.random() * origins.length)];
  }

  const payout = 300 + Math.floor(Math.random() * 160);

  state.contracts.push({
    id: `C-${state.nextContract++}`,
    from,
    to,
    payout,
    status: "open",
  });
}

function render() {
  ui.clock.textContent = fmtTime(state.tick);
  ui.cash.textContent = String(state.cash);
  ui.rep.textContent = String(state.rep);
  ui.risk.textContent = String(state.risk);
  ui.escort.textContent = state.escort ? "On" : "Off";

  ui.contracts.innerHTML = "";
  state.contracts
    .filter((c) => c.status === "open")
    .slice(0, 7)
    .forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.id} ${nodes[c.from].label} → ${nodes[c.to].label} | +$${c.payout} | no deadline (tutorial mode)`;
      ui.contracts.appendChild(li);
    });

  if (!ui.contracts.children.length) {
    const li = document.createElement("li");
    li.textContent = state.tutorialDone ? "Tutorial complete. No more required contracts." : "No open contracts.";
    ui.contracts.appendChild(li);
  }

  ui.fleet.innerHTML = "";
  state.ships.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s.id} @ ${nodes[s.at].label} | ${s.status}${s.status === "enroute" ? ` (${Math.max(0, s.busyUntil - state.tick)}s)` : ""}`;
    ui.fleet.appendChild(li);
  });
}

function getShip(shipId) {
  return state.ships.find((s) => s.id === shipId);
}

function scheduleTransitComms(ship, destination, distance) {
  const midpoint = Math.max(1, Math.floor(distance / 2));
  scheduleMessage(
    midpoint,
    `${ship.id} update: passing relay corridor en route to ${nodes[destination].label}. Signal clarity moderate, no confirmed hostile contacts yet.`,
    "report",
  );
  scheduleMessage(
    distance,
    `${ship.id} final: arrived at ${nodes[destination].label}. Docking complete, awaiting further dispatch orders from Indigo Operations.`,
    "report",
  );
}

function sendShip(shipId, destination) {
  const ship = getShip(shipId);
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  if (!nodes[destination]) return logLine(`Unknown destination: ${destination}. Use map.`, "error");
  if (ship.status !== "idle") return logLine(`${ship.id} is busy.`, "error");

  const distance = routeDistance(ship.at, destination);
  if (!Number.isFinite(distance)) return logLine(`No route from ${ship.at} to ${destination}.`, "error");

  ship.status = "enroute";
  ship.busyUntil = state.tick + distance;
  ship.destination = destination;

  const riskRoll = Math.random() * 100;
  const effectiveRisk = state.risk + (state.escort ? -10 : 8);

  if (riskRoll < effectiveRisk * 0.3) {
    scheduleMessage(
      distance,
      `${ship.id} reports temporary detention at ${nodes[destination].label}. Manifest under inspection by local authorities. Expect delay, not destruction.`,
      "alert",
    );
    state.cash -= 70;
    state.rep -= 1;
  } else {
    scheduleTransitComms(ship, destination, distance);
    state.rep = Math.min(100, state.rep + 1);
  }

  logLine(`Order accepted: ${ship.id} -> ${destination} (${distance}s signal/travel delay).`, "dispatch");
}

function assignContract(contractId, shipId) {
  const contract = state.contracts.find((c) => c.id.toLowerCase() === contractId.toLowerCase() && c.status === "open");
  if (!contract) return logLine(`Contract ${contractId} not found/open.`, "error");

  const ship = getShip(shipId);
  if (!ship) return logLine(`Unknown ship: ${shipId}.`, "error");
  if (ship.status !== "idle") return logLine(`${ship.id} is not idle.`, "error");

  const toPickup = routeDistance(ship.at, contract.from);
  const toDrop = routeDistance(contract.from, contract.to);
  const total = toPickup + toDrop;

  ship.status = "enroute";
  ship.busyUntil = state.tick + total;
  ship.destination = contract.to;
  contract.status = "assigned";

  logLine(`Assigned ${ship.id} to ${contract.id}. Pickup ${toPickup}s + delivery ${toDrop}s.`, "dispatch");

  scheduleMessage(
    Math.max(1, Math.floor(total / 2)),
    `${ship.id} mid-route check-in for ${contract.id}: cargo secure, engine temperatures nominal, continuing toward ${nodes[contract.to].label}.`,
    "report",
  );
  scheduleMessage(total, `${ship.id} delivered ${contract.id} at ${nodes[contract.to].label}.`, "report");

  const escortCost = state.escort ? 60 : 0;
  state.cash += contract.payout - escortCost;
  state.rep = Math.min(100, state.rep + 2);
  state.risk = Math.max(8, state.risk - 1);
  state.completedContracts += 1;

  if (!state.tutorialDone && state.completedContracts >= TUTORIAL_GOAL) {
    state.tutorialDone = true;
    logLine("Tutorial complete: 3 contracts delivered. Freeplay comms remain active with no level time limit.", "sys");
  }
}

function handleCommand(raw) {
  const input = raw.trim().toLowerCase();
  if (!input) return;

  logLine(`> ${raw}`, "cmd");
  const parts = input.split(/\s+/);

  if (parts[0] === "help") {
    return logLine("Commands: help | status | map | ships | contracts | assign <contract> <ship> | send <ship> <node> | escort on/off | pause", "sys");
  }

  if (parts[0] === "status") {
    return logLine(
      `Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Escort ${state.escort ? "on" : "off"} | Tutorial ${state.completedContracts}/${TUTORIAL_GOAL}`,
      "sys",
    );
  }

  if (parts[0] === "map") {
    const mapText = edges.map((e) => `${e[0]}<->${e[1]}:${e[2]}s`).join(" | ");
    return logLine(`Transit map ${mapText}`, "sys");
  }

  if (parts[0] === "ships") {
    return state.ships.forEach((s) => logLine(`${s.id} at ${s.at}, ${s.status}.`, "sys"));
  }

  if (parts[0] === "contracts") {
    return state.contracts
      .filter((c) => c.status === "open")
      .forEach((c) => logLine(`${c.id}: ${c.from} -> ${c.to}, $${c.payout}, tutorial contract has no deadline.`, "sys"));
  }

  if (parts[0] === "assign" && parts.length >= 3) {
    return assignContract(parts[1], parts[2]);
  }

  if (parts[0] === "send" && parts.length >= 3) {
    return sendShip(parts[1], parts[2]);
  }

  if (parts[0] === "escort" && parts[1] === "on") {
    state.escort = true;
    return logLine("Escort posture enabled. Lower interception chance, higher operating cost.", "sys");
  }

  if (parts[0] === "escort" && parts[1] === "off") {
    state.escort = false;
    return logLine("Escort posture disabled. Cheaper operations, higher interception chance.", "sys");
  }

  if (parts[0] === "pause") {
    state.running = !state.running;
    return logLine(state.running ? "Simulation resumed." : "Simulation paused.", "sys");
  }

  logLine("Command not recognized. Type help.", "error");
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

  if (!state.tutorialDone && state.contracts.filter((c) => c.status === "open").length < 4 && state.tick % 10 === 0) {
    generateContract();
  }

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
logLine("Tutorial mode online. No contract deadlines. Complete 3 contracts to finish tutorial.", "sys");
logLine("Type help for commands.", "sys");
render();

setInterval(() => {
  if (!state.running) return;
  state.tick += 1;
  updateSimulation();
  render();
}, 1000);
