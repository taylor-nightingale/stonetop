/** A fresh person id. Exported so the migration can stamp one onto a legacy row that has none. */
export function newPersonId() {
	return Math.random().toString(36).slice(2, 10);
}

export class Person {
	constructor(id, name = "", occupation = "", traits = "", home = "", linkUuid = null) {
		this.id = id;
		this.name = name;
		this.occupation = occupation;
		this.traits = traits;
		// Where they live. Blank is not "unknown" — it means the steading itself, which is what lets
		// residents and neighbours share one roster and one column.
		this.home = home;
		// A link to any document this person represents (an NPC actor, a journal entry, an item…),
		// stored as a bare uuid. Only present when set, so an unlinked person carries no key.
		if (linkUuid) this.linkUuid = linkUuid;
	}

	withName(name)             { return Person.fromRaw({...this, name}); }
	withOccupation(occupation) { return Person.fromRaw({...this, occupation}); }
	withTraits(traits)         { return Person.fromRaw({...this, traits}); }
	withHome(home)             { return Person.fromRaw({...this, home}); }

	/**
	 * The same person with `home` written on their row ONLY if nothing is written there yet.
	 *
	 * A default, not an override. Clicking a name off Marshedge's list says where that name comes
	 * from, which is worth writing down for someone who has no home yet — and worth nothing against
	 * someone whose row already says where they live, where it would be a silent correction of
	 * something the table decided on purpose. Blank means this steading (see `home`), so a resident
	 * given a Marshedge name is a resident until somebody says otherwise.
	 */
	withHomeIfUnset(home) {
		const addition = (home ?? "").trim();
		if (!addition || (this.home ?? "").trim()) return this;
		return this.withHome(addition);
	}
	withLink(linkUuid)         { return Person.fromRaw({...this, linkUuid}); }
	withoutLink()              { return Person.fromRaw({...this, linkUuid: null}); }

	/**
	 * The same person with one more trait written on their row.
	 *
	 * Traits are one free-text field holding a comma-separated list — that is what the book's sheet
	 * prints and what a GM types into — so appending is a string join, not a push. A trait already on
	 * the row is not repeated: clicking the same entry twice in the reference list is a slip, and the
	 * list dims used entries precisely so it reads as one.
	 */
	withTraitAdded(trait) {
		const addition = (trait ?? "").trim();
		if (!addition) return this;
		if (Person.traitTokens(this.traits).some(t => t.toLowerCase() === addition.toLowerCase())) return this;
		const existing = (this.traits ?? "").trim().replace(/,$/, "");
		return this.withTraits(existing ? `${existing}, ${addition}` : addition);
	}

	/** The traits written on a row, as the separate things they are. */
	static traitTokens(traits) {
		return (traits ?? "").split(",").map(t => t.trim()).filter(Boolean);
	}

	/**
	 * The bare name, without the parenthetical a roster row usually carries — "Bryn (she/her)" is
	 * Bryn. Asked when matching a row against the book's name lists, which print names alone.
	 */
	get bareName() {
		return (this.name ?? "").replace(/\s*\(.*$/, "").trim();
	}

	static blank() {
		return new Person(newPersonId());
	}

	static named(name, home = "") {
		return new Person(newPersonId(), name, "", "", home);
	}

	// `raw.id` is taken as it stands, never defaulted: this runs on every read of the stored list, so
	// minting one here would hand the same person a new identity on every render. A legacy row with no
	// id gets one once, in the migration.
	static fromRaw(raw) {
		return new Person(raw.id, raw.name ?? "", raw.occupation ?? "", raw.traits ?? "", raw.home ?? "", raw.linkUuid ?? null);
	}
}
