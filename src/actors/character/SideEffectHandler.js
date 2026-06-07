export class FollowerSideEffectHandler {
	constructor(followers) {
		this._followers = followers;
	}

	async apply(target, namespace, optionSlug, count) {
		const slugs = target.followers?.length
			? target.followers
			: (target.type === "follower" ? [target.slug] : []);
		for (const slug of slugs) {
			if (count > 0) await this._followers.addFollower(slug);
			else           await this._followers.removeFollower(slug);
		}
	}
}

export class OutfitItemSideEffectHandler {
	constructor(sourcePrefix, items) {
		this._sourcePrefix = sourcePrefix;
		this._items        = items;
	}

	async apply(target, namespace, optionSlug, count) {
		if (!target.outfitItems?.length) return;
		const source = `${this._sourcePrefix}:${namespace}:${optionSlug}`;
		if (count > 0) await this._items.sync(source, target.outfitItems);
		else           await this._items.deleteBySource(source);
	}
}
