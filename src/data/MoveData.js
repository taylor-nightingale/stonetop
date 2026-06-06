export class MoveData extends foundry.abstract.TypeDataModel {
	static migrateData(source) {
		if (source.choices?.list) {
			source.choices.list = source.choices.list.map(row => {
				if (row.type === "follower")
					return { ...row, type: "entry", followers: [row.slug],
						content: { title: null, text: row.title ?? "" } };
				if (row.type === "heading")
					return { ...row, type: "entry" };
				return row;
			});
		}
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			rollStat:    new f.StringField({ nullable: true, initial: null }),
			moveType:    new f.StringField({ nullable: true, initial: null }),
			description: new f.StringField({ initial: "" }),
			moveResults: new f.SchemaField({
				success: new f.SchemaField({ label: new f.StringField({ initial: "10+" }), value: new f.StringField({ initial: "" }) }),
				partial: new f.SchemaField({ label: new f.StringField({ initial: "7-9" }), value: new f.StringField({ initial: "" }) }),
				failure: new f.SchemaField({ label: new f.StringField({ initial: "6-"  }), value: new f.StringField({ initial: "" }) }),
			}),
			requirement: new f.SchemaField({
				moves:    new f.ArrayField(new f.StringField()),
				level:    new f.NumberField({ nullable: true, initial: null }),
				playbook: new f.StringField({ nullable: true, initial: null }),
			}),
			resource:       new f.ObjectField({ nullable: true, initial: null }),
			repeatMax:      new f.NumberField({ initial: 1, integer: true }),
			isStartingMove: new f.BooleanField({ initial: false }),
			playbook:       new f.StringField({ nullable: true, initial: null }),
			slug:           new f.StringField({ nullable: true, initial: null }),
			sortOrder:      new f.NumberField({ nullable: true, initial: null }),
			choices:       new f.ObjectField({ nullable: true, initial: null }),
			categoryKey:   new f.StringField({ nullable: true, initial: null }),
			categoryLabel: new f.StringField({ nullable: true, initial: null }),
			categoryNote:  new f.StringField({ nullable: true, initial: null }),
			compendiumId:  new f.StringField({ nullable: true, initial: null }),
			acquired:      new f.BooleanField({ initial: false }),
			instanceCount: new f.NumberField({ integer: true, initial: 0 }),
			pickValues:    new f.ObjectField(),
		};
	}
}
