import {Person} from "./Person.js";
import {documentLink} from "../../model/snapshot/documentLink.js";

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

	/** The people, as entities. */
	all() {
		return this._list;
	}

	findById(id) {
		return this._list.find(p => p.id === id) ?? null;
	}

	/** Whether any of these people point at that document — asked when it is renamed or deleted. */
	linksDocument(uuid) {
		return this._list.some(p => p.linkUuid === uuid);
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

	// Returns the (throwaway) Person instances for rendering. A linked person gets a render-only
	// `docLink` RichText — a `@UUID` content link (with broken-link styling for free). `docLink` is
	// never persisted: `_save` maps fresh `_list` entities, not snapshot output.
	buildSnapshot() {
		return this._list.map(p => {
			if (p.linkUuid) p.docLink = documentLink(p.linkUuid);
			return p;
		});
	}
}
