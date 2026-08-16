import { GrantStamp, ItemGrant } from "../model/data/ItemGrant.js";

/**
 * The one writer of granted items on an actor. Every item something else owns — a playbook's moves and
 * followers, an insert's move category, an arcanum's grants — is created here, carrying the stamp that
 * says which source it belongs to (see ItemGrant).
 *
 * Applying a grant is a DIFF, never a rebuild: an item the source still wants is left exactly as it is,
 * so the player's acquired moves, a follower's loyalty and a possession's uses survive a re-grant. That
 * is what makes `sync` safe to call on every playbook select, every drop and every migration.
 *
 * Items with no stamp are authored — the player added them by hand — and are never reconciled here.
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
		if (set.isEmpty) return [];   // nothing to say — see ItemGrantSet
		const owned  = this.itemsFrom(set.source);
		const wanted = new Set(set.keys);
		const created = await this._create(set, this._missing(set));
		await this._delete(owned.filter(item => !wanted.has(GrantStamp.of(item).key)));
		return created;
	}

	async revoke(source) {
		await this.revokeAll([source]);
	}

	/** Take back several sources at once — one pass over the items, one delete. */
	async revokeAll(sources) {
		const wanted = new Set(sources);
		await this._delete([...(this._actor.items ?? [])].filter(item => wanted.has(GrantStamp.of(item)?.source)));
	}

	/**
	 * Replace everything a source has with exactly this set. For grants with no player state to preserve,
	 * recomputed whole on every change — a container's outfit gear, where two identical items from one
	 * source are two real items, so identity can't be a key. Everything else wants `sync`.
	 */
	async replace(set) {
		if (set.isEmpty) return [];
		await this._delete(this.itemsFrom(set.source));
		return this._create(set, set.grants);
	}

	/** An item the player added themselves. Unkeyed and unstamped: no source owns it, so nothing
	 *  reconciles or revokes it. Here so that every embedded-item write goes through one place. */
	async addAuthored(itemsData) {
		const items = Array.isArray(itemsData) ? itemsData : [itemsData];
		if (!items.length) return [];
		return await this._actor.createEmbeddedDocuments("Item", items) ?? [];
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
