import { FoundryMoveRepository } from "../character/repositories/FoundryMoveRepository.js";
import { ResourceController } from "../character/ResourceController.js";
import { MoveCategorySnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
import { ReferenceMoveSeeder } from "../ReferenceMoveSeeder.js";
import {
	withCategoryFields,
	computeSelectable,
	incrementMove,
	decrementMove,
	buildMoveSnapshot,
} from "../embeddedMoves.js";
import { toSlug } from "../../utils/slug.js";

const CATEGORY_KEY = "homefront";

// Homefront moves are the steading's equivalent of a character's basic moves: reference moves that
// live in the moves compendium and are seeded (acquired, checked by default) onto every steading as
// embedded `move` items. Going through the standard embedded-move flow — rather than building
// snapshots straight from the compendium — is what gives them an ownedId (so rolls resolve the item
// and show 10+/7–9/6– tiers) and a live ResourceSnapshot (so resource boxes are clickable + persist).
export class SteadingMoves {
	constructor(actor, moveRepo = new FoundryMoveRepository(), resourceController = new ResourceController(actor)) {
		this._actor              = actor;
		this._repo               = moveRepo;
		this._resourceController = resourceController;
		this._seeder             = new ReferenceMoveSeeder(actor, moveRepo);
	}

	// Seeds the homefront reference moves onto the steading as owned `move` items. Called once, at
	// actor creation (CreateActor hook) — NOT on render. After that the moves are ordinary owned
	// items: the GM can edit, delete, or re-add them via drag-drop (addMove).
	async seedHomefrontMoves() {
		await this._seeder.seed(CATEGORY_KEY);
	}

	// A move dropped onto the steading joins the homefront list — the only move list the steading
	// renders — with the same category stamping the seed applies (a raw embed would be invisible:
	// buildSnapshot reads by categoryKey). Dedupes by stored slug: re-dropping a move the steading
	// already has is a no-op.
	async addMove(item) {
		const slug = item.system?.slug ?? toSlug(item.name);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === CATEGORY_KEY);
		if (existing.some(i => (i.system?.slug ?? toSlug(i.name)) === slug)) return;
		await this._actor.createEmbeddedDocuments("Item", [
			withCategoryFields(item.toObject(), CATEGORY_KEY, true, {
				sortOrder:    existing.length,
				compendiumId: item.pack ? item._id ?? null : null,
			}),
		]);
	}

	async incrementMove(moveSlug) {
		await incrementMove(this._actor, CATEGORY_KEY, moveSlug);
	}

	async decrementMove(moveSlug) {
		await decrementMove(this._actor, CATEGORY_KEY, moveSlug);
	}

	async setMoveResourceCurrent(moveSlug, current) {
		await this._resourceController.set("moves", moveSlug, current);
	}

	// Resource pip semantics: clicking the highest lit pip clears it (current = index); clicking an
	// unlit pip fills up to and including it (current = index + 1).
	async toggleResourcePip(moveSlug, index, wasChecked) {
		const i = Number(index);
		await this.setMoveResourceCurrent(moveSlug, wasChecked ? i : i + 1);
	}

	async setMoveResourceText(moveSlug, value) {
		await this._resourceController.setText("moves", moveSlug, value);
	}

	// Description is left as a RichText for the shared enrichRichTextTree pass (run in the sheet's
	// getData) — buildMoveSnapshot wraps it, no bespoke enrichHTML here.
	async buildSnapshot() {
		// Alphabetical by name: homefront moves are a fixed reference set, so the seed/sortOrder is
		// meaningless to the reader (and can get scrambled by reseeds) — an A–Z list is what the
		// sheet wants.
		const items = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === CATEGORY_KEY)
			.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
		if (!items.length) return null;
		const moves = await Promise.all(items.map(item =>
			buildMoveSnapshot(item, CATEGORY_KEY, computeSelectable(item), true, this._resourceController)
		));
		return new MoveCategorySnapshotBuilder()
			.withKey(CATEGORY_KEY)
			.withLabel("Homefront Moves")
			.withRenderStyle("standard")
			.withAllowAdditional(false)
			.withNote(null)
			.withMoves(moves)
			.build();
	}
}
