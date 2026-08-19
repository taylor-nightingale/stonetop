import { itemOfTypeBySlug } from "../actorItems.js";

/**
 * One of the character's embedded follower items, as a thing you can ask and reshape.
 *
 * Each `with`-method returns a new FollowerItem carrying the pending change; `toUpdate()` turns that
 * into the `updateEmbeddedDocuments` payload. The nine single-field writers on CharacterFollowers
 * used to be nine copies of "find the item, build a one-key update, write it".
 *
 * Only the plain single-line and free-text fields live here. The Selection-backed fields
 * (tagList/instinct/cost) and group members carry real logic of their own and stay with
 * CharacterFollowers.
 */
export class FollowerItem {
	static bySlug(actor, slug) {
		const item = itemOfTypeBySlug(actor, "follower", slug);
		return item ? new FollowerItem(item) : null;
	}

	constructor(item, changes = {}) {
		this._item = item;
		this._changes = changes;
	}

	get id() { return this._item._id; }

	// Single-line fields are stored trimmed, so a stored value round-trips equal to what a picker
	// offers — an untrimmed " Loyal" would never match the "Loyal" option and would silently become
	// a custom entry.
	#withSystem(field, value, trim = false) {
		const stored = trim && typeof value === "string" ? value.trim() : value;
		return new FollowerItem(this._item, {
			...this._changes,
			system: { ...this._changes.system, [field]: stored },
		});
	}

	withName(name)                     { return new FollowerItem(this._item, { ...this._changes, name }); }
	withArmor(armor)                   { return this.#withSystem("armor", armor, true); }
	withDamage(damage)                 { return this.#withSystem("damage", damage, true); }
	withMoves(moves)                   { return this.#withSystem("moves", moves); }
	withNotes(notes)                   { return this.#withSystem("notes", notes); }
	withSpecialQuality(specialQuality) { return this.#withSystem("specialQuality", specialQuality); }
	withDescription(description)       { return this.#withSystem("description", description); }

	// HP current and max are written independently; Foundry merges, so naming one leaves the other.
	withHp(value)   { return this.#withSystem("hp", { ...this._changes.system?.hp, value }); }
	withHpMax(max)  { return this.#withSystem("hp", { ...this._changes.system?.hp, max }); }

	/** The `updateEmbeddedDocuments("Item", [...])` payload for the changes gathered so far. */
	toUpdate() {
		return { _id: this.id, ...this._changes };
	}
}
