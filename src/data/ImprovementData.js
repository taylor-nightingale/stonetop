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
			// six improvements the book gives a choice. Authored by hand on each improvement source and
			// checked by scripts/import/review-improvement-model.js. A nested term is written however it
			// reads best — a bare slug, a list, or a group; parseRequirement takes all three. Only the
			// value stored HERE has to be a group, because an ObjectField will not validate a string.
			requires:  new f.ObjectField({ nullable: true, initial: null }),

			// What the improvement DOES: each result, what has to be true for it to hold, and when it
			// fires. `requires` on a result narrows the improvement's own — Well-Trained Militia's
			// "+1 Defenses" waits on two trained tactics while its summer upkeep does not.
			effects:   new f.ArrayField(new f.SchemaField({
				requires:  new f.ObjectField({ nullable: true, initial: null }),
				// {kind, seasons, moment} and the book's own words for the trigger, in `phrase` — read
			// as one sentence with `text` on the improvement's own card, which is the one surface
			// with no season around it to have stated the trigger already.
			when:      new f.ObjectField({ nullable: true, initial: null }),
				text:      new f.StringField({ initial: "" }),
				// Whether the sheet can TELL that the clause in `when.phrase` holds — "as long as the
				// camp is in operation", "the market is active". A flag and not a sentence: the words
				// are the phrase's, and a result carrying this is stated and never applied.
				condition: new f.BooleanField({ initial: false }),
				change:    new f.ObjectField({ nullable: true, initial: null }),
				// A rating SET to a value rather than moved by one — Township's Size and Population.
				// Size is settable and never addable, so it can only ever appear here.
				set:       new f.ObjectField({ nullable: true, initial: null }),
				listEntry: new f.ObjectField({ nullable: true, initial: null }),
				adjustment: new f.ObjectField({ nullable: true, initial: null }),
				// The results of the season's OWN roll a result waits on, in the book's notation —
				// "if you roll a 7+ with Fortunes". Not a condition the sheet cannot evaluate but a
				// fact about the move's own roll, so the season's box prints it inside the result
				// rows it covers ("7+" being the 10+ row and the 7-9 row both).
				outcome:   new f.StringField({ initial: "" }),
				// A move slug — the improvement confers a move the table rolls (the Aurochs Hunt).
				grantsMove: new f.StringField({ initial: "" }),
				// `{moves: [slug]}` — moves this improvement says the steading rolls with advantage.
				// A reminder on those moves' rows and nothing more; the roll mode stays the table's.
				advantage: new f.ObjectField({ nullable: true, initial: null }),
			})),
		};
	}
}
