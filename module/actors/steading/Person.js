function _uid() {
	return Math.random().toString(36).slice(2, 10);
}

export class Person {
	constructor(id, name = "", occupation = "", traits = "", home = null) {
		this.id = id;
		this.name = name;
		this.occupation = occupation;
		this.traits = traits;
		if (home !== null) this.home = home;
	}

	withName(name)             { return Person.fromRaw({...this, name}); }
	withOccupation(occupation) { return Person.fromRaw({...this, occupation}); }
	withTraits(traits)         { return Person.fromRaw({...this, traits}); }
	withHome(home)             { return Person.fromRaw({...this, home}); }

	static blank() {
		return new Person(_uid());
	}

	static blankNeighbor() {
		return new Person(_uid(), "", "", "", "");
	}

	static fromRaw(raw) {
		return new Person(raw.id, raw.name ?? "", raw.occupation ?? "", raw.traits ?? "", raw.home ?? null);
	}
}
