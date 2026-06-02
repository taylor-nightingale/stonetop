import {StonetopFlags} from "../character/StonetopFlags.js";
import {Person} from "./Person.js";

export class PersonList {
	constructor(actor, flagNamespace, flagKey) {
		this._flags = new StonetopFlags(actor, flagNamespace);
		this._key = flagKey;
	}

	get _list() {
		return (this._flags.getFlag(this._key) ?? []).map(Person.fromRaw);
	}

	async _save(list) {
		await this._flags.setFlag(this._key, list.map(p => ({...p})));
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
