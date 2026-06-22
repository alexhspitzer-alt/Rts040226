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
  performanceMonitor = null,
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
    orderedTicks.forEach((tick) => {
      const run = () => tick();
      if (performanceMonitor?.measure) performanceMonitor.measure(`tick.${tick.name || "anonymous"}`, run);
      else run();
    });
  }

  return { update };
}
