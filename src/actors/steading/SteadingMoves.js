import { FoundryMoveRepository } from "../character/repositories/FoundryMoveRepository.js";
import { ResourceController } from "../character/ResourceController.js";
import { MoveCategorySnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
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
	}

	// Idempotent: only homefront moves whose slug isn't already embedded are added, so re-render (and
	// re-open) never duplicates them. Seeded acquired → they render checked by default but stay
	// toggleable (the same mechanism playbook starting moves use).
	async seedHomefrontMoves() {
		const entries = await this._repo.getMovesByType(CATEGORY_KEY);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === CATEGORY_KEY);
		const existingSlugs = new Set(existing.map(i => i.system?.slug ?? toSlug(i.name)));
		const newEntries = entries.filter(m => !existingSlugs.has(m.slug));
		if (!newEntries.length) return;
		const docs = await Promise.all(newEntries.map(m => this._repo.getReferencedMoveDocument(m.id)));
		await this._actor.createEmbeddedDocuments("Item",
			docs.filter(Boolean).map((d, i) =>
				withCategoryFields(d.toObject(), CATEGORY_KEY, true, { sortOrder: existing.length + i, compendiumId: d._id ?? null })
			)
		);
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

	async setMoveResourceText(moveSlug, value) {
		await this._resourceController.setText("moves", moveSlug, value);
	}

	// Description is left as a RichText for the shared enrichRichTextTree pass (run in the sheet's
	// getData) — buildMoveSnapshot wraps it, no bespoke enrichHTML here.
	async buildSnapshot() {
		const items = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === CATEGORY_KEY)
			.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
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
