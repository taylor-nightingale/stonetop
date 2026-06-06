import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumBackSnapshotBuilder, ArcanumFrontSnapshotBuilder,
	ArcanumSnapshotBuilder,
	ChoiceGroup, ChoiceValues,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";
import { ResourceController } from "./ResourceController.js";
import { Arcanum } from "../../model/data/character/Arcanum.js";
export class CharacterArcana {
	constructor(actor, arcanaRepo, stats = null, outfitItems = null, followers = null, factory = null) {
		this._actor      = actor;
		this._arcanaRepo = arcanaRepo;
		this._stats      = stats;
		this._outfitItems = outfitItems;
		this._followers  = followers;
		this._factory    = factory;
	}

	get ownedSlugs() {
		return new Set(
			[...this._actor.items].filter(i => i.type === "arcanum")
				.map(i => i.system?.slug)
				.filter(Boolean),
		);
	}

	_followerRowsFor(item) {
		return (item?.back?.choices?.list ?? []).filter(r => r.type === "follower");
	}

	_followerSlugsFor(item) {
		return this._followerRowsFor(item).map(r => r.slug);
	}

	async buildSnapshot(checkedMap = {}, resourceController = null) {
		const stats = this._stats?.getStats() ?? {};
		const arcanumItems = [...this._actor.items].filter(i => i.type === "arcanum");

		const fetchedItems    = arcanumItems.map(i => _itemToArcanum(i));
		const flippedBySlug   = new Map(arcanumItems.map(i => [i.system?.slug, i.system?.flipped ?? false]));
		const unlockBySlug    = new Map(arcanumItems.map(i => [i.system?.slug, new ChoiceValues(i.system?.unlockValues ?? {})]));
		const backChoiceBySlug = new Map(arcanumItems.map(i => [i.system?.slug, new ChoiceValues(i.system?.backChoiceValues ?? {})]));

		const allLinkedSlugs = fetchedItems.flatMap(item => this._followerSlugsFor(item));
		const followerSnapshots = this._followers
			? await this._followers.buildSnapshot(allLinkedSlugs)
			: [];
		const followersBySlug = Object.fromEntries(followerSnapshots.map(f => [f.slug, f]));

		const snapshots = fetchedItems.map(item => {
			const flipped          = flippedBySlug.get(item.slug)    ?? false;
			const unlockValues     = unlockBySlug.get(item.slug)     ?? new ChoiceValues({});
			const backChoiceValues = backChoiceBySlug.get(item.slug) ?? new ChoiceValues({});

			const unlock = item.front.unlock
				? ChoiceGroup.fromPackData(item.front.unlock, unlockValues)
				: null;

			const front = new ArcanumFrontSnapshotBuilder()
				.withTitle(item.front.title)
				.withItem(this._buildOutfitItem(item.slug, item.front.item))
				.withDescription(item.front.description)
				.withUnlock(unlock)
				.build();

			const current = resourceController?.getCurrent("inventory", item.slug) ?? 0;

			const backDef = item.back.resource ?? null;
			const backResource = backDef
				? ResourceController.build({
					...backDef,
					max: backDef.maxStat ? (stats.get(backDef.maxStat) ?? 0) : backDef.max,
				}, current)
				: null;

			const backItemDef = item.back.item?.resource ?? null;
			const backItemResource = backItemDef
				? ResourceController.build({
					...backItemDef,
					max: backItemDef.maxStat ? (stats[backItemDef.maxStat]?.value ?? 0) : backItemDef.max,
				}, current)
				: null;

			const backChoices = item.back.choices
				? ChoiceGroup.fromPackData(item.back.choices, backChoiceValues, followersBySlug)
				: null;

			const consequences = item.back.consequences
				? ChoiceGroup.fromPackData(item.back.consequences, new ChoiceValues({}))
				: null;

			const back = new ArcanumBackSnapshotBuilder()
				.withTitle(item.back.title)
				.withItem(this._buildOutfitItem(item.slug, item.back.item, backItemResource))
				.withDescription(item.back.description)
				.withResource(backResource)
				.withChoices(backChoices)
				.withMoves(item.back.moves)
				.withConsequences(consequences)
				.withUnlockAt(item.back.unlockAt)
				.build();

			return new ArcanumSnapshotBuilder()
				.withSlug(item.slug)
				.withMajor(item.major)
				.withName(item.name)
				.withImg(item.img)
				.withFront(front)
				.withBack(back)
				.withOwned(true)
				.withFlipped(flipped)
				.withChecked(checkedMap[item.slug] ?? false)
				.build();
		});

		const minor = new ArcanaSectionSnapshot("Minor Arcana", snapshots.filter(s => !s.major));
		const major = new ArcanaSectionSnapshot("Major Arcana", snapshots.filter(s =>  s.major));
		return new ArcanaSnapshot(minor, major);
	}

