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

	// PBTA template.json stored hp as {value, min, max} and armor as {value, note}.
	// Coerce to flat numbers before schema validation so the actor can initialize.
	static migrateData(source) {
		if (source.hp != null && typeof source.hp === "object")
			source.hp = source.hp.value ?? 0;
		if (source.armor != null && typeof source.armor === "object")
			source.armor = source.armor.value ?? 0;
		return super.migrateData(source);
	}
}
