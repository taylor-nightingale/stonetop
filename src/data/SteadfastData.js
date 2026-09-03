import { steadingProfileSchema } from "./steadingProfileSchema.js";
import { healAssets } from "../migration/migrateSteadingShape.js";

// A Steadfast is the *definition* of a place (Stonetop, Barrier Pass): the starting values a steading
// begins with plus the improvements it grants. A steading actor sits at a steadfast (its
// `system.steadfast` records the slug) and copies these as its starting defaults — the
// playbook→character analogy. The definition fields are the shared steadingProfileSchema, so the
// steadfast and the steading actor can never drift apart; a steadfast just adds catalog fields
// (slug/sortOrder/description). The blank schema is an empty place; authored values live in the pack
// item (packs/src/steadfasts/stonetop.json).
export class SteadfastData extends foundry.abstract.TypeDataModel {
	// A pre-1.6.0 steadfast holds `assets.items` as bare strings, which now fail SchemaField
	// validation — heal here, pre-validation, exactly as SteadingData does for the actor.
	static migrateData(source) {
		source.assets = healAssets(source.assets);
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:        new f.StringField({ nullable: true, initial: null }),
			sortOrder:   new f.NumberField({ nullable: true, initial: null, integer: true }),
			description: new f.StringField({ initial: "" }),
			...steadingProfileSchema(f),
		};
	}
}
