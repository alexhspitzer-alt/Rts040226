const DEFAULT_PATHS = {
  lore: "./bluFreight%20text%20RTS.txt",
  dialogue: "./indigo_dialogue_characters.json",
  map: "./map.json",
  budde: "./budde.json",
  scenario: "./scenarioDat.json",
  almanac: "./almanac_entries_with_descriptions.json",
  shipRegistry: "./ship_registry.json",
  characterNameRegistry: "./character_name_registry.json",
  conflictOutcomes: "./conflict_outcomes.json",
};

function validateObject(value, label, warnings) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnings.push(`${label} data is missing or not an object.`);
    return false;
  }
  return true;
}

function validateArray(value, label, warnings) {
  if (!Array.isArray(value)) {
    warnings.push(`${label} data is missing or not an array.`);
    return false;
  }
  return true;
}

async function readText(response, label, warnings) {
  if (!response?.ok) {
    warnings.push(`${label} unavailable${response ? ` (${response.status})` : ""}.`);
    return null;
  }
  return response.text();
}

async function readJson(response, label, warnings) {
  if (!response?.ok) {
    warnings.push(`${label} unavailable${response ? ` (${response.status})` : ""}.`);
    return null;
  }
  try {
    return await response.json();
  } catch (err) {
    warnings.push(`${label} JSON parse failed: ${err?.message || "unknown error"}.`);
    return null;
  }
}

function buildScenarioDialogue(scenario, warnings) {
  if (!scenario) return null;
  validateObject(scenario, "Scenario", warnings);
  const basilScenario = scenario?.basil_scenario_dialogue || {};
  return {
    intro_welcome: basilScenario.intro_welcome?.text || null,
    intro_information_integrity: basilScenario.intro_information_integrity?.text || null,
    intro_tutorial_scenario: basilScenario.intro_tutorial_scenario?.text || null,
    order_delay_acknowledgements: Array.isArray(basilScenario.order_delay_acknowledgements)
      ? basilScenario.order_delay_acknowledgements.map((entry) => entry?.text).filter(Boolean)
      : [],
    report_staleness_acknowledgements: Array.isArray(basilScenario.report_staleness_acknowledgements)
      ? basilScenario.report_staleness_acknowledgements.map((entry) => entry?.text).filter(Boolean)
      : [],
    tutorial_complete: basilScenario.tutorial_complete?.text || null,
    budde_intro: scenario?.budde_scenario_dialogue?.intro?.text || null,
  };
}

export async function loadGameReferenceData({ fetchImpl = fetch, paths = {}, cache = "no-store" } = {}) {
  const resolvedPaths = { ...DEFAULT_PATHS, ...paths };
  const warnings = [];
  const requestOptions = { cache };
  const responses = await Promise.all(Object.entries(resolvedPaths).map(async ([key, path]) => [
    key,
    await fetchImpl(path, requestOptions),
  ]));
  const responseByKey = Object.fromEntries(responses);

  const loreText = await readText(responseByKey.lore, "Lore", warnings);
  const dialogueData = await readJson(responseByKey.dialogue, "Dialogue", warnings);
  const mapData = await readJson(responseByKey.map, "Map", warnings);
  const buddeData = await readJson(responseByKey.budde, "BUDDE", warnings);
  const scenario = await readJson(responseByKey.scenario, "Scenario", warnings);
  const almanac = await readJson(responseByKey.almanac, "Almanac", warnings);
  const shipRegistry = await readJson(responseByKey.shipRegistry, "Ship registry", warnings);
  const characterNameRegistry = await readJson(responseByKey.characterNameRegistry, "Character name registry", warnings);
  const conflictOutcomes = await readJson(responseByKey.conflictOutcomes, "Conflict outcomes", warnings);

  if (dialogueData) validateObject(dialogueData?.characters || dialogueData, "Dialogue character", warnings);
  if (mapData) validateObject(mapData, "Map", warnings);
  if (almanac) validateObject(almanac?.almanac_entries, "Almanac entries", warnings);
  if (shipRegistry) validateObject(shipRegistry, "Ship registry", warnings);
  if (characterNameRegistry) validateObject(characterNameRegistry, "Character name registry", warnings);
  if (conflictOutcomes) validateObject(conflictOutcomes, "Conflict outcomes", warnings);
  if (dialogueData?.ambientNeutralConversation?.lines) validateArray(dialogueData.ambientNeutralConversation.lines, "Ambient neutral conversation lines", warnings);

  const condensedLore = String(loreText || "").replace(/\s+/g, " ").trim();
  return {
    loreSummary: condensedLore ? condensedLore.slice(0, 340) : null,
    dialogueDb: dialogueData?.characters || dialogueData || null,
    playerRequestDialogue: dialogueData?.hailResponses || {},
    ambientNeutralConversation: Array.isArray(dialogueData?.ambientNeutralConversation?.lines)
      ? dialogueData.ambientNeutralConversation.lines
      : [],
    ambientDialoguePools: dialogueData?.ambientDialoguePools || {},
    mapData,
    buddeData,
    scenarioDialogue: buildScenarioDialogue(scenario, warnings),
    scenario2Dialogue: scenario?.scenario2_dialogue || null,
    scenario3Dialogue: scenario?.scenario3_dialogue || null,
    scenario4Dialogue: scenario?.scenario4_dialogue || null,
    almanacEntries: almanac?.almanac_entries || null,
    shipRegistry,
    characterNameRegistry,
    conflictOutcomes,
    warnings,
  };
}
