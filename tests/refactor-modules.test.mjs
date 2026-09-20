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
import {
  collectHandbookEncounterText,
  collectHandbookLocationDiscovery,
  discoverHandbookEntries,
  filterHandbookEntries,
} from '../modules/handbook-discovery.js';

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

const handbookEntries = {
  locations: {
    'Indigo System': [
      { name: 'Indigo' },
      { name: 'Orbit Bands' },
      { name: 'High Orbit' },
      { name: 'Outer Orbit' },
      { name: 'Approach Variability' },
    ],
    Moons: [{ name: "Cat's Eye" }, { name: 'End-of-Day' }],
    'Stations, Outposts, and Facilities': [
      { name: 'Anchor Station' },
      { name: 'UFP Science Station' },
      { name: "Baron's Market" },
    ],
  },
  organizations: [{ name: 'Union of Free Planets' }],
  ships_and_classes: [{ name: 'Hauler' }, { name: 'Tug' }],
  cargo_types: [{ name: 'Deuterium' }],
};
const handbookMapData = {
  layer0: {
    moons: {
      cats_eye: { name: "Cat's Eye", orbit: 'high' },
      end_of_day: { name: 'End-of-Day', orbit: 'outer' },
      peltier: { name: 'Peltier', orbit: 'high' },
    },
  },
  layer2: {
    scenario2: {
      activeMoons: {
        peltier: {
          name: 'Peltier',
          locations: { barons_market: { name: "Baron's Market" } },
        },
      },
    },
  },
};
const encounterText = collectHandbookEncounterText({
  state: {
    ships: [{
      id: 'hauler-1',
      at: 'ufp_science_station',
      lastKnownAt: 'anchor_station',
      destination: 'ufp_science_station',
    }],
    contracts: [{ from: 'anchor_station', to: 'ufp_science_station' }],
    inbox: [{ body: "UFP traffic control confirms UFP Science Station and Baron's Market are visible; approach value remains uncertain." }],
    news: [],
    mapData: handbookMapData,
  },
  nodes: {
    anchor_station: { label: 'Anchor Station', moon: 'cats_eye', moonName: "Cat's Eye" },
    ufp_science_station: { label: 'UFP Science Station', moon: 'end_of_day', moonName: 'End-of-Day' },
  },
  nodeLabel: (nodeId) => nodeId === 'anchor_station' ? "Anchor Station (Cat's Eye)" : 'UFP Science Station (End-of-Day)',
});
const locationState = {
  ships: [{
    id: 'hauler-1',
    at: 'ufp_science_station',
    lastKnownAt: 'anchor_station',
    destination: 'ufp_science_station',
  }],
  mapData: handbookMapData,
};
const handbookNodes = {
  anchor_station: { label: 'Anchor Station', moon: 'cats_eye', moonName: "Cat's Eye" },
  ufp_science_station: { label: 'UFP Science Station', moon: 'end_of_day', moonName: 'End-of-Day' },
};
const locationDiscovery = collectHandbookLocationDiscovery({ state: locationState, nodes: handbookNodes });
const discoveredHandbook = discoverHandbookEntries(handbookEntries, [], encounterText, locationDiscovery);
assert.deepEqual(discoveredHandbook, [
  'Anchor Station',
  'Approach Variability',
  "Cat's Eye",
  'Hauler',
  'High Orbit',
  'Indigo',
  'Orbit Bands',
  'Union of Free Planets',
]);
assert.equal(discoveredHandbook.includes('UFP Science Station'), false);
assert.equal(discoveredHandbook.includes("Baron's Market"), false);
assert.equal(discoveredHandbook.includes('End-of-Day'), false);
assert.equal(discoveredHandbook.includes('Outer Orbit'), false);

locationState.ships[0].lastKnownAt = 'ufp_science_station';
const confirmedArrivalDiscovery = collectHandbookLocationDiscovery({ state: locationState, nodes: handbookNodes });
const afterArrivalReport = discoverHandbookEntries(
  handbookEntries,
  discoveredHandbook,
  encounterText,
  confirmedArrivalDiscovery,
);
assert.equal(afterArrivalReport.includes('UFP Science Station'), true);
assert.equal(afterArrivalReport.includes('End-of-Day'), true);
assert.equal(afterArrivalReport.includes('Outer Orbit'), true);
const retainedHandbook = discoverHandbookEntries(handbookEntries, discoveredHandbook, []);
assert.deepEqual(retainedHandbook, discoveredHandbook);
const filteredHandbook = filterHandbookEntries(handbookEntries, retainedHandbook);
assert.deepEqual(filteredHandbook.ships_and_classes.map((entry) => entry.name), ['Hauler']);
assert.equal(filteredHandbook.locations['Stations, Outposts, and Facilities'][0].name, 'Anchor Station');
assert.equal(filteredHandbook.cargo_types, undefined);
