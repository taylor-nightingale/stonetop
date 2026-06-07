import {Person} from "./Person.js";

export class PersonList {
	constructor(actor, flagKey) {
		this._actor = actor;
		this._key   = flagKey;
	}

	get _list() {
		return (this._actor.system?.[this._key] ?? []).map(Person.fromRaw);
	}

	async _save(list) {
		await this._actor.update({ [`system.${this._key}`]: list.map(p => ({...p})) });
	}

	findById(id) {
		return this._list.find(p => p.id === id) ?? null;
	}

	async add(person) {
		await this._save([...this._list, person]);
	}

	async remove(id) {
		await this._save(this._list.filter(p => p.id !== id));
	}

	async update(person) {
		await this._save(this._list.map(p => p.id === person.id ? person : p));
	}

	buildSnapshot() {
		return this._list;
	}
}
