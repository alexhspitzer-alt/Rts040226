import assert from 'node:assert/strict';
import {
  CONSOLE_MESSAGE_IMPORTANCE,
  classifyConsoleMessage,
  consoleMessageThrottleWeight,
  createConsoleLogger,
  shouldThrottleConsoleMessage,
} from '../console.js';
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
assert.equal(isPerformanceSamplingEnabledByUrl({ pathname: '/ops/play', search: '?perf' }), true);
assert.equal(isPerformanceSamplingEnabledByUrl({ pathname: '/ops/play' }), false);

assert.equal(classifyConsoleMessage({ type: 'sys', respondingToCommand: true }), CONSOLE_MESSAGE_IMPORTANCE.PLAYER_TRIGGERED);
assert.equal(classifyConsoleMessage({ type: 'alert' }), CONSOLE_MESSAGE_IMPORTANCE.ENVIRONMENT_AFFECTING_PLAYER);
assert.equal(classifyConsoleMessage({ type: 'sys' }), CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_GAME_STATE);
assert.equal(classifyConsoleMessage({ type: 'comms-blister' }), CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_FLAVOR);
assert.equal(shouldThrottleConsoleMessage({ importance: CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_FLAVOR, recentCount: 8 }), true);
assert.equal(shouldThrottleConsoleMessage({ importance: CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_GAME_STATE, recentCount: 8 }), false);
assert.equal(shouldThrottleConsoleMessage({ importance: CONSOLE_MESSAGE_IMPORTANCE.AMBIENT_GAME_STATE, recentCount: 14 }), true);
assert.equal(shouldThrottleConsoleMessage({ importance: CONSOLE_MESSAGE_IMPORTANCE.ENVIRONMENT_AFFECTING_PLAYER, recentCount: 22 }), false);
assert.equal(consoleMessageThrottleWeight({ type: 'sys', respondingToCommand: true }), 0.5);
assert.equal(consoleMessageThrottleWeight({ type: 'cmd', respondingToCommand: true }), 1);
assert.equal(consoleMessageThrottleWeight({ type: 'comms' }), 1);

const originalSetTimeout = globalThis.setTimeout;
const originalDateNow = Date.now;
try {
  const scheduledDelays = [];
  globalThis.setTimeout = (callback, delay) => {
    scheduledDelays.push(delay);
    return scheduledDelays.length;
  };
  Date.now = () => 0;
  const loggerState = { tick: 0, respondingToCommand: true, consoleReadyAtMs: 0 };
  const logger = createConsoleLogger({
    state: loggerState,
    ui: {
      feed: { addEventListener() {}, scrollTop: 0, clientHeight: 0, scrollHeight: 0, appendChild() {} },
      consoleFollowToggle: null,
    },
    fmtTime: () => '00:00',
    stylizeConsoleText: (text) => text,
    messageGapMs: 300,
    dotsDelayMs: 100,
    revealDelayMs: 500,
    responseBatchRevealMs: 1000,
  });
  logger.logLine('first', 'sys');
  logger.logLine('second', 'sys');
  await Promise.resolve();
  assert.deepEqual(scheduledDelays, [100, 500, 100, 1500]);
} finally {
  globalThis.setTimeout = originalSetTimeout;
  Date.now = originalDateNow;
}

const almanac = buildAlmanacViewModel({
  locations: { 'Indigo System': [{ name: 'Orbit Bands' }, { name: 'Low Orbit' }] },
  organizations: [],
});
assert.equal(almanac['Indigo System']['Orbit Bands'].length, 2);
