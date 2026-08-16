import { GrantSource, GrantStamp, ItemGrant } from "../model/data/ItemGrant.js";

/**
 * What granted an item, read from the five markers that said so before there was one stamp:
 * a move's `categoryKey` prefix, an insert's or follower's `grantedByPlaybook` flag, a possession's
 * `system.playbookSlug`, an outfit item's `system.source`, an arcana follower's `system.arcanaSlug`.
 *
 * Only the migration reads these. Everything after it reads the stamp, so nothing in the running
 * system has to know that any of this was ever true.
 */
export function legacyGrantStamp(item) {
	const existing = GrantStamp.of(item);
	if (existing) return existing;
	const source = _legacySource(item);
	const key    = ItemGrant.keyOf(item);
	return source && key ? new GrantStamp(source, key) : null;
}

function _legacySource(item) {
	const system = item?.system ?? {};
	switch (item?.type) {
		case "move":       return GrantSource.forCategoryKey(system.categoryKey ?? null);
		// `playbookSlug` on a follower predates the flag and is never written now; both mean the same thing.
		case "follower":   return _playbook(item.flags?.stonetop?.grantedByPlaybook ?? system.playbookSlug)
			?? _arcanum(system.arcanaSlug);
		case "insert":     return _playbook(item.flags?.stonetop?.grantedByPlaybook);
		case "possession": return _playbook(system.playbookSlug);
		// A container's gear is its own source, so it can be cleared without touching what else that
		// container granted.
		case "outfitItem": return system.source ? GrantSource.outfit(system.source) : null;
		default:           return null;
	}
}

function _playbook(slug) { return slug ? GrantSource.playbook(slug) : null; }
function _arcanum(slug)  { return slug ? GrantSource.arcanum(slug)  : null; }
