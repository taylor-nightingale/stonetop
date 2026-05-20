import {
	ArcanaBackOptionSnapshotBuilder, ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanaUnlockOptionSnapshotBuilder, ArcanaUnlockTextItem,
	ArcanumBackMoveSnapshot, ArcanumUnlockSection,
	MinorArcanumBackSnapshotBuilder, MinorArcanumFrontSnapshotBuilder,
	MinorArcanumSnapshotBuilder,
	ResourceBuilder,
} from "../../model/CharacterSnapshot.js";
import { OutfitItemBuilder } from "../../model/OutfitItem.js";

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
	constructor(flags, arcanaRepo) {
		this._flags = flags;
		this._arcanaRepo = arcanaRepo;
	}

	get ownedSlugs()      { return new Set(this._flags.getFlag("owned") ?? []); }
	get flippedSlugs()    { return new Set(this._flags.getFlag("flipped") ?? []); }
	get unlockCounts()    { return this._flags.getFlag("unlock") ?? {}; }
	get backOptionCounts(){ return this._flags.getFlag("backOptions") ?? {}; }

	async buildSnapshot(stats = {}, checkedMap = {}, inventoryResources = {}) {
		const ownedSlugs       = this.ownedSlugs;
		const flippedSlugs     = this.flippedSlugs;
		const unlockCounts     = this.unlockCounts;
		const backOptionCounts = this.backOptionCounts;

		const fetchedItems = await this._arcanaRepo.findBySlugs([...ownedSlugs]);

		const minorItems = fetchedItems.map(item => {
			const flipped = flippedSlugs.has(item.slug);

			const unlockItems = item.front.unlock.requirements.map(li => {
				if (li.type === "text") return new ArcanaUnlockTextItem(li.content);
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

			const backOpts = (item.back.options ?? []).map(o => {
				const count = backOptionCounts[`${item.slug}:${o.slug}`] ?? 0;
				return new ArcanaBackOptionSnapshotBuilder()
					.withSlug(o.slug)
					.withDescription(o.description)
					.withCount(count)
					.withMax(o.max ?? 1)
					.withSelected(count > 0)
					.build();
			});

			const backResource = item.back.resource
				? new ResourceBuilder()
					.withCurrent(inventoryResources[item.slug] ?? 0)
					.withMax(item.back.resource.maxStat
						? (stats[item.back.resource.maxStat]?.value ?? 0)
						: item.back.resource.max)
					.withMaxStat(item.back.resource.maxStat ?? null)
					.withTitle(item.back.resource.title ?? null)
					.withLabels(item.back.resource.labels ?? [])
					.build()
				: null;

			const backItemResourceDef = item.back.item?.resource ?? null;
			const backItemResource = backItemResourceDef
				? new ResourceBuilder()
					.withCurrent(inventoryResources[item.slug] ?? 0)
					.withMax(backItemResourceDef.maxStat
						? (stats[backItemResourceDef.maxStat]?.value ?? 0)
						: backItemResourceDef.max)
					.withMaxStat(backItemResourceDef.maxStat ?? null)
					.withTitle(backItemResourceDef.title ?? null)
					.withLabels(backItemResourceDef.labels ?? [])
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
				.withOptions(backOpts)
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
	}

	async removeArcanum(slug) {
		const s = this.ownedSlugs;
		s.delete(slug);
		await this._flags.setFlag("owned", [...s]);
	}

	async flipArcanum(slug) {
		const s = this.flippedSlugs;
		s.add(slug);
		await this._flags.setFlag("flipped", [...s]);
	}

	async unflipArcanum(slug) {
		const s = this.flippedSlugs;
		s.delete(slug);
		await this._flags.setFlag("flipped", [...s]);
	}

	async setUnlockCount(arcanumSlug, optionSlug, count) {
		const key = `${arcanumSlug}:${optionSlug}`;
		await this._flags.setFlag("unlock", { ...this.unlockCounts, [key]: count });
	}

	async setBackOptionCount(arcanumSlug, optionSlug, count) {
		const key = `${arcanumSlug}:${optionSlug}`;
		await this._flags.setFlag("backOptions", { ...this.backOptionCounts, [key]: count });
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
