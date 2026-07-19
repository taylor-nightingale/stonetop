import { migrateChoicesField } from "../migration/migrateChoices.js";

export class ArcanumData extends foundry.abstract.TypeDataModel {
	// Legacy arcana kept two per-group value stores (`unlockValues`, `backChoiceValues`), both keyed by
	// the arcanum slug — which is also each group's own slug (see pack data + migrateArcanumChoiceGroupSlugs).
	// Every choice group now reads/writes the ONE `choiceValues` store by its own slug (the generic path
	// inserts use), so fold the legacy stores into it. Runs on raw source before schema cleaning; guarded on
	// the legacy keys being present, so it never clobbers a plain `choiceValues` edit diff.
	static migrateData(source) {
		// Normalize the choice groups riding in the opaque front/back objects (row shapes, follower
		// wiring — see migrateChoiceRow). Guarded on each group being present in `source`, so a partial
		// update diff that omits front/back is never touched (the migrate-on-diff landmine).
		if (source?.front?.unlock) migrateChoicesField(source.front.unlock);
		if (source?.back?.choices) migrateChoicesField(source.back.choices);
		if (source?.back?.consequences) migrateChoicesField(source.back.consequences);
		if (source && (source.unlockValues !== undefined || source.backChoiceValues !== undefined)) {
			const merged = { ...(source.choiceValues ?? {}) };
			for (const store of [source.unlockValues, source.backChoiceValues]) {
				for (const [groupSlug, opts] of Object.entries(store ?? {})) {
					merged[groupSlug] = { ...(merged[groupSlug] ?? {}), ...(opts ?? {}) };
				}
			}
			source.choiceValues = merged;
			delete source.unlockValues;
			delete source.backChoiceValues;
		}
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			weight:      new f.NumberField({ initial: 1, integer: true }),
			description: new f.StringField({ initial: "" }),
			slug:        new f.StringField({ nullable: true, initial: null }),
			sortOrder:   new f.NumberField({ nullable: true, initial: null }),
			major:            new f.BooleanField({ initial: false }),
			front:            new f.ObjectField({ nullable: true, initial: null }),
			back:             new f.ObjectField({ nullable: true, initial: null }),
			flipped:          new f.BooleanField({ initial: false }),
			choiceValues:     new f.ObjectField({ initial: {} }),
		};
	}
}
