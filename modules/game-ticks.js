export function createSimulationTicker({
  tickDocks,
  tickEconomy,
  tickNpcTraffic,
  tickFactionHeat,
  tickShips,
  tickDelayedMessages,
  tickContracts,
  tickRisk,
  tickAmbientComms,
  tickBankruptcy,
}) {
  const orderedTicks = [
    tickDocks,
    tickEconomy,
    tickNpcTraffic,
    tickFactionHeat,
    tickShips,
    tickDelayedMessages,
    tickContracts,
    tickRisk,
    tickAmbientComms,
    tickBankruptcy,
  ].filter((tick) => typeof tick === "function");

  function update() {
    orderedTicks.forEach((tick) => tick());
  }

  return { update };
}
