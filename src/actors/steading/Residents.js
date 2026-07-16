import {PersonList} from "./PersonList.js";
import {Person} from "./Person.js";

export class Residents {
	constructor(actor) {
		this._actor = actor;
		this._list  = new PersonList(actor, "residentPeople");
	}

	// The "one trait per line" source textarea that feeds the resident-traits pool. Owns the parse:
	// blank lines and surrounding whitespace are dropped.
	async updateTraitsSource(rawText) {
		const traits = (rawText ?? "").split("\n").map(t => t.trim()).filter(Boolean);
		await this._actor.update({ "system.residents.traits": traits });
	}

	async add() {
		await this._list.add(Person.blank());
	}

	async remove(id) {
		await this._list.remove(id);
	}

	async updateName(id, name) {
		await this._list.update(this._list.findById(id).withName(name));
	}

	async updateOccupation(id, occupation) {
		await this._list.update(this._list.findById(id).withOccupation(occupation));
	}

	async updateTraits(id, traits) {
		await this._list.update(this._list.findById(id).withTraits(traits));
	}

	buildSnapshot() {
		return this._list.buildSnapshot();
	}
}
