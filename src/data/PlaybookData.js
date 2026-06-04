export class PlaybookData extends foundry.abstract.TypeDataModel {
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
			instinct:           new f.ObjectField({ nullable: true, initial: null }),
			appearance:         new f.ObjectField({ nullable: true, initial: null }),
			origin:             new f.ArrayField(new f.ObjectField()),
			specialPossessions: new f.ObjectField({ nullable: true, initial: null }),
			lore:               new f.ArrayField(new f.ObjectField()),
			introductions:      new f.ArrayField(new f.ObjectField()),
		};
	}
}
