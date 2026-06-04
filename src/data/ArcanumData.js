export class ArcanumData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			weight:      new f.NumberField({ initial: 1, integer: true }),
			description: new f.StringField({ initial: "" }),
			slug:        new f.StringField({ nullable: true, initial: null }),
			sortOrder:   new f.NumberField({ nullable: true, initial: null }),
			major:       new f.BooleanField({ initial: false }),
			front:       new f.ObjectField({ nullable: true, initial: null }),
			back:        new f.ObjectField({ nullable: true, initial: null }),
		};
	}
}
