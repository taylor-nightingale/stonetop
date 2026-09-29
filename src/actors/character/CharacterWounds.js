import { Wound } from "../../model/data/character/Wound.js";

/**
 * A character's problematic wounds, stored in `system.wounds` in the order they were written.
 *
 * Writes go one at a time. A name is saved as its field is left, and leaving it is often the click
 * that shuts the editor and clears away unnamed lines — each write reads the list before saving it,
 * so the tidy-up has to read it after the name has landed, not before.
 */
export class CharacterWounds {
	#writes = Promise.resolve();

	constructor(actor) {
		this._actor = actor;
	}

	all() {
		return (this._actor.system?.wounds ?? []).map(Wound.fromRaw);
	}

	add(name = "") {
		return this.#serially(async () => {
			const wound = Wound.named(foundry.utils.randomID(8), name);
			await this._save([...this.all(), wound]);
			return wound;
		});
	}

	rename(id, name)  { return this.#serially(() => this._update(id, w => w.withName(name))); }
	advanceState(id)  { return this.#serially(() => this._update(id, w => w.withNextState())); }

	remove(id) {
		return this.#serially(() => this._save(this.all().filter(w => w.id !== id)));
	}

	/** Clear away the lines nobody named, once every write before this one has landed. */
	removeUnnamed() {
		return this.#serially(async () => {
			const list = this.all();
			const named = list.filter(w => w.isNamed);
			if (named.length < list.length) await this._save(named);
		});
	}

	#serially(write) {
		const run = this.#writes.then(write);
		this.#writes = run.catch(() => {});
		return run;
	}

	async _update(id, change) {
		const list = this.all();
		if (!list.some(w => w.id === id)) return;
		await this._save(list.map(w => w.id === id ? change(w) : w));
	}

	async _save(list) {
		await this._actor.update({ "system.wounds": list.map(w => w.toRaw()) });
	}
}
