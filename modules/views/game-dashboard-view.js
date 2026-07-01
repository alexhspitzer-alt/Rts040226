export function renderDashboardView({
  ui,
  state,
  visibleContracts,
  commandPromptLabel,
  formatTime,
  contractClientClass,
  contractNumber,
  nodeLabel,
  currentShipCargoCapacity,
  shipCapacityLabel,
  formatPlayerShipIdentity,
  playerShipDisplayId,
  doc = document,
}) {
  if (ui.cmdInput) ui.cmdInput.placeholder = commandPromptLabel();
  ui.clock.textContent = formatTime(state.tick);
  ui.cash.textContent = String(state.cash);
  ui.rep.textContent = String(state.rep);
  ui.risk.textContent = String(state.risk);
  ui.escort.textContent = state.escort ? "On" : "Off";

  ui.contracts.innerHTML = "";
  visibleContracts.forEach((contract, idx) => {
    const li = doc.createElement("li");
    li.className = contractClientClass(contract);
    const displayNumber = contractNumber(contract.id) || (idx + 1);
    const cargoRequirementLabel = state.currentScenario >= 3 && Number.isInteger(contract.cargoRequirement)
      ? ` | cargo ${contract.cargoRequirement}T`
      : "";
    const scenarioFlavor = state.currentScenario >= 2 && contract.client && contract.cargoType
      ? ` | ${contract.client} | ${contract.cargoType}${cargoRequirementLabel}`
      : "";
    li.textContent = `${displayNumber}. ${contract.id} ${nodeLabel(contract.from)} → ${nodeLabel(contract.to)}${scenarioFlavor} | +$${contract.payout}`;
    ui.contracts.appendChild(li);
  });
  if (!ui.contracts.children.length) {
    const li = doc.createElement("li");
    li.textContent = state.tutorialDone ? "Tutorial complete. No required contracts left." : "No open contracts.";
    ui.contracts.appendChild(li);
  }

  ui.fleet.innerHTML = "";
  state.ships.forEach((ship, idx) => {
    const li = doc.createElement("li");
    const capacityLabel = typeof shipCapacityLabel === "function"
      ? shipCapacityLabel(ship)
      : state.currentScenario >= 3 && !ship.utility
        ? ` | ${currentShipCargoCapacity(ship)}T cap`
        : "";
    const displayStatus = ship.status === "arrived_pending_report" ? "enroute" : ship.status;
    li.textContent = `${idx + 1}. ${formatPlayerShipIdentity(ship, displayStatus)} | id ${playerShipDisplayId(ship) || ship.id}${capacityLabel}`;
    ui.fleet.appendChild(li);
  });
}
