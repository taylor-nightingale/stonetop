import { GrantList } from "../../model/data/Grant.js";

/**
 * Toggles the tab placement of the followers a choice row grants. The follower is already owned (the
 * card grants it up front); marking the row puts it on the roster tab, un-marking takes it off — a
 * card-bound follower (no "tab" location) stays off either way. Subscribes to choice-value changes
 * and decides relevance itself: it needs the row that changed, so it ignores writes with no row.
 */
export class FollowerSideEffectHandler {
	constructor(followers) {
		this._followers = followers;
	}

	async handle(change) {
		if (!change.affectsCounts || !change.target) return;
		for (const grant of GrantList.fromRaw(change.target.grants).ofType("follower")) {
			await this._followers.addFollower(grant.slug, { showOnTab: change.count > 0 ? grant.onTab : false });
		}
	}
}
