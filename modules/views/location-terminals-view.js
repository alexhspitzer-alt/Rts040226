import { createConsoleLogger } from "../../console.js?v=location-terminals-20261028b";
import { DISPATCH_CHANNEL, occupiedChannelPositions } from "../game-channels.js";

export function createLocationTerminals({ state, ui, nodeLabel, shipLabel, fmtTime, stylizeConsoleText, doc = document }) {
  const channels = new Map();

  function updateBadge(channel) {
    channel.badge.textContent = channel.unread ? `${channel.unread} new` : "";
    channel.badge.hidden = !channel.unread;
  }

  function setMinimized(channel, minimized) {
    channel.minimized = minimized;
    channel.feed.hidden = minimized;
    channel.follow.hidden = minimized;
    channel.preview.hidden = !minimized;
    channel.toggle.setAttribute("aria-expanded", String(!minimized));
    channel.chevron.textContent = minimized ? "+" : "−";
    channel.card.classList.toggle("is-minimized", minimized);
    if (!minimized) {
      channel.unread = 0;
      updateBadge(channel);
      if (channel.follow.getAttribute("aria-pressed") === "true") {
        channel.feed.scrollTop = channel.feed.scrollHeight;
      }
    }
  }

  function createChannel(position) {
    const card = doc.createElement("article");
    card.className = "panel location-terminal";
    card.dataset.channel = position.key;
    const header = doc.createElement("div");
    header.className = "channel-header";
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "channel-toggle";
    const identity = doc.createElement("span");
    identity.className = "channel-identity";
    const title = doc.createElement("span");
    title.className = "channel-title";
    const ships = doc.createElement("span");
    ships.className = "channel-ships";
    identity.append(title, ships);
    const badge = doc.createElement("span");
    badge.className = "channel-unread";
    badge.hidden = true;
    const chevron = doc.createElement("span");
    chevron.className = "channel-chevron";
    chevron.setAttribute("aria-hidden", "true");
    toggle.append(identity, badge, chevron);
    const follow = doc.createElement("button");
    follow.type = "button";
    follow.className = "copy-btn channel-follow";
    header.append(toggle, follow);
    const preview = doc.createElement("p");
    preview.className = "channel-preview";
    const feed = doc.createElement("div");
    feed.id = `location-feed-${channels.size + 1}`;
    feed.className = "feed location-feed";
    feed.setAttribute("role", "log");
    feed.setAttribute("aria-live", "off");
    feed.setAttribute("tabindex", "0");
    toggle.setAttribute("aria-controls", feed.id);
    card.append(header, preview, feed);
    const channel = {
      card, toggle, title, ships, badge, chevron, follow, preview, feed,
      active: true, generation: 0, minimized: false, unread: 0, lastLine: "", lastActiveTick: state.tick,
    };
    // Queue, throttle and follow state belong to this feed alone.
    const loggerState = {
      get tick() { return state.tick; },
      respondingToCommand: false,
      consoleReadyAtMs: Date.now(),
    };
    channel.logger = createConsoleLogger({
      state: loggerState,
      ui: { feed, consoleFollowToggle: follow },
      fmtTime, stylizeConsoleText,
      messageGapMs: 250,
      getDeliveryToken: () => channel.generation,
      canAppend: (generation) => channel.active && channel.generation === generation,
      onAppend: (text) => {
        channel.lastLine = text;
        channel.preview.textContent = text;
        channel.preview.title = text;
        if (channel.minimized) {
          channel.unread += 1;
          updateBadge(channel);
        }
      },
    });
    toggle.addEventListener("click", () => setMinimized(channel, !channel.minimized));
    setMinimized(channel, false);
    channels.set(position.key, channel);
    return channel;
  }

  function sync() {
    const occupied = occupiedChannelPositions(state);
    const anchorShips = occupied.get(DISPATCH_CHANNEL).ships;
    if (ui.dispatchShips) ui.dispatchShips.textContent = anchorShips.length
      ? anchorShips.map(shipLabel).join(" · ")
      : "No fleet ships on station";
    for (const [key, position] of occupied) {
      if (key === DISPATCH_CHANNEL) continue;
      const channel = channels.get(key) || createChannel(position);
      const reactivated = !channel.active;
      if (reactivated) {
        channel.active = true;
        channel.generation += 1;
        channel.logger.resetDeliveryQueue();
        setMinimized(channel, false);
      }
      channel.position = position;
      const label = position.nodeId ? nodeLabel(position.nodeId) : `${nodeLabel(position.from)} → ${nodeLabel(position.to)}`;
      channel.title.textContent = label;
      channel.ships.textContent = `${position.ships.map(shipLabel).join(" · ")} · ${position.nodeId ? "Local sensors" : "In transit"} · Read only`;
      channel.feed.setAttribute("aria-label", `${label} transmissions`);
      channel.lastActiveTick = state.tick;
      channel.card.classList.remove("is-inactive");
      if (channel.card.parentNode !== ui.locationChannels) ui.locationChannels.appendChild(channel.card);
      if (!channel.lastLine) channel.preview.textContent = "Listening for local traffic…";
    }
    for (const [key, channel] of channels) {
      if (occupied.has(key) || !channel.active) continue;
      channel.active = false;
      channel.generation += 1;
      channel.ships.textContent = `No ships · Signal ended ${fmtTime(channel.lastActiveTick)} · History only`;
      channel.card.classList.add("is-inactive");
      setMinimized(channel, true);
      ui.inactiveChannels.appendChild(channel.card);
      if (!channel.lastLine) channel.preview.textContent = "No transmissions recorded.";
    }
    const liveCount = occupied.size - 1;
    const inactiveCount = channels.size - liveCount;
    if (ui.channelCount) ui.channelCount.textContent = `${liveCount} live`;
    if (ui.inactiveChannelCount) ui.inactiveChannelCount.textContent = String(inactiveCount);
    if (ui.inactiveChannelsSection) ui.inactiveChannelsSection.hidden = inactiveCount === 0;
    if (ui.channelsEmpty) ui.channelsEmpty.hidden = liveCount > 0;
  }

  ui.minimizeChannels?.addEventListener("click", () => {
    channels.forEach((channel) => { if (channel.active) setMinimized(channel, true); });
  });

  function logLine(key, text, type, options) {
    const channel = channels.get(key);
    if (channel?.active) channel.logger.logLine(text, type, options);
  }

  function transcript() {
    return [...channels.values()].map((channel) => {
      const lines = [...channel.feed.querySelectorAll(".line")].map((line) => line.textContent);
      return [`--- ${channel.title.textContent} ---`, ...lines].join("\n");
    }).join("\n\n");
  }

  return { sync, logLine, transcript };
}
