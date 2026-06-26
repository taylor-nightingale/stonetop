// System data model for the "npc" Actor subtype — a lightweight narrative-NPC / threat
// stat block (name, tags, HP, armor, damage, instinct, special quality, moves, description).
// Distinct from the "monster" stat block (full bestiary codex) — the NPC is a quick card you
// drop on a scene. Ported/adapted from taylor-nightingale/stonetop.
import { creatureFields } from "./creature-fields.js";

export class NpcModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return creatureFields();
	}
}
