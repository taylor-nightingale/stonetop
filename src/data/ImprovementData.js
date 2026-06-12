import { migrateChoicesField } from "../migration/migrateChoices.js";

export class ImprovementData extends foundry.abstract.TypeDataModel {
	static migrateData(source) {
		migrateChoicesField(source.choices);
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:      new f.StringField({ nullable: true, initial: null }),
			sortOrder: new f.NumberField({ nullable: true, initial: null }),
			choices:   new f.ObjectField({ nullable: true, initial: null }),
		};
	}
}
