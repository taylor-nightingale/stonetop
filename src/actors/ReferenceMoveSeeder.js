import { withCategoryFields } from "./embeddedMoves.js";
import { toSlug } from "../utils/slug.js";

// Seeds one category of reference moves (character basic/special/follower; steading homefront) from
// the compendium onto an actor as owned `move` items. Runs once, at actor creation (CreateActor
// hook) — never on render. Idempotent by STORED slug (`system.slug`, name-derived only as a
// fallback), so a re-seed can't duplicate and a renamed embedded move is still recognized as
// already seeded. Seeded acquired — checked by default but toggleable, like starting moves.
//
// CharacterMoves and SteadingMoves COMPOSE this; the category vocabulary stays with them.
export class ReferenceMoveSeeder {
	constructor(actor, moveRepo) {
		this._actor = actor;
		this._repo  = moveRepo;
	}

	async seed(categoryKey) {
		const entries  = await this._repo.getReferenceMovesByType(categoryKey);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === categoryKey);
		const existingSlugs = new Set(existing.map(i => i.system?.slug ?? toSlug(i.name)));
		const newEntries = entries.filter(m => !existingSlugs.has(m.slug));
		if (!newEntries.length) return;
		const docs = await Promise.all(newEntries.map(m => this._repo.getReferencedMoveDocument(m.id)));
		await this._actor.createEmbeddedDocuments("Item",
			docs.filter(Boolean).map((d, i) =>
				withCategoryFields(d.toObject(), categoryKey, true, { sortOrder: existing.length + i, compendiumId: d._id ?? null })
			)
		);
	}
}
