/** The move + follower slugs granted inline across a set of resolved choice groups — the references a
 *  preview must resolve into a render registry (see GrantRegistry). Slugs only; deduped, order preserved. */
export class GrantSlugs {
	constructor(moveSlugs = [], followerSlugs = []) {
		this.moveSlugs     = moveSlugs;
		this.followerSlugs = followerSlugs;
	}

	get isEmpty() { return this.moveSlugs.length === 0 && this.followerSlugs.length === 0; }
}

/** Walk resolved `ChoiceGroup`s and gather every inline move/follower grant slug an entry row carries
 *  (EntryRowMoves.slugs / EntryRowFollowers.slugs). Pure — reads only slugs, never touches a registry. */
export function collectGrantSlugs(groups = []) {
	const moves = new Set();
	const followers = new Set();
	for (const group of groups) {
		for (const row of group?.list ?? []) {
			for (const slug of row?.moves?.slugs ?? []) moves.add(slug);
			for (const slug of row?.followers?.slugs ?? []) followers.add(slug);
		}
	}
	return new GrantSlugs([...moves], [...followers]);
}
