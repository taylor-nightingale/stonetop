import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanaUnlockOptionSnapshotBuilder, ArcanaUnlockTextItem,
	ArcanumBackMoveSnapshot, ArcanumUnlockSection,
	MinorArcanumBackSnapshotBuilder, MinorArcanumFrontSnapshotBuilder,
	MinorArcanumSnapshotBuilder,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { OutfitItemBuilder } from "../../model/data/character/OutfitItem.js";

function _buildOutfitItem(slug, itemData, resolvedResource = undefined) {
	if (!itemData) return null;
	return new OutfitItemBuilder()
		.withSlug(slug)
		.withName(itemData.name)
		.withWeight(itemData.weight ?? null)
		.withNote(itemData.note ?? null)
		.withInventoryColumn(itemData.inventoryColumn ?? null)
		.withResource(resolvedResource !== undefined ? resolvedResource : (itemData.resource ?? null))
		.withTwoCol(false)
		.withBreakBefore(false)
		.build();
}

export class CharacterArcana {
	constructor(flags, arcanaRepo, stats = null, inventory = null) {
		this._flags      = flags;
		this._arcanaRepo = arcanaRepo;
		this._stats      = stats;
		this._inventory  = inventory;
	}

	get ownedSlugs()   { return new Set(this._flags.getFlag("owned") ?? []); }
	get flippedSlugs() { return new Set(this._flags.getFlag("flipped") ?? []); }
	get unlockCounts() { return this._flags.getFlag("unlock") ?? {}; }

	async buildSnapshot() {
		await this._inventory?.setArcanaItems(await this.weightedInventoryItems());
		const stats              = this._stats?.getStats() ?? {};
		const checkedMap         = this._inventory?.checked ?? {};
		const inventoryResources = this._inventory?.resources ?? {};
		const ownedSlugs   = this.ownedSlugs;
		const flippedSlugs = this.flippedSlugs;
		const unlockCounts = this.unlockCounts;

		const fetchedItems = await this._arcanaRepo.findBySlugs([...ownedSlugs]);

		const minorItems = fetchedItems.map(item => {
			const flipped = flippedSlugs.has(item.slug);

			const unlockItems = item.front.unlock.requirements.map(li => {
				if (li.type === "text") return new ArcanaUnlockTextItem(li.description);
				const count = unlockCounts[`${item.slug}:${li.slug}`] ?? 0;
				return new ArcanaUnlockOptionSnapshotBuilder()
					.withSlug(li.slug)
					.withDescription(li.description)
					.withCount(count)
					.withMax(li.max ?? 1)
					.withSelected(count > 0)
					.build();
			});

			const front = new MinorArcanumFrontSnapshotBuilder()
				.withTitle(item.front.title)
				.withItem(_buildOutfitItem(item.slug, item.front.item))
				.withDescription(item.front.description)
				.withUnlock(new ArcanumUnlockSection(item.front.unlock.description, unlockItems))
				.build();

			const backResource = item.back.resource
				? new ResourceBuilder()
					.withCurrent(inventoryResources[item.slug] ?? 0)
					.withMax(item.back.resource.maxStat
						? (stats.get(item.back.resource.maxStat))
						: item.back.resource.max)
					.withMaxStat(item.back.resource.maxStat ?? null)
					.withTitle(item.back.resource.title ?? null)
					.withLabels(item.back.resource.labels ?? [])
					.build()
				: null;

			const backItemResource = item.back.item?.resource
				? new ResourceBuilder()
					.withCurrent(inventoryResources[item.slug] ?? 0)
					.withMax(item.back.item.resource.maxStat
						? (stats[item.back.item.resource.maxStat]?.value ?? 0)
						: item.back.item.resource.max)
					.withMaxStat(item.back.item.resource.maxStat ?? null)
					.withTitle(item.back.item.resource.title ?? null)
					.withLabels(item.back.item.resource.labels ?? [])
					.build()
				: null;

			const backMove = item.back.move
				? new ArcanumBackMoveSnapshot(
					item.back.move.name,
					item.back.move.rollType ?? null,
					item.back.move.description)
				: null;

			const back = new MinorArcanumBackSnapshotBuilder()
				.withTitle(item.back.title)
				.withItem(_buildOutfitItem(item.slug, item.back.item, backItemResource))
				.withDescription(item.back.description)
				.withResource(backResource)
				.withMove(backMove)
				.build();

			return new MinorArcanumSnapshotBuilder()
				.withSlug(item.slug)
				.withFront(front)
				.withBack(back)
				.withOwned(true)
				.withFlipped(flipped)
				.withChecked(checkedMap[item.slug] ?? false)
				.build();
		});

		const minor = new ArcanaSectionSnapshot("Minor Arcana", minorItems);
		const major = new ArcanaSectionSnapshot("Major Arcana", []);
		return new ArcanaSnapshot(minor, major);
	}

	async addArcanum(slug) {
		const slugsWeHae = this.ownedSlugs;
		slugsWeHae.add(slug);
		await this._flags.setFlag("owned", [...slugsWeHae]);
		await this._inventory?.setArcanaItems(await this.weightedInventoryItems());
	}

	async removeArcanum(slug) {
		const s = this.ownedSlugs;
		s.delete(slug);
		await this._flags.setFlag("owned", [...s]);
		await this._inventory?.setArcanaItems(await this.weightedInventoryItems());
	}

	async flipArcanum(slug) {
		const s = this.flippedSlugs;
		s.add(slug);
		await this._flags.setFlag("flipped", [...s]);
		await this._inventory?.setArcanaItems(await this.weightedInventoryItems());
	}

	async unflipArcanum(slug) {
		const s = this.flippedSlugs;
		s.delete(slug);
		await this._flags.setFlag("flipped", [...s]);
		await this._inventory?.setArcanaItems(await this.weightedInventoryItems());
	}

	async setUnlockCount(arcanumSlug, optionSlug, count) {
		const key = `${arcanumSlug}:${optionSlug}`;
		await this._flags.setFlag("unlock", { ...this.unlockCounts, [key]: count });
	}

	async weightedInventoryItems() {
		const ownedSlugs   = this.ownedSlugs;
		const flippedSlugs = this.flippedSlugs;
		const items = await this._arcanaRepo.findBySlugs([...ownedSlugs]);
		return items.flatMap(item => {
			const flipped  = flippedSlugs.has(item.slug);
			const sideItem = flipped ? item.back.item : item.front.item;
			if (!sideItem?.inventoryColumn) return [];
			return [new OutfitItemBuilder()
				.withSlug(item.slug)
				.withName(sideItem.name)
				.withWeight(sideItem.weight ?? 0)
				.withNote(sideItem.note ?? null)
				.withInventoryColumn(sideItem.inventoryColumn)
				.withResource(sideItem.resource ?? null)
				.withTwoCol(false)
				.withBreakBefore(false)
				.build()
			];
		});
	}
}
