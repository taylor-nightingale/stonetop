import { creatureFields, migrateCreatureData } from "./creature.js";

export class NpcData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return creatureFields();
	}

	static migrateData(source) {
		return super.migrateData(migrateCreatureData(source));
	}
}
