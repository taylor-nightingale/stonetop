export class PossessionData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:        new f.StringField({ nullable: true, initial: null }),
			label:       new f.StringField({ initial: "" }),
			description: new f.StringField({ initial: "" }),
			resource:    new f.ObjectField({ nullable: true, initial: null }),
			outfitItems: new f.ArrayField(new f.ObjectField()),
			choices:     new f.ObjectField({ nullable: true, initial: null }),
			scaling:     new f.ObjectField({ nullable: true, initial: null }),
			sortOrder:   new f.NumberField({ nullable: true, initial: null }),
		};
	}
}
