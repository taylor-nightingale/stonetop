export class InsertData extends foundry.abstract.TypeDataModel {
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
