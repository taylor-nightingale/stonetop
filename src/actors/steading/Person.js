function _uid() {
	return Math.random().toString(36).slice(2, 10);
}

export class Person {
	constructor(id, name = "", occupation = "", traits = "", home = null, linkUuid = null) {
		this.id = id;
		this.name = name;
		this.occupation = occupation;
		this.traits = traits;
		if (home !== null) this.home = home;
		// A link to any document this person represents (an NPC actor, a journal entry, an item…),
		// stored as a bare uuid. Only present when set, so an unlinked person carries no key (mirrors
		// the optional `home`).
		if (linkUuid) this.linkUuid = linkUuid;
	}

	withName(name)             { return Person.fromRaw({...this, name}); }
	withOccupation(occupation) { return Person.fromRaw({...this, occupation}); }
	withTraits(traits)         { return Person.fromRaw({...this, traits}); }
	withHome(home)             { return Person.fromRaw({...this, home}); }
	withLink(linkUuid)         { return Person.fromRaw({...this, linkUuid}); }
	withoutLink()              { return Person.fromRaw({...this, linkUuid: null}); }

	static blank() {
		return new Person(_uid());
	}

	static blankNeighbor() {
		return new Person(_uid(), "", "", "", "");
	}

	static fromRaw(raw) {
		return new Person(raw.id, raw.name ?? "", raw.occupation ?? "", raw.traits ?? "", raw.home ?? null, raw.linkUuid ?? null);
	}
}
