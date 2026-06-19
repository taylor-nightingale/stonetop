import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";

export class FollowerSideEffectHandler {
	constructor(followers) {
		this._followers = followers;
	}

	async apply(target, namespace, optionSlug, count) {
		const slugs = target.followers ?? [];
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
		if (count > 0) {
			// Choice outfit items are stored flat ({slug,name,weight,…}); wrap each as a proper
			// `outfitItem` Item payload (type + system + source) before creating, else the embedded
			// Item fails validation ("type: may not be undefined").
			const itemsData = target.outfitItems.map(oi => new EmbeddedOutfitItemBuilder()
				.withSlug(oi.slug)
				.withName(oi.name)
				.withWeight(oi.weight ?? 1)
				.withNote(oi.note ?? null)
				.withInventoryColumn(oi.inventoryColumn ?? "regular")
				.withResource(oi.resource ?? null)
				.withTwoCol(oi.twoCol ?? false)
				.withSource(source)
				.build());
			await this._items.sync(source, itemsData);
		} else {
			await this._items.deleteBySource(source);
		}
	}
}
