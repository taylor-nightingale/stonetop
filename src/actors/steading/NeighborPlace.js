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
}
