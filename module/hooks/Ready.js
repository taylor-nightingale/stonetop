const _SCOPE = "stonetop";

export async function onReady() {
	await _migrateResourceFlags();
}

/**
 * Moves resource counts from per-domain flags to the centralized ResourceController layout.
 *
 * Old paths:
 *   flags.stonetop.backgrounds.resources  = { [slug]: count }
 *   flags.stonetop.inventory.resources    = { [slug]: count }
 *   flags.stonetop.followers.state[slug].loyalty  (nested inside follower state)
 *
 * New path (shared ResourceController at flags.stonetop.resources):
 *   flags.stonetop.resources.counts = {
 *     backgrounds: { [slug]: count },
 *     inventory:   { [slug]: count },
 *     followers:   { [slug]: loyalty },
 *   }
 */
async function _migrateResourceFlags() {
	const characters = game.actors?.filter(a => a.type === "character") ?? [];
	for (const actor of characters) {
		if (actor.getFlag(_SCOPE, "resources.counts") != null) continue;

		const counts = {};

		const bgResources = actor.getFlag(_SCOPE, "backgrounds.resources");
		if (bgResources && Object.keys(bgResources).length > 0) counts.backgrounds = { ...bgResources };

		const invResources = actor.getFlag(_SCOPE, "inventory.resources");
		if (invResources && Object.keys(invResources).length > 0) counts.inventory = { ...invResources };

		const followerState = actor.getFlag(_SCOPE, "followers.state") ?? {};
		const followerLoyalty = Object.fromEntries(
			Object.entries(followerState)
				.filter(([, s]) => s?.loyalty != null && s.loyalty !== 0)
				.map(([slug, s]) => [slug, s.loyalty])
		);
		if (Object.keys(followerLoyalty).length > 0) counts.followers = followerLoyalty;

		await actor.setFlag(_SCOPE, "resources.counts", counts);
	}
}
