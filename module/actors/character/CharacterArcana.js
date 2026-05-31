import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumBackSnapshotBuilder, ArcanumFrontSnapshotBuilder,
	ArcanumSnapshotBuilder,
	ResourceBuilder,
	ChoiceGroup, ChoiceValues,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";

export class CharacterArcana {
	constructor(flags, arcanaRepo, stats = null, outfitItems = null, followers = null) {
		this._flags = flags;
		this._arcanaRepo = arcanaRepo;
		this._stats = stats;
		this._outfitItems = outfitItems;
		this._followers = followers;
	}

	get ownedSlugs() {
		return new Set(this._flags.getFlag("owned") ?? []);
	}

	get flippedSlugs() {
		return new Set(this._flags.getFlag("flipped") ?? []);
	}

	get _unlockValues() {
		return new ChoiceValues(this._flags.getFlag("unlock") ?? {});
	}

	get _backChoiceValues() {
		return new ChoiceValues(this._flags.getFlag("backChoices") ?? {});
	}

	_followerRowsFor(item) {
		return (item?.back?.choices?.list ?? []).filter(r => r.type === "follower");
	}

	_followerSlugsFor(item) {
		return this._followerRowsFor(item).map(r => r.followerSlug);
	}

	async buildSnapshot(checkedMap = {}, inventoryResources = {}) {
		const stats = this._stats?.getStats() ?? {};
		const ownedSlugs = this.ownedSlugs;
		const flippedSlugs = this.flippedSlugs;
		const unlockValues = this._unlockValues;
		const backChoiceValues = this._backChoiceValues;

		const fetchedItems = await this._arcanaRepo.findBySlugs([...ownedSlugs]);

		const allLinkedSlugs = fetchedItems.flatMap(item => this._followerSlugsFor(item));
		const followerSnapshots = this._followers
			? await this._followers.buildSnapshot(allLinkedSlugs)
			: [];
		const followersBySlug = Object.fromEntries(followerSnapshots.map(f => [f.slug, f]));

		const snapshots = fetchedItems.map(item => {
			const flipped = flippedSlugs.has(item.slug);
			const unlock = item.front.unlock
				? ChoiceGroup.fromPackData(item.front.unlock, unlockValues)
				: null;

			const front = new ArcanumFrontSnapshotBuilder()
				.withTitle(item.front.title)
				.withItem(this._buildOutfitItem(item.slug, item.front.item))
				.withDescription(item.front.description)
				.withUnlock(unlock)
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
		const slugsWeHae = this.ownedSlugs;
		slugsWeHae.add(slug);
		await this._flags.setFlag("owned", [...slugsWeHae]);
		await this._syncSideEffects(slug);
	}

	async removeArcanum(slug) {
		const s = this.ownedSlugs;
		s.delete(slug);
		await this._flags.setFlag("owned", [...s]);
		await this._outfitItems?.deleteBySource("arcana:" + slug);
		const [item] = await this._arcanaRepo.findBySlugs([slug]);
		for (const row of this._followerRowsFor(item)) {
			await this._followers?.removeFollower(row.followerSlug);
		}
	}

	async flipArcanum(slug) {
		const s = this.flippedSlugs;
		s.add(slug);
		await this._flags.setFlag("flipped", [...s]);
		await this._syncSideEffects(slug);
	}

	async unflipArcanum(slug) {
		const s = this.flippedSlugs;
		s.delete(slug);
		await this._flags.setFlag("flipped", [...s]);
		await this._syncSideEffects(slug);
	}

	async setUnlockCount(arcanumSlug, optionSlug, count) {
		await this._flags.setFlag("unlock", this._unlockValues.set(arcanumSlug, optionSlug, count).toRaw());
	}

	async setBackChoiceValue(arcanumSlug, optionSlug, count) {
		await this._flags.setFlag("backChoices", this._backChoiceValues.set(arcanumSlug, optionSlug, count).toRaw());
		if (this._followers) {
			if (count > 0) {
				await this._followers.addFollower(optionSlug);
			} else {
				await this._followers.removeFollower(optionSlug);
			}
		}
	}

	async _syncSideEffects(slug) {
		const items = await this._arcanaRepo.findBySlugs([slug]);
		const item = items[0];
		if (!item) {
			await this._outfitItems?.deleteBySource("arcana:" + slug);
			return;
		}
		await this._syncEmbeddedItemWith(slug, item);
		await this._syncFollowers(slug, item);
	}

	async _syncEmbeddedItemWith(slug, item) {
		if (!this._outfitItems) return;
		const flipped = this.flippedSlugs.has(slug);
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
				.withBreakBefore(false)
				.withSource("arcana:" + slug)
				.build(),
		]);
	}

	async _syncFollowers(slug, item) {
		if (!this._followers) return;
		const rows = this._followerRowsFor(item);
		if (!rows.length) return;
		const flipped = this.flippedSlugs.has(slug);
		for (const row of rows) {
			if (flipped) await this._followers.addFollower(row.followerSlug);
			else         await this._followers.removeFollower(row.followerSlug);
		}
	}
}
