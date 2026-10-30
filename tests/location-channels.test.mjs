import assert from 'node:assert/strict';
import {
  DISPATCH_CHANNEL,
  occupiedChannelPositions,
  resolveMessageChannelKeys,
  sensorChannelKeys,
  shipChannelPosition,
} from '../modules/game-channels.js';
import { createLocationTerminals, shipSensorConfiguration } from '../modules/views/location-terminals-view.js';

assert.equal(shipSensorConfiguration({}), 'Default suite');
assert.equal(shipSensorConfiguration({sensorMode:'instruments'}), 'Instrument array');
assert.equal(shipSensorConfiguration({sensorMode:'comms'}), 'Comms array');
assert.equal(shipSensorConfiguration({sensorsMuted:true, sensorMode:'instruments'}), 'Mute · Instrument array');

const ship = (id, at, extra = {}) => ({ id, at, status: 'idle', ...extra });
const state = { tick: 0, ships: [ship('one', 'anchor_station'), ship('two', 'refinery'), ship('three', 'refinery')] };
assert.equal(occupiedChannelPositions(state).size, 2, 'one terminal per occupied location');
assert.equal(occupiedChannelPositions(state).get('refinery').ships.length, 2);
assert.equal(occupiedChannelPositions({ ships: [] }).has(DISPATCH_CHANNEL), true, 'dispatch never closes');
assert.deepEqual(resolveMessageChannelKeys(state, { shipId: 'two' }), ['refinery']);
assert.deepEqual(resolveMessageChannelKeys(state, { nodeId: 'unoccupied' }), [], 'no remote omniscience');
assert.deepEqual(resolveMessageChannelKeys(state, { dispatch: true, nodeId: 'refinery' }), [DISPATCH_CHANNEL]);
assert.deepEqual(sensorChannelKeys(state, 'refinery'), ['refinery'], 'shared sensors do not duplicate chatter');
assert.deepEqual(sensorChannelKeys({ships:[state.ships[1]]}, 'refinery', 'two'), [], 'approach chatter requires a different listening ship');
state.ships[1].sensorsMuted = true;
assert.deepEqual(sensorChannelKeys(state, 'refinery'), ['refinery']);
state.ships[2].sensorsMuted = true;
assert.deepEqual(sensorChannelKeys(state, 'refinery'), [], 'muting all ships silences local chatter');
assert.deepEqual(resolveMessageChannelKeys(state, { shipId: 'two' }), ['refinery'], 'captains remain audible when sensors muted');
state.ships[0].status = 'destroyed';
assert.equal(shipChannelPosition(state.ships[0], state.ships), null);
assert.deepEqual(sensorChannelKeys(state, 'anchor_station'), [DISPATCH_CHANNEL]);

const traveler = ship('traveler', 'refinery', { status: 'enroute', destination: 'indigo_station' });
assert.deepEqual(shipChannelPosition(traveler), { key: 'route:refinery:indigo_station', from: 'refinery', to: 'indigo_station' });
assert.deepEqual(sensorChannelKeys({ ships: [traveler] }, 'refinery'), [], 'departed ships cannot hear origin');
assert.deepEqual(sensorChannelKeys({ ships: [traveler] }, 'indigo_station'), []);
traveler.sensorMode = 'instruments';
assert.deepEqual(sensorChannelKeys({ ships: [traveler] }, 'indigo_station'), [], 'in-flight sensors do not open chatter panels');
assert.deepEqual(resolveMessageChannelKeys({ ships: [traveler] }, {shipId: 'traveler'}), [DISPATCH_CHANNEL], 'in-flight reports go to dispatch');
assert.equal(occupiedChannelPositions({ships: [traveler]}).size, 1, 'travel never creates a terminal');
traveler.travelPlan = { mode: 'contract', firstLegFrom: 'refinery', firstLegTo: 'yard', secondLegFrom: 'yard', secondLegTo: 'indigo_station' };
assert.equal(shipChannelPosition(traveler).key, 'route:refinery:yard');
traveler.travelPlan.firstLegDockRecorded = true;
assert.equal(shipChannelPosition(traveler).key, 'route:yard:indigo_station');
traveler.travelPlan.firstLegFrom = 'yard';
traveler.travelPlan.firstLegDockRecorded = false;
assert.equal(shipChannelPosition(traveler).key, 'route:yard:indigo_station', 'already-loaded contracts start on delivery leg');
const tug = ship('tug', 'refinery', { status: 'docked', dockedTo: 'traveler' });
assert.equal(shipChannelPosition(tug, [tug, traveler]).key, 'route:yard:indigo_station', 'docked tug follows host route');
traveler.status = 'arrived_pending_report';
traveler.at = 'indigo_station';
assert.equal(shipChannelPosition(tug, [tug, traveler]).key, 'indigo_station');
assert.equal(occupiedChannelPositions({ ships: [tug, traveler] }).get('indigo_station').ships.length, 2);

