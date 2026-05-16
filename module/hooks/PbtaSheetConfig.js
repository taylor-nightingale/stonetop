import { info, error } from "../utils/logger.js";
import { GetSheetConfig } from "../config/get-sheet-config.js"

export function onPbtaSheetConfig() {
	if (!game.user.isGM) return;

	// Disable the sheet config form.
	info("Setting up Stonetop sheet config.");
	game.settings.set("pbta", "sheetConfigOverride", true);

	game.pbta.sheetConfig = GetSheetConfig();
	_migrateActorLabels().catch(error);
	_migrateAttributeSchema().catch(error);
	_ensureAllCharacterMoves().catch(error);
}

async function _ensureAllCharacterMoves() {
	for (const actor of game.actors) {
		if (actor.type !== "character") continue;
		await actor.typedActor.ensureStartingMoves();
	}
}

async function _migrateAttributeSchema() {
	const attrConfig = game.pbta.sheetConfig?.actorTypes?.character?.attributes ?? {};

	for (const actor of game.actors) {
		if (actor.type !== "character") continue;
		const updates = {};

		for (const [key, cfg] of Object.entries(attrConfig)) {
			const stored = actor.system.attributes?.[key];
			if (!stored) continue;
			if (cfg.type && stored.type !== cfg.type)
				updates[`system.attributes.${key}.type`] = cfg.type;
			if (cfg.position && stored.position !== cfg.position)
				updates[`system.attributes.${key}.position`] = cfg.position;
			if ("steps" in stored && cfg.type !== "Xp")
				updates[`system.attributes.${key}.-=steps`] = null;
		}

		if (actor.system.attributes?.load !== undefined)
			updates["system.attributes.-=load"] = null;

		if (Object.keys(updates).length) await actor.update(updates);
	}
}

async function _migrateActorLabels() {
	const statConfig = game.pbta.sheetConfig?.actorTypes?.character?.stats ?? {};
	const attrConfig = game.pbta.sheetConfig?.actorTypes?.character?.attributes ?? {};

	for (const actor of game.actors) {
		if (actor.type !== "character") continue;
		const updates = {};
		for (const [key, cfg] of Object.entries(statConfig)) {
			if (cfg.label && actor.system.stats?.[key]?.label !== cfg.label) {
				updates[`system.stats.${key}.label`] = cfg.label;
			}
		}
		for (const [key, cfg] of Object.entries(attrConfig)) {
			if (cfg.label && actor.system.attributes?.[key]?.label !== cfg.label) {
				updates[`system.attributes.${key}.label`] = cfg.label;
			}
		}
		if (Object.keys(updates).length) await actor.update(updates);
	}
}
