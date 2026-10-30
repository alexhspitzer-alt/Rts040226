export const FACTION_HEAT_CAMPAIGN_MIN_DURATION_SECONDS = 180;
export const FACTION_HEAT_CAMPAIGN_MAX_DURATION_SECONDS = 540;
export const FACTION_HEAT_CAMPAIGN_ROLL_INTERVAL_SECONDS = 10;
export const FACTION_HEAT_CAMPAIGN_TRIGGER_THRESHOLD = 100;
export const FACTION_HEAT_CAMPAIGN_ROLL_FLOOR = 25;
export const FACTION_HEAT_CAMPAIGN_PROBABILITY_ASYMPTOTE = 0.06;
export const FACTION_HEAT_CAMPAIGN_PROBABILITY_HEAT_SCALE = 55;
export const FACTION_HEAT_CAMPAIGN_CONCURRENT_DECAY = 0.35;
export const FACTION_HEAT_MAX = 120;
export const FACTION_HEAT_STAGE_AMOUNT = { verbal: 4, intercept: 7 };
export const FACTION_HEAT_FIRE_AMOUNT = 10;
export const FACTION_HEAT_COLLATERAL_AMOUNT = 4;
export const FACTION_HEAT_CAMPAIGN_FIRE_AMOUNT = 1;
export const FACTION_HEAT_CAMPAIGN_COLLATERAL_AMOUNT = 0;
export const HEAT_FACTIONS = ["ufp", "arcworks", "blister"];
export const FACTION_DISPLAY_NAMES = {
  ufp: "UFP",
  arcworks: "Arcworks",
  blister: "Blister",
};
export const CAMPAIGN_HOME_BASE_NODE_IDS = {
  ufp: [
    "ufp_indigo_system_administration",
    "ufp_outpost_alpha",
    "ufp_outpost_bravo",
    "ufp_outpost_delta",
    "ufp_science_station",
    "anchor_station",
    "indigo_station",
    "barons_market",
  ],
  arcworks: [
    "arcworks_operations_hub",
    "arcworks_militia_barracks",
    "arcworks_fuel_depot",
    "onion_skin",
    "refinery",
    "condenser_columns",
    "barons_market",
    "indigo_station",
  ],
  blister: [
    "deep_space_transfer_lane",
    "high_orbit_transfer_lane",
    "ring_transfer_lane",
    "low_orbit_transfer_lane",
    "yard",
    "refinery",
    "barons_market",
  ],
};
export const CAMPAIGN_FALLBACK_LOCATION_NODE_ID = "barons_market";
export const CAMPAIGN_DEFENDER_RESPONSE_LINES = [
  "Piss off and try someone easier.",
  "I'd like to see them try.",
  "They've bitten off more than they can chew.",
  "Tell them to bring more ships.",
  "They want a campaign? We will give them a graveyard.",
  "They can have this route when we are done using it to break them.",
  "We are still here. That is their first problem.",
  "Let them come closer. We have answers loaded.",
  "They picked the wrong target and the wrong day.",
  "We are not moving. They are welcome to learn why.",
  "Their threats are louder than their guns.",
  "They should have counted our batteries before starting this.",
  "We will be waiting at the marker with engines hot.",
  "They can explain this mistake to their survivors.",
  "If they want the lane, they can bleed for every kilometer.",
  "They are overextended and about to notice.",
  "This attack ends when they run out of nerve or hulls.",
  "They came looking for weakness and found a hard lock.",
  "We have seen worse threats from worse captains.",
  "Let them commit. Retreat is harder after the first burn.",
  "They are not taking our ground by headline.",
  "We will make this expensive enough to remember.",
  "They are welcome to test the perimeter.",
  "They opened the door. Now they can eat the room.",
  "Stand firm. They have already made the fatal mistake."
];
