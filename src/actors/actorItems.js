/**
 * Reading an actor's embedded items.
 *
 * `[...actor.items].find(...)` copies the entire collection before scanning it. Foundry's Collection
 * iterates its values directly, so these do the same work without the copy — which matters on paths
 * that run per render, once per card or row.
 *
 * Lookups only. Writes go through the subsystem that owns the item (see OwnedArcanum, FollowerItem).
 */

/** Every embedded item of `type`. */
export function itemsOfType(actor, type) {
	return actor?.items?.filter(i => i.type === type) ?? [];
}

/** The one embedded item of `type` carrying `slug`, or null. */
export function itemOfTypeBySlug(actor, type, slug) {
	if (!slug) return null;
	return actor?.items?.find(i => i.type === type && i.system?.slug === slug) ?? null;
}
