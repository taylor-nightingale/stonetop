import { info } from "../utils/logger.js";
import { GetSheetConfig } from "../config/get-sheet-config.js"

export function onPbtaSheetConfig() {
	if (!game.user.isGM) return;

	// Disable the sheet config form.
	info("Setting up Stonetop sheet config.");
	game.settings.set("pbta", "sheetConfigOverride", true);

	game.pbta.sheetConfig = GetSheetConfig();
}
