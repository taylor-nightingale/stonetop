import { GrantedItems } from "../GrantedItems.js";
import {
	MoveCategorySnapshotBuilder,
	MovelistBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {
	computeSelectable,
	buildMoveSnapshot,
	findMoveItemBySlug,
	moveSlugOf,
	openMoveSheet,
	resolveMoveBySlug,
} from "../embeddedMoves.js";
import { CharacterMoveGrants } from "./CharacterMoveGrants.js";
import { OutfitEffects } from "../../model/data/character/OutfitEffect.js";

export class CharacterMoves {
	constructor(moveRepo, actor, resourceController, factory, grantedItems = new GrantedItems(actor), requirements) {
		for (const [name, value] of Object.entries({ moveRepo, actor, resourceController, factory, requirements })) {
			if (!value) throw new Error(`CharacterMoves needs a ${name}`);
		}
		this._moveRepo           = moveRepo;
		this._actor              = actor;
		this._resourceController = resourceController;
		this._factory            = factory;
		this._grantedItems       = grantedItems;
		this._requirements       = requirements;
		this._grants             = new CharacterMoveGrants(moveRepo, actor, grantedItems);
	}

	/** The moves this character has actually taken. Derived fresh: they take more. */
	get acquiredMoves() {
		return [...this._actor.items].filter(i => i.type === "move" && (i.system?.acquired ?? false));
	}

	/** The slugs of those moves. */
	get acquiredSlugs() {
		return new Set(this.acquiredMoves.map(i => moveSlugOf(i)));
	}

	/** What the taken moves do to this character's gear — Armored's shield and its *cumbersome*. An
	 *  untaken move on the sheet is one being weighed up, and changes nothing about what is carried. */
	get outfitEffects() {
		return OutfitEffects.from(this.acquiredMoves.flatMap(i => i.system?.outfitEffects ?? []));
	}

	// Which move items the character owns, and why. Delegated so a caller that only grants — the
	// migrations — can construct that half alone, without null in the slots it does not need.
	get REFERENCE_CATEGORIES() { return CharacterMoveGrants.REFERENCE_CATEGORIES; }

	initBasicMoves()                       { return this._grants.initBasicMoves(); }
	seedReferenceCategory(categoryKey)     { return this._grants.seedReferenceCategory(categoryKey); }
	seedReferenceSlugs(categoryKey, slugs) { return this._grants.seedReferenceSlugs(categoryKey, slugs); }
	initPlaybookCategory(playbookData)     { return this._grants.initPlaybookCategory(playbookData); }
	playbookGrants(data, alsoStarting)     { return this._grants.playbookGrants(data, alsoStarting); }
	addCategory(key, label, slugs, start)  { return this._grants.addCategory(key, label, slugs, start); }
	categoryGrants(key, label, slugs, st)  { return this._grants.categoryGrants(key, label, slugs, st); }
	removeCategory(key)                    { return this._grants.removeCategory(key); }
	incrementMove(categoryKey, moveSlug)   { return this._grants.incrementMove(categoryKey, moveSlug); }
	decrementMove(categoryKey, moveSlug)   { return this._grants.decrementMove(categoryKey, moveSlug); }

	// A move the player dropped in. Matched on the STORED slug, like every other move lookup — matching
	// on the name alone let a renamed move in as a second copy of one already there.
	async addMoveToOther(moveData) {
		const moveSlug = moveSlugOf(moveData);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === "other");
		if (existing.some(i => moveSlugOf(i) === moveSlug)) return false;
		await this._grantedItems.addAuthored([{
			...moveData,
			name: moveData.name,
			type: "move",
			system: {
				...moveData.system,
				moveType: "other", categoryKey: "other", categoryLabel: null, categoryNote: null,
				acquired: true, instanceCount: 1,
				sortOrder: existing.length, compendiumId: moveData._id ?? null,
			},
		}]);
		return true;
	}

	async deleteMove(moveSlug) {
		const item = [...this._actor.items].find(
			i => i.type === "move" && i.system?.categoryKey === "other" && moveSlugOf(i) === moveSlug
		);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	// Roll the move a rendered row stands for. Returns false when nothing carries the slug, so a
	// caller with a fallback (an arcanum's inline move is text, not an item) can take over.
	async roll(moveSlug) {
		const item = await resolveMoveBySlug(this._actor, moveSlug, this._moveRepo);
		if (!item) return false;
		await this._actor.rollItem(item);
		return true;
	}

	// Post the move's full text (description + all result tiers) to chat, without rolling. Returns
	// false when no owned move item carries the slug (the caller may have a non-item fallback).
	async sendToChat(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		if (!item) return false;
		await this._actor.sendItemToChat(item);
		return true;
	}

	// The same, for a move the character does NOT have: a background it has not taken grants one, and
	// that row is drawn so the reader can weigh it up. Its die already rolls from the catalog
	// (`roll`, via resolveMoveBySlug) — the chat bubble beside it was the only control on the row that
	// silently did nothing. Last resort, so an owned copy and an arcanum's inline text both win: see
	// StonetopCharacter#sendMoveToChat.
	async sendCatalogToChat(moveSlug) {
		const item = await resolveMoveBySlug(this._actor, moveSlug, this._moveRepo);
		if (!item) return false;
		await this._actor.sendItemToChat(item);
		return true;
	}

	/** Open this move's own item sheet — see embeddedMoves.openMoveSheet. */
	async openSheet(moveSlug) {
		return openMoveSheet(this._actor, moveSlug, this._moveRepo);
	}

	/** The controller for one move's picks, or null when the move is absent or has no choice group. */
	controllerFor(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		return item?.system?.choices ? this._factory.forDocument(item._id, "pickValues") : null;
	}

	// The current value of a move's own track — the Thrall's Favor, say. Null when the character
	// doesn't own the move or the move has no track, which keeps "no such stat" distinct from a
	// track sitting at 0.
	resourceValue(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		if (!item?.system?.resource) return null;
		return this._resourceController.getCurrent("moves", moveSlug);
	}

	async setMoveResourceCurrent(moveSlug, current) {
		await this._resourceController.set("moves", moveSlug, current);
	}

	async setMoveResourceText(moveSlug, value) {
		await this._resourceController.setText("moves", moveSlug, value);
	}

	/**
	 * @param {Object<string, MoveSnapshot>} [referenced] moves a rendered row names by slug that the
	 *   character does not own — a background it has not taken grants one, and the row is on screen so
	 *   the reader can decide. They seed the registry; an owned move of the same slug replaces its
	 *   entry below, because that one carries the item id the die rolls against.
	 */
	async buildSnapshot(referenced = {}) {
		const allMoveItems = [...this._actor.items].filter(i => i.type === "move");
		const resourceController = this._resourceController;
		const acquired           = this.acquiredSlugs;

		// One MoveSnapshot per move item, keyed by slug — the `bySlug` registry an inline move grant (in
		// any choice row) resolves against, so it renders rollable with its resource. Built for EVERY move,
		// including the categories kept off the tab below.
		const snapById = new Map();
		const bySlug   = { ...referenced };
		for (const item of allMoveItems) {
			const snap = buildMoveSnapshot(item, item.system?.categoryKey ?? "other",
				computeSelectable(item), resourceController,
				await this._requirements.snapshotFor(item.system?.requirement, acquired));
			snapById.set(item, snap);
			if (snap.slug) bySlug[snap.slug] = snap;
		}

		// A move whose category renders somewhere else — an arcanum's card, a background's box on the
		// playbook tab — is not listed again here. It still counts toward acquiredSlugs above (for other
		// moves' requirements) and stays in bySlug, so its inline row rolls.
		const tabMoveItems = allMoveItems.filter(_rendersOnMovesTab);

		const byCatKey = new Map();
		for (const item of tabMoveItems) {
			const key = item.system?.categoryKey ?? "other";
			if (!byCatKey.has(key)) byCatKey.set(key, []);
			byCatKey.get(key).push(item);
		}
		for (const items of byCatKey.values()) {
			items.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
		}

		const sortedKeys = [...byCatKey.keys()].sort((a, b) => _categoryOrder(a) - _categoryOrder(b));

		const categories = sortedKeys.map(catKey => {
			const meta  = _categoryMetadata(catKey, byCatKey.get(catKey));
			const moves = byCatKey.get(catKey).map(item => snapById.get(item));
			return new MoveCategorySnapshotBuilder()
				.withKey(meta.key).withLabel(meta.label).withRenderStyle(meta.renderStyle)
				.withAllowAdditional(meta.allowAdditional).withNote(meta.note)
				.withMoves(moves).build();
		});
		return new MovelistBuilder().withCategories(categories).withBySlug(bySlug).build();
	}

	countOwnedBySlug(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		return item?.system?.instanceCount ?? 0;
	}

	async getMoveSnapshotsForCategory(key) {
		const items = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === key)
			.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
		if (!items.length) return [];
		const acquired = this.acquiredSlugs;
		return Promise.all(items.map(async item =>
			buildMoveSnapshot(item, key, computeSelectable(item), this._resourceController,
				await this._requirements.snapshotFor(item.system?.requirement, acquired))
		));
	}

	async onDropMove(itemData) {
		const itemSlug = moveSlugOf(itemData);
		const existing = findMoveItemBySlug(this._actor, itemSlug);
		if (existing) {
			if (computeSelectable(existing)) {
				await this.incrementMove(existing.system?.categoryKey, itemSlug);
				return true;
			}
			return false;
		}
		return this.addMoveToOther(itemData);
	}


}

