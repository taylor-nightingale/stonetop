import { tagListField } from "./tagFields.js";
import { migrateTagsOn } from "../migration/migrateTags.js";

export class OutfitItemData extends foundry.abstract.TypeDataModel {
	// Tags used to be a comma string here and a nested `tags` key on arcana/possessions. They are one
	// concept in the book, so they are one stored shape now — see src/migration/migrateTags.js.
	// Guarded on the key being present: migrateData also runs on the partial update diff.
	static migrateData(source) {
		migrateTagsOn(source);
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:            new f.StringField({ nullable: true, initial: null }),
			inventoryColumn: new f.StringField({ nullable: true, initial: null }),
			weight:          new f.NumberField({ initial: 1, integer: true }),
			// The Value the book prints beside the item in its Common/Special items table (p. 94-97)
			// — what Trade & Barter subtracts from the roll. Null for an item the book never priced
			// (anything authored in-world), which is why it is nullable rather than defaulting to 0.
			value:           new f.NumberField({ nullable: true, initial: null, integer: true, min: 0 }),
			// One tag model across gear, creatures and group members: an ordered list of tokens.
			// `tagList`, not `tags` — Foundry reserves the item field `system.tags` (tagFields.js).
			tagList:         tagListField(),
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
