import { MigrationRunner } from "../migration/MigrationRunner.js";
import { FoundryRepositoryFactory } from "../actors/character/repositories/FoundryRepositoryFactory.js";
import { getSetting, setSetting } from "../settings.js";
import { isArtInstalled } from "../art/foundryArt.js";
import { info } from "../utils/logger.js";

/**
 * Remind the GM (once per session, until dismissed or installed) that the book
 * illustrations can be added from their own PDFs via the Install Artwork screen.
 */
async function nudgeMissingArt() {
	if (getSetting("artNudgeDismissed")) return;
	if (await isArtInstalled()) return;
	// Permanent: stays until the GM closes it (a timed toast vanishes before it's read).
	ui.notifications.info(game.i18n.localize("stonetop.artInstaller.nudge"), { permanent: true });
}

/**
 * Default the Wider World journal compendium to manual (book-order) sorting. Foundry sorts
 * compendiums alphabetically unless the world's `core.collectionSortingModes` marks a pack "m";
 * our entries carry a book-order `sort`, so we want manual. Only set it when the user hasn't already
 * configured this pack — so toggling back to alphabetical in the UI sticks.
 */
async function ensureBookOrderSort() {
	const pack = game.packs?.get("stonetop.wider-world-and-other-wonders");
	if (!pack) return;
	const modes = foundry.utils.deepClone(game.settings.get("core", "collectionSortingModes") ?? {});
	if (pack.collection in modes) return;
	modes[pack.collection] = "m";
	await game.settings.set("core", "collectionSortingModes", modes);
}

export async function onReady() {
	if (!game.user?.isGM) return;

	await ensureBookOrderSort();
	await nudgeMissingArt();

	const stored  = getSetting("systemVersion");
	const current = game.system?.version ?? "";

	if (!current || !foundry.utils.isNewerVersion(current, stored)) return;

	info(`Migrating world from ${stored || "pre-0.9.1"} → ${current}`);
	await new MigrationRunner(new FoundryRepositoryFactory()).run();
	await setSetting("systemVersion", current);
}
