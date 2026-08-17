import { MigrationRunner } from "../migration/MigrationRunner.js";
import { FoundryRepositoryFactory } from "../actors/character/repositories/FoundryRepositoryFactory.js";
import { getSetting, setSetting } from "../settings.js";
import { isArtInstalled } from "../art/foundryArt.js";
import { PackVersionCheck } from "../migration/PackVersionCheck.js";
import { info, warn } from "../utils/logger.js";

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

async function _packsAreStale(systemVersion) {
	const stale = await new PackVersionCheck(PackVersionCheck.systemPacks(), systemVersion).stalePacks();
	if (stale.length) warn(`Compendium packs were built by a different system version: ${stale.join(", ")}`);
	return stale.length > 0;
}

export async function onReady() {
	if (!game.user?.isGM) return;

	await ensureBookOrderSort();
	await nudgeMissingArt();

	const stored  = getSetting("systemVersion");
	const current = game.system?.version ?? "";

	// Checked ahead of the version gate, and on every load: a world that already stamped this version
	// still needs telling, and a stale compendium is a broken install rather than a pending migration.
	// Migrating against one would write its out-of-date content onto every character — the refreshes
	// copy the pack onto the sheet, so a stale pack becomes stale characters. Better to do nothing and
	// say why; once the install is repaired the migration runs normally, with the version still unstamped.
	if (current && await _packsAreStale(current)) {
		ui.notifications.error(game.i18n.localize("stonetop.migration.stalePacks"), { permanent: true });
		return;
	}

	if (!current || !foundry.utils.isNewerVersion(current, stored)) return;

	info(`Migrating world from ${stored || "pre-0.9.1"} → ${current}`);
	const failed = await new MigrationRunner(new FoundryRepositoryFactory()).run();

	// Stamping the version is what says "this world is done". An actor that threw is NOT done, and every
	// pass it missed is gated on this stamp — stamping anyway would skip it for good, leaving that sheet
	// on whatever content it had when the error hit. Leave the old version so the next load retries.
	if (failed.length) {
		ui.notifications.error(
			game.i18n.format("stonetop.migration.failed", { names: failed.join(", ") }),
			{ permanent: true },
		);
		return;
	}
	await setSetting("systemVersion", current);
}
