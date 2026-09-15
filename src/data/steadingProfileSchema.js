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

// One neighbouring place. Every field is here, on the shared shape, but they are not all the same
// KIND of thing, and what a steadfast is allowed to do to each is what separates them:
//
//   synced  name, subtitle, names, size — the definition. The steadfast always wins.
//   seeded  travel — the steadfast fills a blank and never overwrites a written one.
//   record  note — the table's own. A steadfast never touches it.
//
// applySteadfast and migrateNeighborPlaces both apply exactly that, which is what keeps a
// correction to the book reaching every world while nothing the table wrote is ever lost.
//
// Travel is only meaningful as "from HERE", and here is whichever place the rows hang off — so it
// reads as a property of the steadfast that owns them rather than of the neighbour named in one.
// That holds because build-steadfasts.js writes `neighborPlaces: []` for every steadfast it
// generates: Stonetop's is the only one with rows at all, so the only travel times that can exist
// are Stonetop's, which is precisely what the book prints.
export function neighborPlaceFields(f) {
	return {
		slug:     new f.StringField({ initial: "" }),
		name:     new f.StringField({ initial: "" }),
		subtitle: new f.StringField({ initial: "" }),
		note:     new f.StringField({ initial: "" }),
		names:    new f.StringField({ initial: "" }),
		// The book's own tier word for the place ("town"), or "" where it names none — the groupings
		// among Stonetop's neighbours are regions, not steadings, and have no size.
		size:     new f.StringField({ initial: "" }),
		// How long the journey takes, in the book's own words. Free text because the GM playbook's
		// Travel Times table prints plain durations ("4 days", "3-4 hours") and a route is really a
		// Chart a Course answer that moves with the season anyway.
		travel:   new f.StringField({ initial: "" }),
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
			// A general asset is property that can leave town, so it carries whether it currently has
			// (see Asset.js). Resources and fortifications stay plain strings: they are evidence for a
			// rating, not things to requisition.
			items:          new f.ArrayField(new f.SchemaField({
				text:          new f.StringField({ initial: "" }),
				requisitioned: new f.BooleanField({ initial: false }),
			})),
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
			name:     new f.StringField({ initial: "" }),
			// A linked document (journal / actor / item …), stored as a bare uuid; "" when unlinked.
			linkUuid: new f.StringField({ initial: "" }),
		})),

		neighborPlaces: new f.ArrayField(new f.SchemaField(neighborPlaceFields(f))),

		// The resident name/trait pool (suggestions for generating residents), not the residents
		// themselves — on a steading actor the actual people live in `folk`.
		residents: new f.SchemaField({
			names:  new f.StringField({ initial: "" }),
			traits: new f.ArrayField(new f.StringField()),
		}),

		// What this place is like in each season, in the book's own words (Book II's "Impressions"
		// section, lifted by scripts/import/build-steading-impressions.js). Flat and season-tagged
		// rather than a field per season, so nothing downstream has to spell the four keys. Empty for
		// every steading whose article prints no such section.
		impressions: new f.ArrayField(new f.SchemaField({
			season: new f.StringField({ initial: "" }),
			text:   new f.StringField({ initial: "" }),
		})),

		// Owned improvement slugs. On a steadfast: the improvements it grants. On a steading: the ones
		// it has (granted-on-apply, plus any wonder improvements dropped later). Track/pick state lives
		// alongside in the actor's `improvementValues`.
		improvements: new f.ArrayField(new f.StringField()),
	};
}
