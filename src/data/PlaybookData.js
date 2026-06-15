import { migrateChoicesField } from "../migration/migrateChoices.js";

export class PlaybookData extends foundry.abstract.TypeDataModel {
	static migrateData(source) {
		migrateChoicesField(source.choices);
		migrateChoicesField(source.specialPossessions);
		// Introductions steps 4 & 6 are choice groups (NPC/PC question rows); step3 is a string.
		migrateChoicesField(source.introductions?.step4);
		migrateChoicesField(source.introductions?.step6);
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:               new f.StringField({ nullable: true, initial: null }),
			actorType:          new f.StringField({ nullable: true, initial: null }),
			description:        new f.StringField({ initial: "" }),
			hp:                 new f.NumberField({ initial: 0, integer: true }),
			damage:             new f.SchemaField({ value: new f.StringField({ nullable: true, initial: null }) }),
			statsNote:          new f.StringField({ initial: "" }),
			startingMovesNote:  new f.StringField({ initial: "" }),
			backgrounds:        new f.ArrayField(new f.ObjectField()),
			origin:             new f.ArrayField(new f.ObjectField()),
			// The playbook is the source of truth for what it auto-adds (follower-data-architecture
			// §4): follower & insert slugs granted on select, removed on swap.
			followers:          new f.ArrayField(new f.StringField()),
			inserts:            new f.ArrayField(new f.StringField()),
			specialPossessions: new f.ObjectField({ nullable: true, initial: null }),
			instinct:           new f.ObjectField({ nullable: true, initial: null }),
			appearance:         new f.ObjectField({ nullable: true, initial: null }),
			choices:            new f.ArrayField(new f.ObjectField()),
			choiceValues:       new f.ObjectField(),
			introductions:      new f.ObjectField({ nullable: true, initial: null }),
			instinctValues:     new f.ObjectField(),
			appearanceValues:   new f.ObjectField(),
			backgroundValues:   new f.ObjectField(),
		};
	}
}
