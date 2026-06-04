export class OutfitItemData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:            new f.StringField({ nullable: true, initial: null }),
			inventoryColumn: new f.StringField({ nullable: true, initial: null }),
			weight:          new f.NumberField({ initial: 1, integer: true }),
			tags:            new f.StringField({ initial: "" }),
			note:            new f.StringField({ initial: "" }),
			resource:        new f.ObjectField({ nullable: true, initial: null }),
			twoCol:          new f.BooleanField({ initial: false }),
			sortOrder:       new f.NumberField({ nullable: true, initial: null }),
			armor:           new f.ObjectField({ nullable: true, initial: null }),
			source:          new f.StringField({ nullable: true, initial: null }),
		};
	}
}
