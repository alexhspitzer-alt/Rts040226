import assert from 'node:assert/strict';
import { parseCommandInput, parseConfirmationResponse } from '../modules/game-command-parser.js';
import { createSeededRandom } from '../modules/game-random.js';
import { createPerformanceMonitor, isPerformanceSamplingEnabledByUrl } from '../modules/game-performance.js';
import { createRouteCache } from '../modules/game-route-cache.js';
import { selectVisibleOpenContracts } from '../modules/game-selectors.js';
import { createSimulationTicker } from '../modules/game-ticks.js';
import { buildAlmanacViewModel } from '../modules/views/almanac-view.js';

const parsed = parseCommandInput('H Capt. Venn');
assert.equal(parsed.command, 'hail');
assert.equal(parseConfirmationResponse('yes'), 'yes');
assert.equal(parseConfirmationResponse('n'), 'no');

const seededA = createSeededRandom(123);
const seededB = createSeededRandom(123);
assert.equal(seededA.int(1, 100), seededB.int(1, 100));
assert.equal(seededA.pick(['a', 'b', 'c']), seededB.pick(['a', 'b', 'c']));

const visible = selectVisibleOpenContracts({
  ships: [{ id: 'a' }, { id: 'b', status: 'destroyed' }],
  contracts: [{ id: 'c1', status: 'open' }, { id: 'c2', status: 'open' }],
});
assert.deepEqual(visible.map((contract) => contract.id), ['c1']);

let graphVersion = 1;
let routeCalls = 0;
const cache = createRouteCache({ getVersion: () => graphVersion });
const nav = cache.wrapNavigationModel({
  routeDistance: () => { routeCalls += 1; return 4; },
  safeRouteDistance(from, to) { return Math.max(1, this.routeDistance(from, to)); },
  fuelBillingActive: () => false,
  fuelCostForRoute(from, to) { return this.safeRouteDistance(from, to) * 10; },
  oneWaySignalToNode(nodeId) { return this.safeRouteDistance('origin', nodeId); },
});
assert.equal(nav.fuelCostForRoute('a', 'b'), 40);
assert.equal(nav.fuelCostForRoute('a', 'b'), 40);
assert.equal(routeCalls, 1);
graphVersion += 1;
assert.equal(nav.routeDistance('a', 'b'), 4);
assert.equal(routeCalls, 2);

const tickCalls = [];
createSimulationTicker({
  tickDocks: () => tickCalls.push('docks'),
  tickShips: () => tickCalls.push('ships'),
  tickBankruptcy: () => tickCalls.push('bankruptcy'),
}).update();
assert.deepEqual(tickCalls, ['docks', 'ships', 'bankruptcy']);

let now = 0;
const perf = createPerformanceMonitor({ enabled: true, now: () => now });
perf.measure('unit', () => { now += 5; });
assert.equal(perf.report()[0].name, 'unit');
assert.equal(perf.report()[0].totalMs, 5);
assert.equal(isPerformanceSamplingEnabledByUrl({ pathname: '/ops/perf' }), true);
assert.equal(isPerformanceSamplingEnabledByUrl({ pathname: '/ops/play' }), false);

const almanac = buildAlmanacViewModel({
  locations: { 'Indigo System': [{ name: 'Orbit Bands' }, { name: 'Low Orbit' }] },
  organizations: [],
});
assert.equal(almanac['Indigo System']['Orbit Bands'].length, 2);