// ── Private helpers ───────────────────────────────────────────────────────────


function _categoryOrder(key) {
	if (key.startsWith("playbook-")) return 0;
	if (key === "basic")             return 1;
	if (key === "expedition")        return 2;
	if (key === "special")           return 3;
	if (key === "follower")          return 4;
	if (key.startsWith("insert-")) return 5;
	if (key === "other")             return 6;
	return 7;
}

// The reference categories' headings are the sheet's own words, not the book's: no pack ships them,
// so they are localized here like every other label on the sheet. A playbook's or insert's heading is
// NOT one of these — it is that item's name, carried on the move as `categoryLabel`.
const REFERENCE_CATEGORY_LABELS = {
	basic:      "stonetop.character.moves.basicMoves",
	expedition: "stonetop.character.moves.expeditionMoves",
	special:    "stonetop.character.moves.specialMoves",
	follower:   "stonetop.character.moves.followerMoves",
	other:      "stonetop.character.moves.otherMoves",
};

function _categoryMetadata(catKey, catItems) {
	const referenceLabel = key => game.i18n.localize(REFERENCE_CATEGORY_LABELS[key]);
	if (catKey === "basic")      return { key: "basic",      label: referenceLabel("basic"),      renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "expedition") return { key: "expedition", label: referenceLabel("expedition"), renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "special")    return { key: "special",    label: referenceLabel("special"),    renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "follower")   return { key: "follower",   label: referenceLabel("follower"),   renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "other")      return { key: "other",      label: referenceLabel("other"),      renderStyle: "standard", allowAdditional: true,  note: null };
	const label = catItems[0]?.system?.categoryLabel ?? catKey;
	const note  = catItems[0]?.system?.categoryNote  ?? null;
	return { key: catKey, label, renderStyle: "standard", allowAdditional: false, note };
}

// The categories that render on a surface of their own: an arcanum's card, a background's box. Their
// moves are reached there, so the moves tab leaves them out.
const OWN_SURFACE_PREFIXES = ["arcana-", "background-"];

function _rendersOnMovesTab(item) {
	const key = item.system?.categoryKey ?? "";
	return !OWN_SURFACE_PREFIXES.some(prefix => key.startsWith(prefix));
}



