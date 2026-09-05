import { migrateChoicesField } from "../migration/migrateChoices.js";

export class ImprovementData extends foundry.abstract.TypeDataModel {
	static migrateData(source) {
		migrateChoicesField(source.choices);
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:      new f.StringField({ nullable: true, initial: null }),
			sortOrder: new f.NumberField({ nullable: true, initial: null }),
			choices:   new f.ObjectField({ nullable: true, initial: null }),
			// What the improvement takes to build, as an expression over its own requirement-row slugs
			// — `{all: [...]}` / `{any: 2, of: [...]}`, nesting freely. An ObjectField because the shape
			// is recursive, which a SchemaField cannot describe.
			//
			// The book states this in prose above each list ("Requires 1 of the following:") and the
			// rows record only the boxes, so completion used to be "every box ticked" — wrong for the
			// six improvements the book gives a choice. Authored in data/improvement-effects.json and
			// merged by scripts/import/build-improvement-effects.js.
			requires:  new f.ObjectField({ nullable: true, initial: null }),

			// What the improvement DOES: each result, what has to be true for it to hold, and when it
			// fires. `requires` on a result narrows the improvement's own — Well-Trained Militia's
			// "+1 Defenses" waits on two trained tactics while its summer upkeep does not.
			effects:   new f.ArrayField(new f.SchemaField({
				requires:  new f.ObjectField({ nullable: true, initial: null }),
				when:      new f.ObjectField({ nullable: true, initial: null }),
				text:      new f.StringField({ initial: "" }),
				condition: new f.StringField({ initial: "" }),
				change:    new f.ObjectField({ nullable: true, initial: null }),
				listEntry: new f.ObjectField({ nullable: true, initial: null }),
				adjustment: new f.ObjectField({ nullable: true, initial: null }),
				// A move slug — the improvement confers a move the table rolls (the Aurochs Hunt).
				grantsMove: new f.StringField({ initial: "" }),
			})),
		};
	}
}
