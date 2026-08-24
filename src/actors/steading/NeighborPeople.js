import {PersonList} from "./PersonList.js";
import {Person} from "./Person.js";
import {PersonActors} from "./PersonActors.js";

export class NeighborPeople {
	/** Where a neighbour with no home written down is filed. */
	static ELSEWHERE = "Neighbors";

	constructor(actor, npcs = null) {
		this._actor  = actor;
		this._list   = new PersonList(actor, "neighborPeople");
		this._actors = npcs ? new PersonActors(actor, npcs) : null;
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

	linksDocument(uuid) {
		return this._list.linksDocument(uuid);
	}

	// A neighbour is filed under the home written on their row — `NPCs/Marshedge` — so changing where
	// someone lives moves their actor with them.
	async syncActors(ids = null) {
		if (!this._actors) return;
		for (const person of this._selected(ids)) {
			const updated = await this._actors.sync(person, NeighborPeople._locationOf(person));
			if (updated) await this._list.update(updated);
		}
	}

	async previewActors() {
		if (!this._actors) return [];
		return Promise.all(this._list.all().map(p => this._actors.preview(p, NeighborPeople._locationOf(p))));
	}

	static _locationOf(person) {
		return person.home?.trim() || NeighborPeople.ELSEWHERE;
	}

	_selected(ids) {
		return ids === null ? this._list.all() : this._list.all().filter(p => ids.includes(p.id));
	}

	buildSnapshot() {
		return this._list.buildSnapshot();
	}
}
