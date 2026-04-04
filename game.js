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

const state = {
  tick: 0,
  running: true,
  cash: 2200,
  rep: 58,
  risk: 22,
  escort: false,
  contracts: [],
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

  const distance = routeDistance(from, to);
  const urgency = Math.random() < 0.4 ? "priority" : "standard";
  const deadline = state.tick + distance + (urgency === "priority" ? 18 : 32);
  const payout = (urgency === "priority" ? 420 : 300) + Math.floor(Math.random() * 140);

  state.contracts.push({
    id: `C-${state.nextContract++}`,
    from,
    to,
    payout,
    deadline,
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
      const remaining = c.deadline - state.tick;
      li.textContent = `${c.id} ${nodes[c.from].label} → ${nodes[c.to].label} | +$${c.payout} | eta deadline ${remaining}s`;
      ui.contracts.appendChild(li);
    });
  if (!ui.contracts.children.length) {
    const li = document.createElement("li");
    li.textContent = "No open contracts.";
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
  if (riskRoll < effectiveRisk * 0.35) {
    scheduleMessage(distance, `${ship.id} reports detention at ${nodes[destination].label}. Cargo held for inspection.`, "alert");
    state.cash -= 90;
    state.rep -= 2;
  } else {
    scheduleMessage(distance, `${ship.id} confirms arrival at ${nodes[destination].label}. Route clear on approach.`, "report");
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
  scheduleMessage(total, `${ship.id} delivered ${contract.id} at ${nodes[contract.to].label}.`, "report");

  const late = state.tick + total > contract.deadline;
  if (late) {
    scheduleMessage(total, `${contract.id} delivered late. Underwriter applied penalties.`, "alert");
    state.cash += Math.floor(contract.payout * 0.45);
    state.rep -= 5;
    state.risk += 4;
  } else {
    const escortCost = state.escort ? 60 : 0;
    state.cash += contract.payout - escortCost;
    state.rep += 2;
    state.risk = Math.max(8, state.risk - 1);
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
    return logLine(`Cash $${state.cash} | Rep ${state.rep} | Risk ${state.risk} | Escort ${state.escort ? "on" : "off"}`, "sys");
  }

  if (parts[0] === "map") {
    const mapText = edges.map((e) => `${e[0]}<->${e[1]}:${e[2]}s`).join(" | ");
    return logLine(`Transit map ${mapText}`, "sys");
  }

  if (parts[0] === "ships") {
    return state.ships.forEach((s) => logLine(`${s.id} at ${s.at}, ${s.status}.`, "sys"));
  }

  if (parts[0] === "contracts") {
    return state.contracts.filter((c) => c.status === "open").forEach((c) => {
      logLine(`${c.id}: ${c.from} -> ${c.to}, $${c.payout}, due in ${c.deadline - state.tick}s.`, "sys");
    });
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

  state.contracts.forEach((contract) => {
    if (contract.status === "open" && state.tick > contract.deadline) {
      contract.status = "expired";
      state.cash -= 130;
      state.rep -= 4;
      state.risk += 2;
      logLine(`${contract.id} expired. Client switched to competitor coverage.`, "alert");
    }
  });

  if (state.tick % 14 === 0) generateContract();
  if (state.tick % 30 === 0) {
    state.risk += Math.random() < 0.5 ? 1 : -1;
    state.risk = Math.max(8, Math.min(70, state.risk));
  }
  if (state.tick % 25 === 0) state.cash += 40;

  if (state.cash <= -600 || state.rep <= 0) {
    logLine("bluFreight insolvency event. Simulation halted.", "alert");
    state.running = false;
  }

  if (state.tick >= 480 && state.running) {
    logLine("Shift complete. You maintained operations through 8 minutes of Indigo volatility.", "sys");
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
logLine("Dispatch system online. Type help.", "sys");
render();

setInterval(() => {
  if (!state.running) return;
  state.tick += 1;
  updateSimulation();
  render();
}, 1000);
