import {PersonList} from "./PersonList.js";
import {Person} from "./Person.js";
import {PersonActors} from "./PersonActors.js";

/**
 * The people of and around the steading — one roster.
 *
 * Residents and neighbours used to be two classes over two arrays rendering two identical tables; the
 * only difference was that a neighbour wrote down where they lived. So there is one list, one add
 * button, one search, and a Home column where BLANK MEANS THE STEADING. That is the whole merge, and
 * it is why `_locationOf` has a single rule instead of two.
 *
 * The concrete class, composing the generic PersonList: it owns the storage key, its own blank entry
 * and its own location rule. PersonList stays ignorant of all three.
 */
export class Folk {
	constructor(actor, npcs = null) {
		this._actor  = actor;
		this._list   = new PersonList(actor, "folk");
		this._actors = npcs ? new PersonActors(actor, npcs) : null;
	}

	async add() {
		await this._list.add(Person.blank());
	}

	/**
	 * Add someone already carrying a name — the reference list's browse-and-create in one gesture.
	 * `home` is where the list that name came off belongs; blank for the steading's own list, which
	 * is also what a resident's row says.
	 */
	async addNamed(name, home = "") {
		const person = Person.named(name, home);
		await this._list.add(person);
		return person;
	}

	/**
	 * Give an existing row a name off one of the reference lists, and — only if the row does not
	 * already say where they live — the place that list belongs to.
	 *
	 * One method rather than a name write followed by a home write: picking "Seadha" off Marshedge's
	 * list is one gesture at the table and one thing the reader means by it.
	 */
	async useName(id, name, home = "") {
		await this._update(id, p => p.withName(name).withHomeIfUnset(home));
	}

	async remove(id) {
		await this._list.remove(id);
	}

	async updateName(id, name)             { await this._update(id, p => p.withName(name)); }
	async updateOccupation(id, occupation) { await this._update(id, p => p.withOccupation(occupation)); }
	async updateTraits(id, traits)         { await this._update(id, p => p.withTraits(traits)); }
	async updateHome(id, home)             { await this._update(id, p => p.withHome(home)); }
	async appendTrait(id, trait)           { await this._update(id, p => p.withTraitAdded(trait)); }
	async linkDocument(id, uuid)           { await this._update(id, p => p.withLink(uuid)); }
	async unlinkDocument(id)               { await this._update(id, p => p.withoutLink()); }

	linksDocument(uuid) {
		return this._list.linksDocument(uuid);
	}

	/** Whether someone on the roster already goes by that name — how a name list knows to dim it. */
	usesName(name) {
		return this._list.all().some(p => p.hasName(name));
	}

	/** Whether that trait is already written on anybody's row — how the trait pool knows to dim it. */
	usesTrait(trait) {
		return this._list.all().some(p => p.hasTrait(trait));
	}

	// Someone is filed under the home written on their row — `NPCs/Marshedge` — and a blank home is the
	// steading itself, so a villager lands in `NPCs/Stonetop`. `ids` names the rows that just changed;
	// pass none to consider everyone (the GM's bulk pass).
	async syncActors(ids = null) {
		if (!this._actors) return;
		for (const person of this._selected(ids)) {
			const updated = await this._actors.sync(person, this._locationOf(person));
			if (updated) await this._list.update(updated);
		}
	}

	async previewActors() {
		if (!this._actors) return [];
		return Promise.all(this._list.all().map(p => this._actors.preview(p, this._locationOf(p))));
	}

	_locationOf(person) {
		return person.home?.trim() || this._actor.name;
	}

	async _update(id, change) {
		const person = this._list.findById(id);
		if (person) await this._list.update(change(person));
	}

	_selected(ids) {
		return ids === null ? this._list.all() : this._list.all().filter(p => ids.includes(p.id));
	}

	buildSnapshot() {
		return this._list.buildSnapshot();
	}
}
