import { migrateCharacter } from "./migrateCharacter.js";
import { migrateNpc } from "./migrateNpc.js";
import { migrateSteading } from "./migrateSteading.js";
import { migrateWorldItems } from "./migrateWorldItems.js";
import { FoundryInsertRepository } from "../actors/character/repositories/FoundryInsertRepository.js";
import { error, info } from "../utils/logger.js";

const SCOPE = "stonetop";

export class MigrationRunner {
	constructor(repos) {
		this._repos = repos;
	}

	async run() {
		info("Running world migration to 0.10.1…");
		await _migrateResourceFlags();
		for (const actor of [...(game.actors ?? [])]) {
			try {
				if (actor.type === "character") {
					await migrateCharacter(actor, this._repos, new FoundryInsertRepository());
				} else if (actor.type === "npc") {
					await migrateNpc(actor);
				} else if (actor.type === "steading") {
					await migrateSteading(actor);
				}
			} catch (err) {
				error(`Migration failed for actor "${actor.name}": ${err.message}`);
			}
		}
		await migrateWorldItems();
		info("Migration complete.");
	}
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
