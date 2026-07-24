import {
	ArcanaSnapshot, ArcanaSectionSnapshot, ArcanumSnapshotBuilder, ArcanumRenderContext,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { OwnedArcanum } from "./OwnedArcanum.js";

export class CharacterArcana {
	constructor(actor, arcanaRepo, stats = null, followers = null, factory = null, moves = null, containerOutfitSync = null) {
		this._actor = actor;
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
				moveSnapshots: await this._mysteryMoveSnapshots(a),
			});
			return ArcanumSnapshotBuilder.fromArcanum(a.definition(), ctx);
		}));

		const minor = new ArcanaSectionSnapshot("Minor Arcana", snapshots.filter(s => !s.major));
		const major = new ArcanaSectionSnapshot("Major Arcana", snapshots.filter(s => s.major));
		return new ArcanaSnapshot(minor, major);
	}

	// Major arcana own their mystery moves as real `move` items in an `arcana-<slug>` category (seeded
	// un-acquired — the player ticks each to unlock). Minor/custom arcana (no moveSlugs) fall back to the
	// inline back.moves shape in ArcanumBackSnapshotBuilder, so return null for them.
	async _mysteryMoveSnapshots(arcanum) {
		if (!this._moves || !arcanum.moveSlugs.length) return null;
		return this._moves.getMoveSnapshotsForCategory(`arcana-${arcanum.slug}`);
	}

	async sendMysteryMoveToChat(moveId) {
		for (const arcanum of OwnedArcanum.all(this._actor)) {
			const move = arcanum.mysteryMove(moveId);
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
		const [created] = await this._actor.createEmbeddedDocuments("Item", [{
			name: arcanum.name ?? arcanum.slug, img: arcanum.img ?? null, type: "arcanum",
			system: {
				slug: arcanum.slug, major: arcanum.major,
				front: arcanum.front, back: arcanum.back,
				flipped: false, choiceValues: {},
			},
		}]);
		await this.onArcanumCreated(created);
	}

	async onArcanumCreated(item) {
		const arcanum = new OwnedArcanum(item, this._actor);
		if (!arcanum.slug) return;
		// Choice-gated followers (rows with a track) are embedded later by the checkbox side-effect, not here.
		for (const grant of arcanum.ownedFollowerGrants()) {
			await this._followers?.addFollower(grant.slug, { showOnTab: grant.showOnTab });
		}
		await this._syncSideEffects(arcanum);
		if (arcanum.moveSlugs.length) {
			await this._moves?.addCategory(`arcana-${arcanum.slug}`, arcanum.name ?? arcanum.slug, arcanum.moveSlugs, []);
		}
	}

	async removeArcanum(slug) {
		await OwnedArcanum.bySlug(this._actor, slug)?.delete();
		await this._moves?.removeCategory(`arcana-${slug}`);
		await this._outfitSync?.clear("arcana:" + slug);
		await this._followers?.removeByArcanum(slug);
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

	// Every arcanum choice group (front.unlock, back.choices, back.consequences) shares the ONE
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
