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
			// Moves referenced by slug (resolved across compendium + world). Custom inserts attach
			// existing moves this way instead of copying/re-tagging them. Built-in inserts still
			// associate their moves by tag (`move.system.playbook === slug`); both are unioned.
			moves:        new f.ArrayField(new f.StringField()),
			choiceValues: new f.ObjectField(),
		};
	}
}
