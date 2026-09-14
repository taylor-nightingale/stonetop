import { FoundryMoveRepository } from "../actors/character/repositories/FoundryMoveRepository.js";
import { FoundryFollowerRepository } from "../actors/character/repositories/FoundryFollowerRepository.js";
import { buildCatalogMoveSnapshot } from "../actors/embeddedMoves.js";
import { buildFollowerSnapshot } from "../model/snapshot/character/buildFollowerSnapshot.js";
import { FollowersSnapshot } from "../model/snapshot/character/FollowerSnapshot.js";
import { collectGrantSlugs } from "../model/snapshot/character/GrantSlugs.js";

// The `context.stonetop` slice choice-row.hbs reads to render inline move/follower GRANTS: it resolves
// each granted slug against the compendium + world and builds the SAME MoveSnapshot / FollowerSnapshot
// the character does. No resource controller is passed (nothing here has live pips), so these rows
// render complete but without a track.
//
// Two callers, one question — "what does this row's slug stand for?". An item-sheet preview (arcanum /
// follower / move) has no actor at all. The CHARACTER sheet has one, and still needs this for the
// backgrounds it has not taken: the tab draws every background so the reader can decide between them,
// and a background's moves become items on the actor only once it is chosen. There the registry SEEDS
// the character's own, which replace anything here under the same slug.
export class GrantRegistry {
	constructor(moves, followers) {
		this.moves     = moves;     // { bySlug: { [slug]: MoveSnapshot } }
		this.followers = followers; // FollowersSnapshot
	}

	static empty() {
		return new GrantRegistry({ bySlug: {} }, new FollowersSnapshot());
	}

	/** Resolve every move/follower grant referenced across `groups` (resolved ChoiceGroup[]) into a
	 *  registry. Returns an empty registry — with no repository access — when nothing is granted. */
	static async fromChoiceGroups(groups, {
		moveRepo     = new FoundryMoveRepository(),
		followerRepo = new FoundryFollowerRepository(),
	} = {}) {
		const slugs = collectGrantSlugs(groups);
		if (slugs.isEmpty) return GrantRegistry.empty();

		// Optional-chained: a caller may hand over a character that was built with no catalog at all
		// (a fixture, a partially-wired actor). Resolving nothing is the right answer there — reaching
		// past it for Foundry's own repositories would answer with a world this caller never named.
		const [moveEntries, followerDocs] = await Promise.all([
			moveRepo?.getMoveEntriesBySlugs(slugs.moveSlugs) ?? [],
			followerRepo?.getFollowerDocsBySlugs(slugs.followerSlugs) ?? [],
		]);

		const moveBySlug = {};
		for (const entry of moveEntries) {
			const snap = buildCatalogMoveSnapshot(entry);
			if (snap.slug) moveBySlug[snap.slug] = snap;
		}

		const followerBySlug = {};
		for (const doc of followerDocs) {
			const snap = buildFollowerSnapshot(doc, {});
			if (snap.slug) followerBySlug[snap.slug] = snap;
		}

		return new GrantRegistry({ bySlug: moveBySlug }, new FollowersSnapshot(followerBySlug, []));
	}
}
