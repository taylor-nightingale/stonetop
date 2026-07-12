// Map a stat-block's small marker icon (extracted from the PDF) to a shipped trade-dress asset.
// Book II prints a creature-type marker symbol beside every stat block — the arcanum marker for a
// follower, the creature-type glyph for a monster. Those symbols already ship under
// assets/content/wonders/markers/ (deduped by raster hash via trade-dress.json), so we reference the
// shipped file rather than committing a duplicate. Shared by build-arcana (followers) and
// build-npcs (npcs).
import { readFileSync } from "fs";
import { rasterKey } from "./png.js";

// Fallback when a stat block has no icon, or its icon isn't a known marker.
export const NPC_DEFAULT_IMG = "systems/stonetop/assets/content/icons/npc.png";

const markerMap = JSON.parse(readFileSync("scripts/import/pdf/trade-dress.json", "utf8")).markers; // raster hash -> marker name

// Resolve an extracted icon file to its shipped marker asset path, or null when it isn't a known marker.
export const markerImg = (file) => {
	if (!file) return null;
	const name = markerMap[rasterKey(readFileSync(file))];
	return name ? `systems/stonetop/assets/content/wonders/markers/${name}.png` : null;
};
