import { creatureFields, followerFields, migrateCreatureData } from "./creature.js";

export class NpcItemData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return { ...creatureFields(), ...followerFields() };
	}

	static migrateData(source) {
		return super.migrateData(migrateCreatureData(source));
	}
}
