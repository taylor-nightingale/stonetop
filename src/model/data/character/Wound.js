/**
 * A problematic wound: a lasting hurt that is neither hit points nor a debility. Authored in play —
 * nothing lists wounds — and it states no mechanical effect, so a name and a state are all it has.
 */
export class Wound {
	static STATES = ["active", "stabilized", "permanent"];

	constructor(id, name = "", state = "active") {
		this.id    = id;
		this.name  = name;
		this.state = state;
	}

	static named(id, name = "") {
		return new Wound(id, name);
	}

	static fromRaw(raw) {
		return new Wound(raw.id, raw.name, raw.state);
	}

	/** Named at all: the editor's + writes an empty line to type into, and that ails nobody. */
	get isNamed() {
		return (this.name ?? "").trim() !== "";
	}

	withName(name)   { return new Wound(this.id, name, this.state); }
	withState(state) { return new Wound(this.id, this.name, state); }

	withNextState() {
		const states = Wound.STATES;
		return this.withState(states[(states.indexOf(this.state) + 1) % states.length]);
	}

	toRaw() {
		return { id: this.id, name: this.name, state: this.state };
	}
}