// A small DOM stand-in keeps the lifecycle/queue tests dependency-free.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.hidden = false;
    this.scrollTop = 0;
    this.clientHeight = 100;
    this.scrollHeight = 100;
    this._text = '';
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, value) => value ? classes.add(name) : classes.delete(name),
      contains: (name) => classes.has(name),
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  set innerHTML(value) { this.textContent = value; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  click() { this.listeners.click?.(); }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  appendChild(child) {
    if (child.parentNode) child.parentNode.children = child.parentNode.children.filter((entry) => entry !== child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(selector === '.line' && child.className?.split(' ').includes('line') ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}
const originalDocument = globalThis.document;
const originalSetTimeout = globalThis.setTimeout;
const originalNow = Date.now;
try {
  const tasks = [];
  const delays = [];
  globalThis.document = { createElement: (tag) => new Element(tag) };
  globalThis.setTimeout = (fn, delay) => { tasks.push(fn); delays.push(delay); return tasks.length; };
  Date.now = () => 0;
  const flush = () => { while (tasks.length) tasks.shift()(); };
  const ui = Object.fromEntries([
    'dispatchShips', 'locationChannels', 'inactiveChannels', 'inactiveChannelsSection',
    'inactiveChannelCount', 'channelCount', 'channelsEmpty', 'minimizeChannels',
  ].map((key) => [key, new Element()]));
  const liveState = { tick: 1, ships: [ship('a', 'anchor_station'), ship('b', 'refinery'), ship('c', 'refinery')] };
  const terminals = createLocationTerminals({
    state: liveState, ui, nodeLabel: (id) => id, shipLabel: (entry) => entry.id,
    fmtTime: String, stylizeConsoleText: (text) => text,
  });
  terminals.sync();
  assert.equal(ui.locationChannels.children.length, 1);
  assert.equal(ui.dispatchShips.textContent, 'a · Default suite');
  const card = ui.locationChannels.children[0];
  liveState.ships[1].sensorMode = 'comms';
  liveState.ships[2].sensorsMuted = true;
  terminals.sync();
  assert.equal(card.children[0].children[0].children[0].children[1].textContent.includes('b · Comms array / c · Mute · Default suite'), true, 'co-located ships retain their individual sensor configurations');
  const toggle = card.children[0].children[0];
  const badge = toggle.children[1];
  const feed = card.children[2];
  terminals.logLine('refinery', 'First local transmission', 'comms');
  flush();
  assert.equal(feed.children.length, 1);
  toggle.click();
  assert.equal(feed.hidden, true);
  terminals.logLine('refinery', 'Still receiving while minimized', 'comms');
  flush();
  assert.equal(feed.children.length, 2);
  assert.equal(badge.textContent, '1 new');
  terminals.sync();
  assert.equal(feed.hidden, true, 'normal renders preserve manual minimization');
  toggle.click();
  assert.equal(badge.hidden, true);
  assert.equal(feed.hidden, false);

  // Leaving one ship behind keeps the shared location live.
  liveState.ships[1].at = 'anchor_station';
  terminals.sync();
  assert.equal(ui.locationChannels.children.length, 1);
  assert.equal(toggle.children[0].children[1].textContent.includes('c'), true);
  terminals.logLine('refinery', 'Queued before departure', 'comms');
  liveState.ships[2].at = 'anchor_station';
  terminals.sync();
  assert.equal(ui.locationChannels.children.length, 0);
  assert.equal(ui.inactiveChannels.children[0], card, 'history DOM is retained');
  assert.equal(feed.hidden, true, 'last departure auto-minimizes');
  toggle.click();
  assert.equal(feed.hidden, false, 'inactive history can be expanded');
  terminals.logLine('refinery', 'Must never enter empty terminal', 'comms');
  flush();
  assert.equal(feed.children.length, 2, 'empty terminals freeze queued and new updates');
  terminals.logLine('refinery', 'Departure acknowledgement copied to origin', 'comms-blufreight', { departureCopy: true, importance: 2 });
  assert.equal(feed.children.length, 3, 'explicit departure acknowledgement is retained at the origin');
  // Restore the fixture count for subsequent lifecycle checks.
  feed.children.pop();

  liveState.ships[1].at = 'refinery';
  terminals.sync();
  assert.equal(ui.locationChannels.children[0], card, 'return reuses original terminal');
  assert.equal(feed.hidden, false);
  terminals.logLine('refinery', 'Stale queued message', 'comms');
  liveState.ships[1].at = 'anchor_station';
  terminals.sync();
  liveState.ships[1].at = 'refinery';
  terminals.sync();
  flush();
  assert.equal(feed.children.length, 2, 'old-generation messages cannot leak into reoccupied terminal');
  terminals.logLine('refinery', 'Fresh transmission after return', 'report', { importance: 2 });
  assert.equal(delays.at(-1), 0, 'reoccupied terminals do not inherit an obsolete delivery backlog');
  flush();
  assert.equal(feed.children.length, 3);
  assert.equal(terminals.transcript().includes('First local transmission'), true);
  assert.equal(terminals.transcript().includes('Fresh transmission after return'), true);

  ui.minimizeChannels.click();
  assert.equal(feed.hidden, true);
  liveState.ships[2].at = 'indigo_station';
  terminals.sync();
  assert.equal(ui.locationChannels.children.length, 2);
  assert.equal(feed.hidden, true, 'opening a new channel does not expand existing minimized channels');
  const otherFeed = ui.locationChannels.children[1].children[2];
  for (let index = 0; index < 30; index += 1) terminals.logLine('refinery', `Ambient ${index}`, 'comms');
  terminals.logLine('indigo_station', 'Independent feed', 'comms');
  terminals.logLine('refinery', 'Essential captain report', 'comms-blufreight', { importance: 2 });
  flush();
  assert.equal(otherFeed.children.length, 1, 'busy feed cannot throttle another location');
  assert.equal(feed.children.at(-1).textContent.includes('Essential captain report'), true, 'captain reports survive ambient throttling');
  liveState.ships[1].status = 'destroyed';
  terminals.sync();
  assert.equal(ui.inactiveChannels.children.includes(card), true, 'destruction retires ship sensor coverage');
  liveState.ships[2].status = 'enroute';
  liveState.ships[2].destination = 'yard';
  terminals.sync();
  assert.equal(ui.locationChannels.children.some((entry) => entry.dataset.channel.startsWith('route:')), false, 'no transit panels appear');
  liveState.ships[2].at = 'yard';
  liveState.ships[2].status = 'idle';
  terminals.sync();
  assert.equal(ui.locationChannels.children.some((entry) => entry.dataset.channel.startsWith('route:')), false, 'no transit panels remain after arrival');
} finally {
  globalThis.document = originalDocument;
  globalThis.setTimeout = originalSetTimeout;
  Date.now = originalNow;
}
console.log('location channel tests passed');
