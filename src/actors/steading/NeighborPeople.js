import {PersonList} from "./PersonList.js";
import {Person} from "./Person.js";

export class NeighborPeople {
	constructor(actor) {
		this._list = new PersonList(actor, "neighborPeople");
	}

	async add() {
		await this._list.add(Person.blankNeighbor());
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

	async updateHome(id, home) {
		await this._list.update(this._list.findById(id).withHome(home));
	}

	async linkDocument(id, uuid) {
		await this._list.update(this._list.findById(id).withLink(uuid));
	}

	async unlinkDocument(id) {
		await this._list.update(this._list.findById(id).withoutLink());
	}

	buildSnapshot() {
		return this._list.buildSnapshot();
	}
}
