import { GrantStamp, ItemGrant } from "../model/data/ItemGrant.js";

/**
 * The one writer of granted items on an actor. Every item something else owns — a playbook's moves and
 * followers, an insert's move category, an arcanum's grants — is created here, carrying the stamp that
 * says which source it belongs to.
 *
 * Applying a grant is a DIFF, never a rebuild. An item the source still wants is left exactly as it is,
 * so the player's acquired moves, a follower's loyalty and a possession's uses survive a re-grant; only
 * genuinely new keys are created and genuinely stale ones deleted. That is what makes `sync` safe to
 * call on every playbook select, every drop and every migration.
 *
 * Items with no stamp are authored — the player added them by hand — and are never read or written here.
 */
export class GrantedItems {
	constructor(actor) {
		this._actor = actor;
	}

	itemsFrom(source) {
		return [...(this._actor.items ?? [])].filter(item => GrantStamp.matches(item, source));
	}

	/** Create what's missing; keep what the set no longer lists (reference moves a GM deleted stay gone).
	 *  Returns the items it created, so a caller can finish what only a NEW item needs. */
	async seed(set) {
		return this._create(set, this._missing(set));
	}

	/** Create what's missing, delete what this source no longer wants, leave the rest untouched.
	 *  Returns the items it created. */
	async sync(set) {
		const owned  = this.itemsFrom(set.source);
		const wanted = new Set(set.keys);
		const created = await this._create(set, this._missing(set));
		await this._delete(owned.filter(item => !wanted.has(GrantStamp.of(item).key)));
		return created;
	}

	async revoke(source) {
		await this._delete(this.itemsFrom(source));
	}

	// What the character doesn't already hold. Presence is judged across EVERY item, not just this
	// source's: the sheet finds a follower, insert or possession by slug and shows the first hit, so a
	// second copy granted alongside a hand-added one would be an invisible ghost. A grant therefore
	// yields to an item that is already there — and, having not created it, never revokes it either.
	_missing(set) {
		const have = new Set();
		for (const item of this._actor.items ?? []) {
			// Its own stamp AND its type+slug: normally the same key, but an item whose stored slug has
			// drifted from what granted it must still count as present, or every sync would add another.
			have.add(GrantStamp.of(item)?.key);
			have.add(ItemGrant.keyOf(item));
		}
		return set.grants.filter(grant => !have.has(grant.key));
	}

	async _create(set, grants) {
		if (!grants.length) return [];
		return await this._actor.createEmbeddedDocuments("Item", grants.map(grant => grant.stamped(set.source))) ?? [];
	}

	async _delete(items) {
		if (!items.length) return;
		await this._actor.deleteEmbeddedDocuments("Item", items.map(item => item._id));
	}
}
