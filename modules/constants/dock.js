import { THORNE_NAME } from "./core.js";

export const PORT_AUTHORITY_BY_MOON = {
  "Cat's Eye": "Port Marshal Celia Wren",
  Corkscrew: THORNE_NAME,
  Peltier: "Harbor Prefect Octavia Brindle",
  Oxblood: "Dock Adjudicator Terek Halden",
  Patch: "Pier Controller Zofia Krail",
  "Onion Skin": "Port Factor Sable Orwick",
  Shooter: "Berth Warden Kez Rourke",
  Sulphide: "Dock Registrar Lysette Vorn",
  Clambroth: "Harbor Officer Bram Caldus",
  "End-of-Day": "Quay Auditor Odel Quince",
};

export const DOCK_CONDITION_INITIAL_MIN_VALUE = 955;
export const DOCK_CONDITION_INITIAL_MAX_VALUE = 1000;
export const DOCK_CONDITION_ARRIVAL_DECREMENT = 3;
export const DOCK_CONDITION_DEPARTURE_DECREMENT = 2;
export const DOCK_MAINTENANCE_TRIGGER_VALUE = 700;
export const DOCK_OPERATIONAL_VALUE = 940;
export const DOCK_MAINTENANCE_CLEAR_VALUE = 1000;
export const DOCK_MAINTENANCE_RECOVERY_PER_SECOND = 1;
export const DOCK_HAZARD_SEVERITY_LABELS = {
  1: "minor",
  2: "moderate",
  3: "serious",
  4: "catastrophic",
};
export const DOCK_HAZARD_ROLLS = [
  { minDock: 950, chance: 0.02, maxSeverity: 1 },
  { minDock: 900, chance: 0.08, maxSeverity: 1 },
  { minDock: 850, chance: 0.16, maxSeverity: 2 },
  { minDock: 775, chance: 0.27, maxSeverity: 3 },
  { minDock: -Infinity, chance: 0.42, maxSeverity: 4 },
];
export const DOCK_HAZARDS = [
  { label: "telemetry synchronization error", severity: 1, phases: ["arrival", "departure"] },
  { label: "contact with debris", severity: 1, phases: ["arrival", "departure"] },
  { label: "wake dampers fail to engage", severity: 1, phases: ["arrival", "departure"] },
  { label: "assigned bay blocked by poor parking job", severity: 1, phases: ["arrival"] },
  { label: "visibility reduced by dust and debris", severity: 1, phases: ["arrival", "departure"] },
  { label: "traffic stalled for disabled freighter", severity: 2, phases: ["arrival", "departure"] },
  { label: "construction on pier pylons", severity: 2, phases: ["arrival", "departure"] },
  { label: "labor dispute at dock", severity: 2, phases: ["arrival", "departure"] },
  { label: "autocrane out of service", severity: 2, phases: ["arrival"] },
  { label: "Gauss array not available for launch", severity: 3, phases: ["departure"] },
  { label: "bay doors fail to open", severity: 3, phases: ["arrival"] },
  { label: "dock clamp fails to open", severity: 3, phases: ["departure"] },
  { label: "telemetry synchronization error", severity: 4, phases: ["arrival", "departure"] },
  { label: "contact with debris", severity: 4, phases: ["arrival", "departure"] },
  { label: "wake dampers fail to engage", severity: 4, phases: ["arrival", "departure"] },
];
