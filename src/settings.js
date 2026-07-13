import { createArtInstallerAppClass } from "./art/ArtInstallerApp.js";

export function registerSettings() {
	// -- WORLD SETTINGS ------------------------------------------

	// GM screen for extracting the book illustrations from owned PDFs (in the
	// browser) and uploading them to Data/stonetop-art/.
	game.settings.registerMenu("stonetop", "artInstaller", {
		name: "stonetop.settings.artInstaller.name",
		label: "stonetop.settings.artInstaller.label",
		hint: "stonetop.settings.artInstaller.hint",
		icon: "fas fa-images",
		type: createArtInstallerAppClass(),
		restricted: true,
	});

	// Whether the GM has dismissed the "book artwork isn't installed" reminder.
	game.settings.register("stonetop", "artNudgeDismissed", {
		name: "Artwork Reminder Dismissed",
		scope: "world",
		config: false,
		type: Boolean,
		default: false
	});

	// Tracks the last loaded system version.
	// Used to detect when migrations need to run.
	game.settings.register("stonetop", "systemVersion", {
		name: "System Version",
		scope: "world",
		config: false,
		type: String,
		default: ""
	});

	// Whether the compendium seeding prompt has been dismissed.
	// Prevents nagging the GM every session if they've already seeded.
	game.settings.register("stonetop", "seedingComplete", {
		name: "Compendium Seeding Complete",
		scope: "world",
		config: false,
		type: Boolean,
		default: false
	});

	// Remembered last window size per sheet type ({ "Actor.character": {width, height}, ... }).
	// Client-scoped so each user keeps their own preferred sheet sizes; restored on open.
	game.settings.register("stonetop", "sheetSizes", {
		name: "Sheet Sizes",
		scope: "client",
		config: false,
		type: Object,
		default: {}
	});

	// Turn debug logging on
	game.settings.register("stonetop", "debugMode", {
		name: "stonetop.settings.debugMode.name",
		hint: "stonetop.settings.debugMode.hint",
		scope: "client",
		config: true,
		type: Boolean,
		default: false
	});
}

export function getSetting(key) {
	return game.settings.get("stonetop", key);
}

export function setSetting(key, value) {
	return game.settings.set("stonetop", key, value);
}
