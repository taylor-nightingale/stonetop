// System data model for the "npcMove" Item subtype (description + rollFormula).
// Shares its schema with MonsterMoveModel via simpleMoveSchema().
import { simpleMoveSchema } from "./fields.js";

export class NpcMoveModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return simpleMoveSchema();
	}
}
