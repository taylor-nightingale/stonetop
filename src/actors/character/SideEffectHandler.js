import { FollowerLink } from "../../model/data/FollowerLink.js";

/**
 * Embeds or removes the followers a choice row grants. Subscribes to choice-value changes and decides
 * for itself what is relevant: it needs the row that changed, so it ignores writes that carry no row
 * (a namespace clear) and writes that cannot change a count (text).
 */
export class FollowerSideEffectHandler {
	constructor(followers) {
		this._followers = followers;
	}

	async handle(change) {
		if (!change.affectsCounts || !change.target) return;
		const slugs = FollowerLink.fromRaw(change.target.followers)?.slugs ?? [];
		for (const slug of slugs) {
			if (change.count > 0) await this._followers.addFollower(slug);
			else                  await this._followers.removeFollower(slug);
		}
	}
}
