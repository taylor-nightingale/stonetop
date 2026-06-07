import { MigrationRunner } from "../migration/MigrationRunner.js";
import { FoundryRepositoryFactory } from "../actors/character/repositories/FoundryRepositoryFactory.js";
import { getSetting, setSetting } from "../settings.js";
import { info } from "../utils/logger.js";

export async function onReady() {
	if (!game.user?.isGM) return;

	const stored  = getSetting("systemVersion");
	const current = game.system?.version ?? "";

	if (!current || !foundry.utils.isNewerVersion(current, stored)) return;

	info(`Migrating world from ${stored || "pre-0.9.1"} → ${current}`);
	await new MigrationRunner(new FoundryRepositoryFactory()).run();
	await setSetting("systemVersion", current);
}
