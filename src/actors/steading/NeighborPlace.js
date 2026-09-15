/**
 * One neighbouring place on a steading's row, or on the steadfast that defines it.
 *
 * Half definition, half record. A steadfast authors `name`, `subtitle`, `names` and `size`; the
 * table writes `note` and `travel`. Which half a field is in decides what happens to it when the
 * definition is corrected — see migrateNeighborPlaces, which puts the first half back in step and
 * leaves the second alone.
 *
 * `travel` is on this entity but not on a steadfast's schema: it is how far away the place is FROM
 * THIS STEADING, which a definition a dozen places sit at cannot state. Reading one off a steadfast
 * simply yields "".
 */
export class NeighborPlace {
	constructor(slug, name = "", subtitle = "", note = "", names = "", size = "", travel = "") {
		this.slug     = slug;
		this.name     = name;
		this.subtitle = subtitle;
		this.note     = note;
		this.names    = names;
		this.size     = size;
		this.travel   = travel;
	}

	withNote(note)     { return NeighborPlace.fromRaw({...this, note}); }
	withNames(names)   { return NeighborPlace.fromRaw({...this, names}); }
	withSize(size)     { return NeighborPlace.fromRaw({...this, size}); }
	withTravel(travel) { return NeighborPlace.fromRaw({...this, travel}); }

	static fromRaw(raw) {
		return new NeighborPlace(
			raw.slug ?? "", raw.name ?? "", raw.subtitle ?? "",
			raw.note ?? "", raw.names ?? "", raw.size ?? "", raw.travel ?? "",
		);
	}

	/**
	 * The row as the steadfast defines it, carrying forward whatever THIS table has already written
	 * against it — the one description of the three kinds of field, which both the apply path and the
	 * migration read rather than restating (they disagreed about `note`, and a re-apply blanked it).
	 *
	 * @param definition  the steadfast's row: name, subtitle, names and size, which it always wins.
	 * @param stored      the steading's own copy of that row, or nothing for one the steadfast has
	 *                    only just defined — whose record half is blank because this table has not
	 *                    written it yet, whatever the definition happens to carry in those fields.
	 */
	static fromDefinition(definition, stored = null) {
		const defined = NeighborPlace.fromRaw(definition);
		const record  = stored ? NeighborPlace.fromRaw(stored) : null;
		return NeighborPlace.fromRaw({
			...defined,
			// The table's own words. A steadfast never touches them.
			note:   record?.note ?? "",
			// Seeded: the book's printed time fills a blank, and never overwrites a measured one.
			travel: record?.travel.trim() || defined.travel,
		});
	}
}
