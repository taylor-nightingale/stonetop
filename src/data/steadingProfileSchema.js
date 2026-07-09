// The six steading ratings, as actual game numbers. Size is a named tier (hamlet/village/town/city)
// so it's a string; the ±N ratings are the numbers themselves; Surplus is a raw count. Used both for a
// steading's live `attributes` and the immutable `startingAttributes` baseline it keeps for the
// "Starts at …" notes. Returns FRESH field instances each call (Foundry can't share field instances).
export function steadingRatingsSchema(f) {
	return {
		fortunes:   new f.NumberField({ initial: 0, integer: true }),
		surplus:    new f.NumberField({ initial: 0, integer: true }),
		size:       new f.StringField({ initial: "" }),
		population: new f.NumberField({ initial: 0, integer: true }),
		prosperity: new f.NumberField({ initial: 0, integer: true }),
		defenses:   new f.NumberField({ initial: 0, integer: true }),
	};
}

// The shared "steading definition" shape, composed into BOTH SteadfastData (the template) and
// SteadingData (a live steading actor) so the two can't drift. A steadfast holds these as its
// starting values; applying it copies them onto the actor, which then edits its own copy in play.
// Returns FRESH field instances each call — Foundry SchemaFields can't share field instances.
export function steadingProfileSchema(f) {
	return {
		// The lists backing Prosperity/Defenses live under `assets` (resources / fortifications).
		attributes: new f.SchemaField(steadingRatingsSchema(f)),

		assets: new f.SchemaField({
			items:          new f.ArrayField(new f.StringField()),
			resources:      new f.ArrayField(new f.StringField()),  // what backs Prosperity
			fortifications: new f.ArrayField(new f.StringField()),  // what backs Defenses
			coinage:        new f.ArrayField(new f.SchemaField({
				title:    new f.StringField({ initial: "" }),
				purses:   new f.NumberField({ initial: 0, integer: true }),
				handfuls: new f.NumberField({ initial: 0, integer: true }),
				coins:    new f.NumberField({ initial: 0, integer: true }),
			})),
		}),

		placesOfInterest: new f.ArrayField(new f.SchemaField({
			name:             new f.StringField({ initial: "" }),
			journalReference: new f.StringField({ initial: "" }),
		})),

		neighborPlaces: new f.ArrayField(new f.SchemaField({
			slug:     new f.StringField({ initial: "" }),
			name:     new f.StringField({ initial: "" }),
			subtitle: new f.StringField({ initial: "" }),
			note:     new f.StringField({ initial: "" }),
			names:    new f.StringField({ initial: "" }),
		})),

		// The resident name/trait pool (suggestions for generating residents), not the residents
		// themselves — on a steading actor the actual people live in `residentPeople`.
		residents: new f.SchemaField({
			names:  new f.StringField({ initial: "" }),
			traits: new f.ArrayField(new f.StringField()),
		}),

		// Owned improvement slugs. On a steadfast: the improvements it grants. On a steading: the ones
		// it has (granted-on-apply, plus any wonder improvements dropped later). Track/pick state lives
		// alongside in the actor's `improvementValues`.
		improvements: new f.ArrayField(new f.StringField()),
	};
}
