import { migrateCharacter } from "./migrateCharacter.js";
import { migrateNpc } from "./migrateNpc.js";
import { migrateSteading } from "./migrateSteading.js";
import { migrateSteadingMoves } from "./migrateSteadingMoves.js";
import { migrateWorldItems } from "./migrateWorldItems.js";
import { migrateGrantStamps } from "./migrateGrantStamps.js";
import { FoundryInsertRepository } from "../actors/character/repositories/FoundryInsertRepository.js";
import { error, info } from "../utils/logger.js";

const SCOPE = "stonetop";

export class MigrationRunner {
	constructor(repos) {
		this._repos = repos;
	}

	/** @returns {string[]} the names of the actors whose migration threw — empty on a clean run. */
	async run() {
		info(`Running world migration to ${game.system?.version ?? "an unknown version"}…`);
		await _migrateResourceFlags();
		const steadfastDefaults = await _stonetopDefaults();
		const failed = [];
		for (const actor of [...(game.actors ?? [])]) {
			try {
				if (actor.type === "character") {
					await migrateCharacter(actor, this._repos, new FoundryInsertRepository());
				} else if (actor.type === "npc") {
					await migrateNpc(actor);
				} else if (actor.type === "steading") {
					await migrateSteading(actor, steadfastDefaults);
					// Not gated on migrateSteading's legacy check: every steading, however new,
					// needs homefront moves that were added since it was created.
					await migrateSteadingMoves(actor);
					await migrateGrantStamps(actor);
				}
			} catch (err) {
				failed.push(actor.name);
				error(`Migration failed for actor "${actor.name}": ${err.message}`);
			}
		}
		await migrateWorldItems();
		info(failed.length ? `Migration finished with ${failed.length} failed actor(s).` : "Migration complete.");
		return failed;
	}
}

// What a legacy steading should adopt from the Stonetop steadfast on migration: its granted
// improvements (what the old repository surfaced to every steading) and its starting attributes (kept
// as the baseline for the "Starts at …" notes). Empty defaults if the pack/item isn't available.
async function _stonetopDefaults() {
	const pack = game.packs?.get("stonetop.steadfasts");
	if (!pack) return { improvements: [], attributes: {} };
	const docs = await pack.getDocuments();
	const sys = docs.find(d => d.system?.slug === "stonetop")?.system;
	return { improvements: sys?.improvements ?? [], attributes: sys?.attributes ?? {} };
}

// Pre-0.9.1 resource flag consolidation (kept for anyone skipping intermediate releases)
async function _migrateResourceFlags() {
	const characters = (game.actors ?? []).filter(a => a.type === "character");
	for (const actor of characters) {
		if (actor.getFlag(SCOPE, "resources.counts") != null) continue;
		const counts = {};

		const bgResources = actor.getFlag(SCOPE, "backgrounds.resources");
		if (bgResources && Object.keys(bgResources).length > 0)
			counts.backgrounds = { ...bgResources };

		const invResources = actor.getFlag(SCOPE, "inventory.resources");
		if (invResources && Object.keys(invResources).length > 0)
			counts.inventory = { ...invResources };

		const followerState = actor.getFlag(SCOPE, "followers.state") ?? {};
		const followerLoyalty = Object.fromEntries(
			Object.entries(followerState)
				.filter(([, s]) => s?.loyalty != null && s.loyalty !== 0)
				.map(([slug, s]) => [slug, s.loyalty])
		);
		if (Object.keys(followerLoyalty).length > 0)
			counts.followers = followerLoyalty;

		await actor.setFlag(SCOPE, "resources.counts", counts);
	}
}