	_buildOutfitItem(slug, itemData, resolvedResource = undefined) {
		if (!itemData) return null;
		return {
			slug,
			name:            itemData.name,
			weight:          itemData.weight ?? null,
			note:            itemData.note ?? null,
			inventoryColumn: itemData.inventoryColumn ?? null,
			resource:        resolvedResource !== undefined ? resolvedResource : (itemData.resource ?? null),
		};
	}

	async addArcanum(slug) {
		if (this.ownedSlugs.has(slug)) return;
		const [arcanum] = await this._arcanaRepo.findBySlugs([slug]);
		if (!arcanum) return;
		await this._actor.createEmbeddedDocuments("Item", [{
			name: arcanum.name ?? arcanum.slug, img: arcanum.img ?? null, type: "arcanum",
			system: {
				slug: arcanum.slug, major: arcanum.major,
				front: arcanum.front, back: arcanum.back,
				flipped: false, unlockValues: {}, backChoiceValues: {},
			},
		}]);
		await this.onArcanumCreated({ system: { slug, front: arcanum.front, back: arcanum.back } });
	}

	async onArcanumCreated(item) {
		const slug = item.system?.slug;
		if (!slug) return;
		const raw = { front: item.system.front ?? {}, back: item.system.back ?? {} };
		const linkedSlugs = this._followerSlugsFor(raw);
		await this._followers?.embedLinkedFollowers(linkedSlugs);
		await this._syncEmbeddedItemWith(slug, raw);
	}

	async removeArcanum(slug) {
		const embeddedItem = _findArcanumItem(this._actor, slug);
		const arcanum = embeddedItem ? _itemToArcanum(embeddedItem) : null;
		if (embeddedItem) await this._actor.deleteEmbeddedDocuments("Item", [embeddedItem._id]);
		await this._outfitItems?.deleteBySource("arcana:" + slug);
		for (const row of this._followerRowsFor(arcanum)) {
			await this._followers?.removeLinkedFollower(row.slug);
		}
	}

	async flipArcanum(slug) {
		const item = _findArcanumItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { flipped: true } }]);
		await this._syncSideEffects(slug);
	}

	async unflipArcanum(slug) {
		const item = _findArcanumItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { flipped: false } }]);
		await this._syncSideEffects(slug);
	}

	async setUnlockCount(arcanumSlug, optionSlug, count) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "unlockValues")
			.setCount(arcanumSlug, optionSlug, count);
	}

	async setBackChoiceValue(arcanumSlug, optionSlug, count) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "backChoiceValues")
			.setCount(arcanumSlug, optionSlug, count);
	}

	async _syncSideEffects(slug) {
		const embeddedItem = _findArcanumItem(this._actor, slug);
		if (!embeddedItem) {
			await this._outfitItems?.deleteBySource("arcana:" + slug);
			return;
		}
		const item = _itemToArcanum(embeddedItem);
		await this._syncEmbeddedItemWith(slug, item);
		await this._syncFollowers(slug, item);
	}

	async _syncEmbeddedItemWith(slug, item) {
		if (!this._outfitItems) return;
		const embeddedItem = _findArcanumItem(this._actor, slug);
		const flipped = embeddedItem?.system?.flipped ?? false;
		const sideItem = flipped ? item.back.item : item.front.item;
		if (!sideItem?.inventoryColumn) {
			await this._outfitItems.deleteBySource("arcana:" + slug);
			return;
		}
		await this._outfitItems.sync("arcana:" + slug, [
			new EmbeddedOutfitItemBuilder()
				.withSlug(slug)
				.withName(sideItem.name)
				.withWeight(sideItem.weight ?? 0)
				.withNote(sideItem.note ?? null)
				.withInventoryColumn(sideItem.inventoryColumn)
				.withResource(sideItem.resource ?? null)
				.withTwoCol(false)
				.withSource("arcana:" + slug)
				.build(),
		]);
	}

	async _syncFollowers(slug, item) {
		if (!this._followers) return;
		const rows = this._followerRowsFor(item);
		if (!rows.length) return;
		const embeddedItem = _findArcanumItem(this._actor, slug);
		const flipped = embeddedItem?.system?.flipped ?? false;
		for (const row of rows) {
			if (flipped) await this._followers.addFollower(row.slug);
			else         await this._followers.removeFollower(row.slug);
		}
	}
}

function _findArcanumItem(actor, slug) {
	return [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === slug) ?? null;
}

function _itemToArcanum(item) {
	return new Arcanum({
		slug: item.system.slug, major: item.system.major,
		name: item.name, img: item.img,
		front: item.system.front, back: item.system.back,
	});
}
