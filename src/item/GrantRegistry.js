import { FoundryMoveRepository } from "../actors/character/repositories/FoundryMoveRepository.js";
import { FoundryFollowerRepository } from "../actors/character/repositories/FoundryFollowerRepository.js";
import { buildMoveSnapshot } from "../actors/embeddedMoves.js";
import { buildFollowerSnapshot } from "../model/snapshot/character/buildFollowerSnapshot.js";
import { FollowersSnapshot } from "../model/snapshot/character/FollowerSnapshot.js";
import { collectGrantSlugs } from "../model/snapshot/character/GrantSlugs.js";

// The `context.stonetop` slice choice-row.hbs reads to render inline move/follower GRANTS. On the
// character sheet these registries come from the actor's owned items; an item-sheet preview (arcanum /
// follower / move) has no actor, so this resolves each granted slug against the compendium + world and
// builds the SAME MoveSnapshot / FollowerSnapshot the character does. No resource controller is passed
// (a preview has no live pips), so granted moves render non-interactive but complete.
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

		const [moveEntries, followerDocs] = await Promise.all([
			moveRepo.getMoveEntriesBySlugs(slugs.moveSlugs),
			followerRepo.getFollowerDocsBySlugs(slugs.followerSlugs),
		]);

		const moveBySlug = {};
		for (const entry of moveEntries) {
			const snap = buildMoveSnapshot(entry, "reference", false, null);
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
