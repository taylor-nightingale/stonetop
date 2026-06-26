// System data model for the "monsterMove" Item subtype (description +
// rollFormula). Shares its schema with NpcMoveModel via simpleMoveSchema().
import { simpleMoveSchema } from "./fields.js";

export class MonsterMoveModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return simpleMoveSchema();
	}
}
