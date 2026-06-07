import {PersonList} from "./PersonList.js";
import {Person} from "./Person.js";

export class Residents {
	constructor(actor) {
		this._list = new PersonList(actor, "residents");
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
