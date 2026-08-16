import { findMoveItemBySlug, withCategoryFields } from "./embeddedMoves.js";
import { GrantedItems } from "./GrantedItems.js";
import { GrantSource, ItemGrant, ItemGrantSet } from "../model/data/ItemGrant.js";
import { toSlug } from "../utils/slug.js";

// Seeds one category of reference moves (character basic/special/follower; steading homefront) from
// the compendium onto an actor as owned `move` items. Runs once, at actor creation (CreateActor
// hook) — never on render. Idempotent by STORED slug (`system.slug`, name-derived only as a
// fallback), so a re-seed can't duplicate and a renamed embedded move is still recognized as
// already seeded. Seeded acquired — checked by default but toggleable, like starting moves.
//
// Seeded, not synced: a GM who deletes a reference move means it, so a move the packs still list but
// the character no longer has stays gone. That is the one difference from every other grant.
//
// CharacterMoves and SteadingMoves COMPOSE this; the category vocabulary stays with them.
export class ReferenceMoveSeeder {
	constructor(actor, moveRepo, grantedItems = new GrantedItems(actor)) {
		this._actor = actor;
		this._repo  = moveRepo;
		this._grantedItems = grantedItems;
	}

	async seed(categoryKey) {
		await this._embedMissing(categoryKey, await this._repo.getReferenceMovesByType(categoryKey));
	}

	// Seeds only the NAMED slugs of a category — for a reference move that joined the packs after the
	// category itself shipped, which `seed` can't reach on an existing actor (its caller only re-seeds
	// categories the actor has nothing from, so a blanket top-up would hand back the moves a GM
	// deleted on purpose). Naming the slug scopes the top-up to the one move that is genuinely new.
	// Presence is checked across ALL categories here: a move dragged in by hand lands under "other",
	// and seeding a second copy of it into the sidebar would be a duplicate the player has to clean up.
	async seedSlugs(categoryKey, slugs) {
		const wanted  = new Set(slugs);
		const entries = await this._repo.getReferenceMovesByType(categoryKey);
		await this._embedMissing(
			categoryKey,
			entries.filter(m => wanted.has(m.slug) && !findMoveItemBySlug(this._actor, m.slug))
		);
	}

	async _embedMissing(categoryKey, candidates) {
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === categoryKey);
		const existingSlugs = new Set(existing.map(i => i.system?.slug ?? toSlug(i.name)));
		const newEntries = candidates.filter(m => !existingSlugs.has(m.slug));
		if (!newEntries.length) return;
		const docs = await Promise.all(newEntries.map(m => this._repo.getReferencedMoveDocument(m.id)));
		await this._grantedItems.seed(new ItemGrantSet(
			GrantSource.reference(categoryKey),
			docs.filter(Boolean).map((d, i) => new ItemGrant(
				withCategoryFields(d.toObject(), categoryKey, true, { sortOrder: existing.length + i, compendiumId: d._id ?? null }))),
		));
	}
}
