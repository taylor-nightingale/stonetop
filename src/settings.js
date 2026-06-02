export function registerSettings() {
	// -- WORLD SETTINGS ------------------------------------------

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

	// -- CLIENT SPECIFIC SETTINGS --------------------------------

	game.settings.register("stonetop", "hideRollMode", {
		name: "stonetop.settings.hideRollMode.name",
		hint: "stonetop.settings.hideRollMode.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
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
