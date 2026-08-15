export class OutfitItemData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:            new f.StringField({ nullable: true, initial: null }),
			inventoryColumn: new f.StringField({ nullable: true, initial: null }),
			weight:          new f.NumberField({ initial: 1, integer: true }),
			// `tagList`, not `tags`: Foundry reserves the item field `system.tags` and wipes it on
			// every update (see creature.js / follower-data-architecture). Outfit tags are display-
			// only markdown, so a plain StringField is enough (unlike the editable Selection on NPCs).
			tagList:         new f.StringField({ initial: "" }),
			note:            new f.StringField({ initial: "" }),
			resource:        new f.ObjectField({ nullable: true, initial: null }),
			twoCol:          new f.BooleanField({ initial: false }),
			// Outfit rows render in compendium order (then world items) — there is no sort field.
			armor:           new f.ObjectField({ nullable: true, initial: null }),
			// Legacy provenance. Nothing writes it any more — a granted item carries its source in
			// `flags.stonetop.grant` — but the grant-stamp migration reads it off worlds made before that,
			// so it stays declared until those are all converted.
			source:          new f.StringField({ nullable: true, initial: null }),
		};
	}
}
