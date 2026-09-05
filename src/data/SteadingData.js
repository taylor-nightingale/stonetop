import { steadingProfileSchema, steadingRatingsSchema } from "./steadingProfileSchema.js";
import { migrateSteadingShape } from "../migration/migrateSteadingShape.js";
import { Seasons } from "../model/data/steading/Seasons.js";

// A steading actor. It is generic — a blank steading is an EMPTY place. It receives its starting
// values by applying a steadfast (applySteadfast / the create hook copies the steadfast's profile
// onto it and records which one in `steadfast`). The definition fields are the shared
// steadingProfileSchema, so a steading and its steadfast can never drift; on top of those the actor
// carries its own in-play state: which steadfast it came from, free-text, debilities, content policy,
// the actual people of and around it (`folk` — distinct from the name/trait pool), and improvement
// pick state.
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

			// Where the wheel stands, and how many times it has come round. In-play state like the
			// debilities below it, not part of the shared profile a steadfast defines — a steadfast
			// describes a place, not a moment in its year. Advanced only on the Season tab, because
			// advancing runs the whole turnover; every other surface displays it and nothing more.
			season: new f.StringField({ initial: Seasons.DEFAULT }),
			year:   new f.NumberField({ initial: 1, integer: true, min: 1 }),
			// The impression the wheel stamped on this season — one line drawn from the steadfast's
			// list when the season turned. Stored rather than picked at render: six people have this
			// sheet open, and a line re-rolled per client per render is a different season to each of
			// them. Blank until the first turn, and blank forever for a steading with no impressions.
			seasonImpression: new f.StringField({ initial: "" }),

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

			// Runtime-only instances + pick state (not part of the shared definition a steadfast holds).
			// One roster: residents and neighbours differ only by the home written on the row, and a
			// blank home means this steading (see Folk.js). The people, not the name/trait pool —
			// that is `residents`.
			folk:              new f.ArrayField(new f.ObjectField()),
			improvementValues: new f.ObjectField(),                    // track/pick state, keyed by group slug
			// Lines the table opted OUT of before applying a statement, keyed by line id. Season-scoped:
			// cleared when the wheel turns, because the statement it belonged to is gone.
			turnoverExcluded:  new f.ObjectField(),
			// What has already been written this season — `{turn: true}` — so the second person to
			// press Apply on a sheet six people share does not pay the season twice. Season-scoped.
			turnoverApplied:   new f.ObjectField(),
			// Which improvements have had their completion results applied, keyed by slug. DURABLE and
			// not season-scoped — an improvement is finished once, and its +1 Fortunes is not owed
			// again next spring. It is also what stops the board card asking twice on a sheet six
			// people are looking at.
			improvementsApplied: new f.ObjectField(),
			choiceValues:      new f.ObjectField(),                    // choice-group picks, keyed by group slug
		};
	}
}
