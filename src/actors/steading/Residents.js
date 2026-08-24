import {PersonList} from "./PersonList.js";
import {Person} from "./Person.js";
import {PersonActors} from "./PersonActors.js";

export class Residents {
	constructor(actor, npcs = null) {
		this._actor  = actor;
		this._list   = new PersonList(actor, "residentPeople");
		this._actors = npcs ? new PersonActors(actor, npcs) : null;
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

	async linkDocument(id, uuid) {
		await this._list.update(this._list.findById(id).withLink(uuid));
	}

	async unlinkDocument(id) {
		await this._list.update(this._list.findById(id).withoutLink());
	}

	linksDocument(uuid) {
		return this._list.linksDocument(uuid);
	}

	// Residents of a steading live under its own name — `NPCs/Stonetop`. `ids` names the rows that
	// just changed; pass none to consider every resident (the GM's bulk pass).
	async syncActors(ids = null) {
		if (!this._actors) return;
		for (const person of this._selected(ids)) {
			const updated = await this._actors.sync(person, this._location);
			if (updated) await this._list.update(updated);
		}
	}

	async previewActors() {
		if (!this._actors) return [];
		return Promise.all(this._list.all().map(person => this._actors.preview(person, this._location)));
	}

	get _location() {
		return this._actor.name;
	}

	_selected(ids) {
		return ids === null ? this._list.all() : this._list.all().filter(p => ids.includes(p.id));
	}

	buildSnapshot() {
		return this._list.buildSnapshot();
	}
}
