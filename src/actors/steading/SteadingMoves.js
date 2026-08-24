import { FoundryMoveRepository } from "../character/repositories/FoundryMoveRepository.js";
import { ResourceController } from "../character/ResourceController.js";
import { MoveCategorySnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
import { ReferenceMoveSeeder } from "../ReferenceMoveSeeder.js";
import { GrantedItems } from "../GrantedItems.js";
import { SteadingMoveCategories } from "../../model/data/steading/SteadingMoveCategories.js";
import {
	withCategoryFields,
	computeSelectable,
	incrementMove,
	decrementMove,
	buildMoveSnapshot,
	findMoveItemBySlug,
	openMoveSheet,
} from "../embeddedMoves.js";
import { toSlug } from "../../utils/slug.js";

// A steading's moves are its equivalent of a character's basic moves: reference moves that live in
// the moves compendium and are seeded (acquired, checked by default) onto every steading as embedded
// `move` items, grouped into the categories SteadingMoveCategories names. Going through the standard
// embedded-move flow — rather than building snapshots straight from the compendium — is what gives
// them an ownedId (so rolls resolve the item and show 10+/7–9/6– tiers) and a live ResourceSnapshot
// (so resource boxes are clickable + persist).
export class SteadingMoves {
	constructor(actor, moveRepo = new FoundryMoveRepository(), resourceController = new ResourceController(actor),
	            grantedItems = new GrantedItems(actor)) {
		this._actor              = actor;
		this._repo               = moveRepo;
		this._resourceController = resourceController;
		this._grantedItems       = grantedItems;
		this._seeder             = new ReferenceMoveSeeder(actor, moveRepo, grantedItems);
	}


	/** Open this move's own item sheet — see embeddedMoves.openMoveSheet. */
	async openSheet(moveSlug) {
		return openMoveSheet(this._actor, moveSlug, this._repo);
	}

	// Seeds every category's reference moves onto the steading as owned `move` items. Called once, at
	// actor creation (CreateActor hook) — NOT on render. After that the moves are ordinary owned
	// items: the GM can edit, delete, or re-add them via drag-drop (addMove).
	async seedReferenceMoves() {
		for (const category of SteadingMoveCategories.all()) {
			await this._seeder.seed(category.key);
		}
	}

	// Seeds only the categories this steading has nothing from — the backfill a migration wants, so a
	// category added to the packs later reaches existing steadings without handing back individual
	// moves their GM deleted on purpose. Mirrors migrateReferenceMoveCategories for characters.
	async seedMissingCategories() {
		for (const category of SteadingMoveCategories.all()) {
			if (!this._movesIn(category.key).length) await this._seeder.seed(category.key);
		}
	}


	// Re-files moves whose stored moveType disagrees with the category they were stamped into — what
	// happens to already-seeded steadings when a move moves house in the packs. Must run BEFORE a
	// re-seed: left in the old category, a move looks absent from the new one and seeds a duplicate.
	async restampCategories() {
		const updates = [...this._actor.items]
			.filter(i => i.type === "move")
			.filter(i => {
				const moveType = i.system?.moveType;
				return SteadingMoveCategories.byKey(moveType) && i.system?.categoryKey !== moveType;
			})
			.map(i => ({ _id: i._id, system: { categoryKey: i.system.moveType } }));
		if (updates.length) await this._actor.updateEmbeddedDocuments("Item", updates);
	}

	// A move dropped onto the steading joins the category its own moveType names, or homefront when
	// that isn't one of ours — with the same category stamping the seed applies (a raw embed would be
	// invisible: buildSnapshot reads by categoryKey). Dedupes by stored slug across every category:
	// re-dropping a move the steading already has is a no-op.
	async addMove(item) {
		const slug     = item.system?.slug ?? toSlug(item.name);
		const owned    = [...this._actor.items]
			.filter(i => i.type === "move" && SteadingMoveCategories.byKey(i.system?.categoryKey));
		if (owned.some(i => (i.system?.slug ?? toSlug(i.name)) === slug)) return;
		const category = SteadingMoveCategories.byKey(item.system?.moveType) ?? SteadingMoveCategories.defaultCategory();
		await this._grantedItems.addAuthored([
			withCategoryFields(item.toObject(), category.key, true, {
				sortOrder:    owned.filter(i => i.system?.categoryKey === category.key).length,
				compendiumId: item.pack ? item._id ?? null : null,
			}),
		]);
	}

	async incrementMove(categoryKey, moveSlug) {
		await incrementMove(this._actor, categoryKey, moveSlug);
	}

	async decrementMove(categoryKey, moveSlug) {
		await decrementMove(this._actor, categoryKey, moveSlug);
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


	// Post the move's full text (description + all result tiers) to chat, without rolling.
	async sendToChat(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		if (item) await this._actor.sendItemToChat(item);
	}

	// One MoveCategorySnapshot per non-empty category the Moves TAB lists. Categories that claim a
	// tab of their own are excluded — their owner asks for them by name via categorySnapshot — so
	// nothing here or above has to know which key that is.
	//
	// Descriptions are left as RichText for the shared enrichRichTextTree pass (run in the sheet's
	// getData) — buildMoveSnapshot wraps them, no bespoke enrichHTML here.
	async buildSnapshot() {
		const built = await Promise.all(SteadingMoveCategories.inMovesList().map(c => this._buildCategory(c)));
		return built.filter(Boolean);
	}

	/** One category by key, for the tab that owns it. Null when the steading carries none of its moves. */
	async categorySnapshot(categoryKey) {
		const category = SteadingMoveCategories.byKey(categoryKey);
		return category ? this._buildCategory(category) : null;
	}

	async _buildCategory(category) {
		const items = this._sortedMovesIn(category);
		if (!items.length) return null;
		const moves = await Promise.all(items.map(item =>
			buildMoveSnapshot(item, category.key, computeSelectable(item), true, this._resourceController)
		));
		return new MoveCategorySnapshotBuilder()
			.withKey(category.key)
			.withLabel(category.label)
			.withRenderStyle("standard")
			.withAllowAdditional(false)
			.withNote(null)
			.withMoves(moves)
			.build();
	}

	// The category's own reading order first, then A–Z for whatever it doesn't name. The seed's
	// sortOrder is deliberately ignored: it's meaningless to the reader and reseeds can scramble it.
	_sortedMovesIn(category) {
		return this._movesIn(category.key).sort((a, b) =>
			category.rank(a.system?.slug ?? toSlug(a.name)) - category.rank(b.system?.slug ?? toSlug(b.name))
			|| (a.name ?? "").localeCompare(b.name ?? "")
		);
	}

	_movesIn(categoryKey) {
		return [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === categoryKey);
	}
}
