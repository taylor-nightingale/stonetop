import {
	ArcanaSnapshot, ArcanaSectionSnapshot, ChoiceValues,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";
import { Arcanum } from "../../model/data/character/Arcanum.js";
import { buildArcanumSnapshot } from "./arcanumSnapshot.js";
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

	_followerSlugsFor(item) {
		return (item?.back?.choices?.list ?? []).flatMap(r => r.followers ?? []);
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

		const snapshots = fetchedItems.map(item => buildArcanumSnapshot(item, {
			flipped:          flippedBySlug.get(item.slug)    ?? false,
			unlockValues:     unlockBySlug.get(item.slug)     ?? new ChoiceValues({}),
			backChoiceValues: backChoiceBySlug.get(item.slug) ?? new ChoiceValues({}),
			followersBySlug,
			stats,
			current:          resourceController?.getCurrent("inventory", item.slug) ?? 0,
			checked:          checkedMap[item.slug] ?? false,
			owned:            true,
		}));

		const minor = new ArcanaSectionSnapshot("Minor Arcana", snapshots.filter(s => !s.major));
		const major = new ArcanaSectionSnapshot("Major Arcana", snapshots.filter(s =>  s.major));
		return new ArcanaSnapshot(minor, major);
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
		for (const followerSlug of this._followerSlugsFor(arcanum)) {
			await this._followers?.removeLinkedFollower(followerSlug);
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

	async setUnlockPick(arcanumSlug, optionSlug, siblingsCsv) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "unlockValues")
			.selectOption(arcanumSlug, optionSlug, siblingsCsv);
	}

	async setUnlockText(arcanumSlug, optionSlug, text) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "unlockValues")
			.setText(arcanumSlug, optionSlug, text);
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
		const followerSlugs = this._followerSlugsFor(item);
		if (!followerSlugs.length) return;
		const embeddedItem = _findArcanumItem(this._actor, slug);
		const flipped = embeddedItem?.system?.flipped ?? false;
		for (const followerSlug of followerSlugs) {
			if (flipped) await this._followers.addFollower(followerSlug);
			else         await this._followers.removeFollower(followerSlug);
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
