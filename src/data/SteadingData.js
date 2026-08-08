import { steadingProfileSchema, steadingRatingsSchema } from "./steadingProfileSchema.js";
import { migrateSteadingShape } from "../migration/migrateSteadingShape.js";

// A steading actor. It is generic — a blank steading is an EMPTY place. It receives its starting
// values by applying a steadfast (applySteadfast / the create hook copies the steadfast's profile
// onto it and records which one in `steadfast`). The definition fields are the shared
// steadingProfileSchema, so a steading and its steadfast can never drift; on top of those the actor
// carries its own in-play state: which steadfast it came from, free-text, debilities, content policy,
// the actual resident/neighbor people (distinct from the name/trait pool), and improvement pick state.
export class SteadingData extends foundry.abstract.TypeDataModel {
	// Pre-0.13.0 sources fail schema validation outright (ratings were {current, items} objects) —
	// heal the shape here, pre-validation, or the actor is quarantined before the MigrationRunner
	// can ever see it. Runs on update diffs too, so the heal transforms present keys only.
	static migrateData(source) {
		return super.migrateData(migrateSteadingShape(source));
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			steadfast:   new f.StringField({ initial: "" }),
			description: new f.StringField({ initial: "" }),
			notes:       new f.StringField({ initial: "" }),
			rollMode:    new f.StringField({ initial: "normal" }),

			// Per-move resource state (checked counts + fill-in text) for homefront moves, keyed by
			// slug under the "moves" namespace — same shape/section a character uses (ResourceController).
			resources:   new f.SchemaField({ counts: new f.ObjectField(), texts: new f.ObjectField() }),

			debilities: new f.SchemaField({
				diminished: new f.BooleanField({ initial: false }),
				lacking:    new f.BooleanField({ initial: false }),
				malcontent: new f.BooleanField({ initial: false }),
			}),
			content: new f.SchemaField({
				excluded:            new f.ArrayField(new f.StringField()),
				veiled:              new f.ArrayField(new f.StringField()),
				specialHandling:     new f.ArrayField(new f.StringField()),
				excludedText:        new f.StringField({ initial: "" }),
				veiledText:          new f.StringField({ initial: "" }),
				specialHandlingText: new f.StringField({ initial: "" }),
			}),

			...steadingProfileSchema(f),

			// The immutable starting ratings copied from the steadfast on apply — the baseline the
			// "Starts at …" notes read, so they stay correct even after `attributes` are edited in play.
			startingAttributes: new f.SchemaField(steadingRatingsSchema(f)),

			// What the table recorded during "Let Spring Break Forth", the last beat of session zero
			// (Book I, p.30). `gains` is a presence map of picked seasonal-gain keys; `excites` holds
			// one answer per player character, keyed by actor id. `done` collapses the section once
			// the first session is behind them.
			firstSession: new f.SchemaField({
				hopeful: new f.StringField({ initial: "" }),
				hook:    new f.StringField({ initial: "" }),
				excites: new f.ObjectField(),
				done:    new f.BooleanField({ initial: false }),
			}),

			// Runtime-only instances + pick state (not part of the shared definition a steadfast holds).
			residentPeople:    new f.ArrayField(new f.ObjectField()),  // the actual people (pool → residents)
			neighborPeople:    new f.ArrayField(new f.ObjectField()),
			improvementValues: new f.ObjectField(),                    // track/pick state, keyed by group slug
			choiceValues:      new f.ObjectField(),                    // choice-group picks, keyed by group slug
		};
	}
}
