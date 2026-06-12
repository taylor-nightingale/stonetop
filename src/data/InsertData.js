import { migrateChoicesField } from "../migration/migrateChoices.js";

export class InsertData extends foundry.abstract.TypeDataModel {
	static migrateData(source) {
		migrateChoicesField(source.choices);
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:         new f.StringField({ nullable: true, initial: null }),
			description:  new f.StringField({ initial: "" }),
			instinct:     new f.ObjectField({ nullable: true, initial: null }),
			choices:      new f.ArrayField(new f.ObjectField()),
			choiceValues: new f.ObjectField(),
		};
	}
}
