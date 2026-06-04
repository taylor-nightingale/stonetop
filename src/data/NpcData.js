export class NpcData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			description:    new f.StringField({ initial: "" }),
			notes:          new f.StringField({ initial: "" }),
			hp:             new f.NumberField({ initial: 0, min: 0, integer: true }),
			maxHp:          new f.NumberField({ initial: 0, min: 0, integer: true }),
			armor:          new f.NumberField({ initial: 0, min: 0, integer: true }),
			damage:         new f.StringField({ initial: "d6" }),
			specialQuality: new f.StringField({ initial: "" }),
			instinct:       new f.StringField({ initial: "" }),
		};
	}
}
