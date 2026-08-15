import { ItemGrantSet } from "../../model/data/ItemGrant.js";

/**
 * Where an item landing on (or leaving) the actor becomes grants. Each granting item type registers
 * three things: the source string it speaks for, what it wants to exist, and whatever non-item cleanup
 * its revoke needs. Dispatch is by registration rather than a type switch, so a new granting type is one
 * line at the composition root.
 *
 * Grant and revoke run off the SAME registration, so they can't drift apart — the asymmetry that let a
 * deleted playbook leave its moves and followers behind was two hand-written lists, one shorter than
 * the other.
 */
export class ItemGrantRouter {
	constructor(grantedItems) {
		this._grantedItems = grantedItems;
		this._sources      = new Map();   // item type → { source, grants, onRevoke }
	}

	/**
	 * Teach it what one granting item type is worth. Returns this, so registration can chain.
	 * `onApply` is the source's own non-item consequences (a playbook sets the character's stats);
	 * `onGranted` gets the items that were actually NEW, for follow-up only a fresh item needs.
	 */
	register(itemType, { source, grants, onApply = null, onGranted = null, onRevoke = null }) {
		this._sources.set(itemType, { source, grants, onApply, onGranted, onRevoke });
		return this;
	}

	get types() { return [...this._sources.keys()]; }

	/** Apply every grant this item is the source of. No-ops for types nobody registered. */
	async apply(item) {
		const registration = this._sources.get(item?.type);
		if (!registration) return;
		await registration.onApply?.(item);
		const created = [];
		for (const set of ItemGrantSet.mergeBySource(await registration.grants(item))) {
			created.push(...await this._grantedItems.sync(set));
		}
		if (created.length) await registration.onGranted?.(created, item);
	}

	/** Take back everything this item granted, cleanup first, then the items themselves. */
	async revoke(item) {
		const registration = this._sources.get(item?.type);
		if (!registration) return;
		const source = registration.source(item);
		await registration.onRevoke?.(source, item);
		await this._grantedItems.revoke(source);
	}
}
