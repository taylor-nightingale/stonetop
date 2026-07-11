import {
	ArcanaSnapshot, ArcanaSectionSnapshot, ChoiceValues,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";
import { Arcanum } from "../../model/data/character/Arcanum.js";
import { buildArcanumSnapshot } from "./arcanumSnapshot.js";
export class CharacterArcana {
	constructor(actor, arcanaRepo, stats = null, outfitItems = null, followers = null, factory = null, moves = null) {
		this._actor      = actor;
		this._arcanaRepo = arcanaRepo;
		this._stats      = stats;
		this._outfitItems = outfitItems;
		this._followers  = followers;
		this._factory    = factory;
		this._moves      = moves;
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

		const fetchedItems     = arcanumItems.map(i => _itemToArcanum(i));
		const flippedBySlug    = new Map(arcanumItems.map(i => [i.system?.slug, i.system?.flipped ?? false]));
		const choiceValuesBySlug = new Map(arcanumItems.map(i => [i.system?.slug, new ChoiceValues(i.system?.choiceValues ?? {})]));

		const allLinkedSlugs = fetchedItems.flatMap(item => this._followerSlugsFor(item));
		const followerSnapshots = this._followers
			? await this._followers.buildSnapshot(allLinkedSlugs)
			: [];
		const followersBySlug = Object.fromEntries(followerSnapshots.map(f => [f.slug, f]));

		const snapshots = await Promise.all(fetchedItems.map(async item => buildArcanumSnapshot(item, {
			flipped:          flippedBySlug.get(item.slug)      ?? false,
			choiceValues:     choiceValuesBySlug.get(item.slug) ?? new ChoiceValues({}),
			followersBySlug,
			stats,
			current:          resourceController?.getCurrent("inventory", item.slug) ?? 0,
			checked:          checkedMap[item.slug] ?? false,
			owned:            true,
			moveSnapshots:    await this._mysteryMoveSnapshots(item),
		})));

		const minor = new ArcanaSectionSnapshot("Minor Arcana", snapshots.filter(s => !s.major));
		const major = new ArcanaSectionSnapshot("Major Arcana", snapshots.filter(s =>  s.major));
		return new ArcanaSnapshot(minor, major);
	}

	// Major arcana own their mystery moves as real `move` items in an `arcana-<slug>` category (seeded
	// un-acquired — the player ticks each to unlock). Resolve them through CharacterMoves so the card
	// renders the same move snapshots as the moves tab. Minor/custom arcana (no moveSlugs) fall back to
	// the inline back.moves shape in buildArcanumSnapshot, so return null for them.
	async _mysteryMoveSnapshots(item) {
		if (!this._moves || !(item.back?.moveSlugs?.length)) return null;
		return this._moves.getMoveSnapshotsForCategory(`arcana-${item.slug}`);
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
				flipped: false, choiceValues: {},
			},
		}]);
		await this.onArcanumCreated({ system: { slug, front: arcanum.front, back: arcanum.back } });
	}

	async onArcanumCreated(item) {
		const slug = item.system?.slug;
		if (!slug) return;
		const raw = { front: item.system.front ?? {}, back: item.system.back ?? {} };
		// Followers are NOT embedded on add — they're added/removed only when their back-choice box is
		// checked (the standard FollowerSideEffectHandler path). The card shows an inline preview sourced
		// from the follower repo, so no embedded item is needed until the player checks the box.
		await this._syncEmbeddedItemWith(slug, raw);
		const moveSlugs = raw.back?.moveSlugs ?? [];
		if (moveSlugs.length) await this._moves?.addCategory(`arcana-${slug}`, item.name ?? slug, moveSlugs, []);
	}

	async removeArcanum(slug) {
		const embeddedItem = _findArcanumItem(this._actor, slug);
		if (embeddedItem) await this._actor.deleteEmbeddedDocuments("Item", [embeddedItem._id]);
		await this._moves?.removeCategory(`arcana-${slug}`);
		await this._outfitItems?.deleteBySource("arcana:" + slug);
		await this._followers?.removeByArcanum(slug);
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

	// Every arcanum choice group (front.unlock, back.choices, back.consequences) persists through the
	// ONE `choiceValues` store, namespaced by the group's OWN slug — the same generic path inserts use.
	// `groupSlug` is the choice group's slug; side effects (followers/outfit items) fire via the shared
	// handlers when the resolved group def carries them.
	async setChoiceCount(arcanumSlug, groupSlug, optionSlug, count) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "choiceValues")
			.setCount(groupSlug, optionSlug, count);
	}

	async selectChoice(arcanumSlug, groupSlug, optionSlug, siblingsCsv) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "choiceValues")
			.selectOption(groupSlug, optionSlug, siblingsCsv);
	}

	async setChoiceText(arcanumSlug, groupSlug, optionSlug, text) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "choiceValues")
			.setText(groupSlug, optionSlug, text);
	}

	// Write-in blank fields (the `@Blank[key]` tokens in an arcanum's text) persist as free text in the
	// same `choiceValues` store under a reserved `"blanks"` namespace, keyed by the blank's stable index.
	async setBlankValue(arcanumSlug, key, text) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "choiceValues")
			.setText("blanks", String(key), text);
	}

	/** The stored `{ key: text }` map of write-in blank values for an arcanum (empty when none). */
	getBlanks(arcanumSlug) {
		const item = _findArcanumItem(this._actor, arcanumSlug);
		return item?.system?.choiceValues?.blanks ?? {};
	}

	async _syncSideEffects(slug) {
		const embeddedItem = _findArcanumItem(this._actor, slug);
		if (!embeddedItem) {
			await this._outfitItems?.deleteBySource("arcana:" + slug);
			return;
		}
		const item = _itemToArcanum(embeddedItem);
		await this._syncEmbeddedItemWith(slug, item);
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
				.withTags(sideItem.tags ?? "")
				.withNote(sideItem.note ?? null)
				.withInventoryColumn(sideItem.inventoryColumn)
				.withResource(sideItem.resource ?? null)
				.withTwoCol(false)
				.withSource("arcana:" + slug)
				.build(),
		]);
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
