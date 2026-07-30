import { migrateChoicesField } from "../migration/migrateChoices.js";

export class ArcanumData extends foundry.abstract.TypeDataModel {
	// Legacy arcana kept two per-group value stores (`unlockValues`, `backChoiceValues`), both keyed by
	// the arcanum slug — which is also each group's own slug (see pack data + migrateArcanumChoiceGroupSlugs).
	// Every choice group now reads/writes the ONE `choiceValues` store by its own slug (the generic path
	// inserts use), so fold the legacy stores into it. Runs on raw source before schema cleaning; guarded on
	// the legacy keys being present, so it never clobbers a plain `choiceValues` edit diff.
	static migrateData(source) {
		// Both sides now carry a `choices` array of groups (no `unlock` / `description` / `unlockAt`). Fold
		// legacy fields into it. Every step is guarded on the field being present in `source`, so a partial
		// update diff that omits front/back is never touched (the migrate-on-diff landmine), and each
		// conversion is idempotent (shape-checked).
		// The front no longer has a title of its own (the document name is its heading), and
		// `_frontFollower` is transient import-parser state that leaked into some pack data — drop both.
		if (source?.front && typeof source.front === "object") {
			delete source.front.title;
			delete source.front._frontFollower;
		}
		for (const side of [source?.front, source?.back]) {
			if (!side || typeof side !== "object") continue;
			// Legacy single `unlock` group (front) → become `choices`.
			if (side.unlock && side.choices == null) { side.choices = side.unlock; delete side.unlock; }
			// Wrap a stray single-group `choices` object into an array.
			if (side.choices && !Array.isArray(side.choices)) side.choices = [side.choices];
			// Legacy `consequences` group (back) → append to `choices` (now an array).
			if (side.consequences) { (side.choices ??= []).push({ ...side.consequences, title: side.consequences.title ?? "Consequences" }); delete side.consequences; }
			// A `description` string → a leading content entry (once — guarded on the string still present).
			if (typeof side.description === "string" && side.description) {
				side.choices ??= [{ slug: source.slug ?? "choices", list: [] }];
				(side.choices[0].list ??= []).unshift({ type: "entry", content: { title: null, text: side.description } });
			}
			delete side.description;
			delete side.unlockAt;
			// Normalize row shapes (row types, follower→grants wiring) across the groups.
			if (side.choices) migrateChoicesField(side.choices);
		}
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
