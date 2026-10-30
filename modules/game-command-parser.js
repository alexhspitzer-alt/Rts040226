const COMMAND_ALIASES = {
  contract: "contracts",
  contracts: "contracts",
  a: "assign",
  assign: "assign",
  f: "fleet",
  fleet: "fleet",
  ship: "fleet",
  ships: "fleet",
  s: "send",
  send: "send",
  sel: "select",
  select: "select",
  stat: "status",
  status: "status",
  h: "help",
  c: "contracts",
  n: "navigation",
  nav: "navigation",
  navigation: "navigation",
  p: "pause",
};

export function normalizeCommandWord(word) {
  const lower = String(word || "").toLowerCase();
  return COMMAND_ALIASES[lower] || lower;
}

export function parseCommandInput(input) {
  const normalizedInput = String(input || "").trim();
  if (!normalizedInput) {
    return { input: "", lower: "", parts: [], command: "" };
  }
  const lower = normalizedInput.toLowerCase();
  const parts = lower.split(/\s+/);
  const command = parts[0] === "h" && parts.length >= 2
    ? "hail"
    : normalizeCommandWord(parts[0]);
  return { input: normalizedInput, lower, parts, command };
}

export function parseConfirmationResponse(input) {
  const lower = String(input || "").trim().toLowerCase();
  if (lower === "y" || lower === "yes") return "yes";
  if (lower === "n" || lower === "no") return "no";
  return null;
}
