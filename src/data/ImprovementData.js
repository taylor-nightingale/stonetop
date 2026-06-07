export class ImprovementData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:      new f.StringField({ nullable: true, initial: null }),
			sortOrder: new f.NumberField({ nullable: true, initial: null }),
			choices:   new f.ObjectField({ nullable: true, initial: null }),
		};
	}
}
