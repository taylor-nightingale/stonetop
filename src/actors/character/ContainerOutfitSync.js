/**
 * The single writer of granted outfit items. Hosts register how their own container type computes its
 * grant (only they know what counts as base gear — a possession's `outfitItems`, an arcanum's
 * flip-dependent card item); everything else is shared. Dispatch is by registration rather than a type
 * switch, so a new container type is wired at the composition root, not here.
 *
 * `syncItem` is idempotent: it recomputes the container's whole grant and replaces one source. The same
 * call therefore serves a choice being ticked, the container being selected, and a card being flipped —
 * which is why nothing here needs to replay past events or track per-option state.
 */
export class ContainerOutfitSync {
	constructor(outfitItems) {
		this._outfitItems = outfitItems;
		this._builders    = new Map();   // item type → (item) => OutfitGrant | null
	}

	/** Teach it how one container type computes its grant. Returns this, so registration can chain. */
	register(itemType, grantBuilder) {
		this._builders.set(itemType, grantBuilder);
		return this;
	}

	get types() { return [...this._builders.keys()]; }

	/** Subscribes to choice-value changes: any write that can alter a count re-syncs that container.
	 *  It ignores which option changed — the grant is recomputed wholesale from stored values. */
	async handle(change) {
		if (!change.affectsCounts || !change.item) return;
		await this.syncItem(change.item);
	}

	/** Recompute and apply one container's grant. No-ops for types nobody registered. */
	async syncItem(item) {
		const build = this._builders.get(item?.type);
		if (!build) return;
		await this.apply(build(item));
	}

	async apply(grant) {
		if (!this._outfitItems || !grant) return;
		if (!grant.items.length) {
			await this.clear(grant.source);
			return;
		}
		await this._outfitItems.sync(grant.source, grant.items);
	}

	async clear(source) {
		await this.clearAll([source]);
	}

	/** Clear several containers' gear in one write — a playbook swap takes back six or seven at once. */
	async clearAll(sources) {
		if (sources.length) await this._outfitItems?.deleteBySources(sources);
	}
}
