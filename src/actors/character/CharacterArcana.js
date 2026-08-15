import {
	ArcanaSnapshot, ArcanaSectionSnapshot, ArcanumSnapshotBuilder, ArcanumRenderContext,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { OwnedArcanum } from "./OwnedArcanum.js";
import { GrantedItems } from "../GrantedItems.js";
import { GrantSource } from "../../model/data/ItemGrant.js";

export class CharacterArcana {
	constructor(actor, arcanaRepo, stats = null, followers = null, factory = null, moves = null,
	            containerOutfitSync = null, grantedItems = new GrantedItems(actor)) {
		this._actor = actor;
		this._grantedItems = grantedItems;
		this._arcanaRepo = arcanaRepo;
		this._stats = stats;
		this._followers = followers;
		this._factory = factory;
		this._moves = moves;
		this._outfitSync = containerOutfitSync;
	}

	get ownedSlugs() {
		return new Set(OwnedArcanum.all(this._actor).map(a => a.slug).filter(Boolean));
	}

	async buildSnapshot(checkedMap = {}, resourceController = null) {
		const stats = this._stats?.getStats() ?? {};
		// Inline follower cards are NOT resolved here — the card emits slug references, and the template
		// resolves each against the character's normalized `followers.bySlug` registry.
		const snapshots = await Promise.all(OwnedArcanum.all(this._actor).map(async a => {
			const ctx = new ArcanumRenderContext({
				flipped:       a.flipped,
				choiceValues:  a.choiceValues,
				stats,
				current:       resourceController?.getCurrent("inventory", a.slug) ?? 0,
				checked:       checkedMap[a.slug] ?? false,
				owned:         true,
			});
			return ArcanumSnapshotBuilder.fromArcanum(a.definition(), ctx);
		}));

		const minor = new ArcanaSectionSnapshot("Minor Arcana", snapshots.filter(s => !s.major));
		const major = new ArcanaSectionSnapshot("Major Arcana", snapshots.filter(s => s.major));
		return new ArcanaSnapshot(minor, major);
	}

	async sendArcanumMoveToChat(moveId) {
		for (const arcanum of OwnedArcanum.all(this._actor)) {
			const move = arcanum.moveById(moveId);
			if (move) {
				await this._actor.sendDescriptionToChat(move.name, move.text);
				return true;
			}
		}
		return false;
	}

	async addArcanum(slug) {
		if (this.ownedSlugs.has(slug)) return;
		const [arcanum] = await this._arcanaRepo.findBySlugs([slug]);
		if (!arcanum) return;
		const [created] = await this._grantedItems.addAuthored([{
			name: arcanum.name ?? arcanum.slug, img: arcanum.img ?? null, type: "arcanum",
			system: {
				slug: arcanum.slug, major: arcanum.major,
				front: arcanum.front, back: arcanum.back,
				flipped: false, choiceValues: {},
			},
		}]);
		await this.onArcanumCreated(created);
	}

	/**
	 * Everything a card wants the character to own: the followers it references (off the roster tab
	 * until a mark puts them there) and its moves as real, rollable move items. The moves are granted
	 * ACQUIRED — the "unlocked" checkbox is the granting entry's ornamental track, not the move's
	 * acquire state.
	 */
	async arcanumGrants(item) {
		const arcanum = new OwnedArcanum(item, this._actor);
		if (!arcanum.slug) return [];
		const label = arcanum.name ?? arcanum.slug;
		return [
			await this._followers?.arcanumGrants(arcanum.slug, arcanum.followerSlugs()),
			await this._moves?.categoryGrants(`arcana-${arcanum.slug}`, label, arcanum.moveSlugs, arcanum.moveSlugs),
		].filter(Boolean);
	}

	// What a card does beyond the items it grants (its gear, which the outfit sync owns).
	async syncSideEffectsFor(item) {
		const arcanum = new OwnedArcanum(item, this._actor);
		if (arcanum.slug) await this._syncSideEffects(arcanum);
	}

	// For callers with no router behind them (the sheet's add, the migration replaying owned arcana):
	// apply the card's grants and its side effects, exactly as the router would.
	async onArcanumCreated(item) {
		for (const set of await this.arcanumGrants(item)) await this._grantedItems.sync(set);
		await this.syncSideEffectsFor(item);
	}

	async removeArcanum(slug) {
		await OwnedArcanum.bySlug(this._actor, slug)?.delete();
		await this._outfitSync?.clear("arcana:" + slug);
		await this._grantedItems.revoke(GrantSource.arcanum(slug));
	}

	async flipArcanum(slug) {
		const arcanum = OwnedArcanum.bySlug(this._actor, slug);
		if (!arcanum) return;
		await arcanum.flip();
		await this._syncSideEffects(arcanum);
	}

	async unflipArcanum(slug) {
		const arcanum = OwnedArcanum.bySlug(this._actor, slug);
		if (!arcanum) return;
		await arcanum.unflip();
		await this._syncSideEffects(arcanum);
	}

	// Every arcanum choice group (front.choices[i] / back.choices[i]) shares the ONE
	// `choiceValues` store, namespaced by each group's own slug — side effects fire via the factory's
	// subscribers when a group carries them.
	controllerFor(arcanumSlug) {
		return OwnedArcanum.bySlug(this._actor, arcanumSlug)?.choiceController(this._factory) ?? null;
	}

	async setChoiceCount(arcanumSlug, groupSlug, optionSlug, count) {
		await this.controllerFor(arcanumSlug)?.setCount(groupSlug, optionSlug, count);
	}

	async selectChoice(arcanumSlug, groupSlug, optionSlug, siblingsCsv) {
		await this.controllerFor(arcanumSlug)?.selectOption(groupSlug, optionSlug, siblingsCsv);
	}

	async setChoiceText(arcanumSlug, groupSlug, optionSlug, text) {
		await this.controllerFor(arcanumSlug)?.setText(groupSlug, optionSlug, text);
	}

	// Write-in blank fields (the `@Blank[key]` tokens in an arcanum's text) persist in the same
	// `choiceValues` store under a reserved `"blanks"` namespace, keyed by the blank's stable index.
	async setBlankValue(arcanumSlug, key, text) {
		await this.controllerFor(arcanumSlug)?.setText("blanks", String(key), text);
	}

	getBlanks(arcanumSlug) {
		return OwnedArcanum.bySlug(this._actor, arcanumSlug)?.blanks ?? {};
	}

	// Registered with ContainerOutfitSync, which calls it with a raw arcanum item.
	static outfitGrantFor(item) {
		return new OwnedArcanum(item).outfitGrant();
	}

	async _syncSideEffects(arcanum) {
		await arcanum.syncOutfit(this._outfitSync);
	}
}
