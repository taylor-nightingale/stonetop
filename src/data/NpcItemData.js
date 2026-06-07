export class NpcItemData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:            new f.StringField({ nullable: true, initial: null }),
			arcanaSlug:      new f.StringField({ nullable: true, initial: null }),
			owned:           new f.BooleanField({ initial: false }),
			tags:            new f.StringField({ initial: "" }),
			choiceValues:    new f.ObjectField({ initial: {} }),
			hp:              new f.SchemaField({
				value: new f.NumberField({ initial: 0, integer: true }),
				min:   new f.NumberField({ initial: 0, integer: true }),
				max:   new f.NumberField({ initial: 0, integer: true }),
			}),
			armor:           new f.SchemaField({
				value: new f.NumberField({ initial: 0, integer: true }),
				note:  new f.StringField({ initial: "" }),
			}),
			damage:          new f.SchemaField({
				die:   new f.StringField({ nullable: true, initial: null }),
				label: new f.StringField({ initial: "" }),
				tags:  new f.StringField({ initial: "" }),
			}),
			specialQualities: new f.StringField({ initial: "" }),
			instinct:         new f.StringField({ initial: "" }),
			loyalty:          new f.SchemaField({
				value: new f.NumberField({ initial: 0, integer: true }),
				max:   new f.NumberField({ initial: 3, integer: true }),
			}),
			choices:          new f.ArrayField(new f.ObjectField(), { initial: [] }),
			description:      new f.StringField({ initial: "" }),
		};
	}
}
