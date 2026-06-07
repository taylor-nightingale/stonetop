const statField = () => {
	const f = foundry.data.fields;
	return new f.SchemaField({ value: new f.NumberField({ initial: 0 }) });
};

export class CharacterData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			description:  new f.StringField({ initial: "" }),
			notes:        new f.StringField({ initial: "" }),
			playbookSlug: new f.StringField({ initial: "" }),
			inventory: new f.SchemaField({
				checked:     new f.ObjectField(),
				loadLevel:   new f.StringField({ nullable: true, initial: null }),
				regularPool: new f.NumberField({ initial: 0, integer: true }),
				smallPool:   new f.NumberField({ initial: 0, integer: true }),
				otherItems:  new f.StringField({ initial: "" }),
			}),
			background:        new f.SchemaField({ selected: new f.StringField({ initial: "" }) }),
			instinct:          new f.SchemaField({ custom:   new f.StringField({ initial: "" }) }),
			origin:            new f.SchemaField({ selected: new f.StringField({ initial: "" }) }),
			lore:              new f.SchemaField({ values:   new f.ObjectField() }),
			choices:           new f.SchemaField({ values: new f.ObjectField(), groupDefs: new f.ObjectField() }),
			resources:         new f.SchemaField({ counts: new f.ObjectField() }),
			moveResources:     new f.SchemaField({ counts: new f.ObjectField() }),
			stats: new f.SchemaField({
				str: statField(), dex: statField(), con: statField(),
				int: statField(), wis: statField(), cha: statField(),
			}),
			attributes: new f.SchemaField({
				level: new f.NumberField({ initial: 1, min: 1, integer: true }),
				hp: new f.SchemaField({
					value: new f.NumberField({ initial: 0, min: 0, integer: true }),
					max:   new f.NumberField({ initial: 0, min: 0, integer: true }),
				}),
				armor: new f.NumberField({ initial: 0, min: 0, integer: true }),
				xp: new f.SchemaField({
					value: new f.NumberField({ initial: 0, min: 0, integer: true }),
				}),
				damage: new f.SchemaField({
					value: new f.StringField({ nullable: true, initial: null }),
				}),
				debilities: new f.SchemaField({
					options: new f.SchemaField({
						weakened:  new f.SchemaField({ value: new f.BooleanField({ initial: false }) }),
						dazed:     new f.SchemaField({ value: new f.BooleanField({ initial: false }) }),
						miserable: new f.SchemaField({ value: new f.BooleanField({ initial: false }) }),
					}),
				}),
			}),
		};
	}
}
