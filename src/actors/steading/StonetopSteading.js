import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {FortunesSnapshot, SurplusSnapshot, SteadingSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {PlacesOfInterest} from "./PlacesOfInterest.js";
import {SteadingAttributes} from "./SteadingAttributes.js";
import {SteadingDebilities} from "./SteadingDebilities.js";
import {Residents} from "./Residents.js";
import {NeighborPeople} from "./NeighborPeople.js";
import {NeighborPlaces} from "./NeighborPlaces.js";
import {SteadingContent} from "./SteadingContent.js";
import {SteadingAssets} from "./SteadingAssets.js";
import {SteadingImprovements} from "./SteadingImprovements.js";
import {SteadingMoves} from "./SteadingMoves.js";
import {SteadingChoices} from "./SteadingChoices.js";
import {SteadingSeasons} from "./SteadingSeasons.js";
import {SteadingRolls} from "./SteadingRolls.js";
import {SteadingDropRouter} from "./SteadingDropRouter.js";
import {ChoiceStores} from "../character/ChoiceStores.js";
import {applyPick} from "../character/ChoiceGroupController.js";
import {FoundrySteadingRepositoryFactory} from "./repositories/FoundrySteadingRepositoryFactory.js";
import {SteadingPeopleDelta} from "./SteadingPeopleDelta.js";
import {startingAttributeNote} from "./startingAttributeNote.js";
import {applySteadfast, loadSteadfast, matchSteadfastByName} from "./applySteadfast.js";

/**
 * A steading, as the rest of the system talks to one.
 *
 * The collaborators are PRIVATE. Everything a caller needs is a named method here, so a sheet handler
 * reads as one sentence about the steading rather than a walk through its parts — `s.moves.increment…`
 * couples every caller to how the steading happens to be composed today.
 */
export class StonetopSteading {
	#actor;
	#places; #attributes; #debilities; #residents; #neighborPeople; #neighborPlaces;
	#content; #assets; #improvements; #moves; #choices; #seasons; #rolls; #drops; #choiceStores;

	constructor(actor, repos = FoundrySteadingRepositoryFactory.create()) {
		this.#actor          = actor;
		this.#places         = new PlacesOfInterest(actor);
		this.#attributes     = new SteadingAttributes(actor);
		this.#debilities     = new SteadingDebilities(actor);
		this.#residents      = new Residents(actor, repos.npcs);
		this.#neighborPeople = new NeighborPeople(actor, repos.npcs);
		this.#neighborPlaces = new NeighborPlaces(actor);
		this.#content        = new SteadingContent(actor);
		this.#assets         = new SteadingAssets(actor);
		this.#improvements   = new SteadingImprovements(actor, repos.improvements);
		this.#moves          = new SteadingMoves(actor, repos.moves);
		this.#choices        = new SteadingChoices(actor);
		this.#seasons        = new SteadingSeasons(this.#choices, this.#moves, repos.art);
		this.#rolls          = new SteadingRolls(actor, this.#debilities);
		// Where a choice write goes, keyed by the context its row was rendered in — the same registry
		// the character uses, so both answer the shared choice wiring identically. A move's picks live
		// on that ITEM, which is why `move` resolves through SteadingMoves rather than the steading's
		// own store.
		this.#choiceStores = new ChoiceStores()
			.register("improvement", () => this.#improvements.controller())
			.register("steading",    () => this.#choices.controller())
			.register("move",        t  => this.#moves.controllerFor(t.moveSlug));
		this.#drops          = new SteadingDropRouter()
			.register("steadfast",   item => applySteadfast(actor, item))
			.register("move",        item => this.#moves.addMove(item))
			.register("improvement", item => this.#improvements.grant(item.system?.slug));
	}

	get type() { return "steading"; }
	get name() { return this.#actor.name; }

	// ── Rolling ────────────────────────────────────────────────────────────────

	getRollableStats()                              { return this.#rolls.rollableStats(); }
	resolveBonus(rollStat)                          { return this.#rolls.resolveBonus(rollStat); }
	applyRollMode(rollStat, rollMode, moveSlug)     { return this.#rolls.applyRollMode(rollStat, rollMode, moveSlug); }
	get prosperity()                                { return this.#rolls.prosperity; }
	get isLacking()                                 { return this.#rolls.isLacking; }

	get rollMode() { return this.#actor.getFlag("stonetop", "rollMode") ?? "normal"; }

	async setRollMode(mode) {
		await this.#actor.setFlag("stonetop", "rollMode", mode);
	}

	// ── Ratings ────────────────────────────────────────────────────────────────

	get fortunesCurrent() { return this.#actor.system.attributes?.fortunes ?? 0; }
	get surplusCurrent()  { return this.#actor.system.attributes?.surplus  ?? 0; }
	get notes()           { return this.#actor.system.notes ?? ""; }

	async setFortunes(value) { await this.#actor.update({"system.attributes.fortunes": value}); }
	async setSurplus(value)  { await this.#actor.update({"system.attributes.surplus": value}); }
	async setNotes(value)    { await this.#actor.update({"system.notes": value}); }

	async setAttribute(attr, value)                  { await this.#attributes.setValue(attr, value); }
	async addAttributeItem(attr)                     { await this.#attributes.addNewItemToAttribute(attr); }
	async removeAttributeItem(attr, index)           { await this.#attributes.removeItemFromAttribute(attr, index); }
	async updateAttributeItem(attr, index, value)    { await this.#attributes.updateItemOnAttribute(attr, index, value); }

	async setDebility(slug, active) { await this.#debilities.setDebility(slug, active); }

	// ── Content, assets, coinage ───────────────────────────────────────────────

	async updateContentText(type, value)     { await this.#content.updateText(type, value); }
	async addAssetItem()                     { await this.#assets.addItem(); }
	async removeAssetItem(index)             { await this.#assets.removeItem(index); }
	async updateAssetItem(index, value)      { await this.#assets.updateItem(index, value); }
	async updateCoinagePurses(title, count)  { await this.#assets.updatePurses(title, count); }
	async updateCoinageHandfuls(title, count){ await this.#assets.updateHandfuls(title, count); }
	async updateCoinageCoins(title, count)   { await this.#assets.updateCoins(title, count); }

	// ── Residents ──────────────────────────────────────────────────────────────

	async addResident()                        { await this.#residents.add(); }
	async removeResident(id)                   { await this.#residents.remove(id); }
	async updateResidentName(id, value)        { await this.#residents.updateName(id, value); }
	async updateResidentOccupation(id, value)  { await this.#residents.updateOccupation(id, value); }
	async updateResidentTraits(id, value)      { await this.#residents.updateTraits(id, value); }
	async updateResidentTraitsSource(value)    { await this.#residents.updateTraitsSource(value); }
	async unlinkResident(id)                   { await this.#residents.unlinkDocument(id); }
	async linkResident(id, uuid)               { await this.#residents.linkDocument(id, uuid); }

	// ── Neighbors ──────────────────────────────────────────────────────────────

	async addNeighbor()                        { await this.#neighborPeople.add(); }
	async removeNeighbor(id)                   { await this.#neighborPeople.remove(id); }
	async updateNeighborName(id, value)        { await this.#neighborPeople.updateName(id, value); }
	async updateNeighborOccupation(id, value)  { await this.#neighborPeople.updateOccupation(id, value); }
	async updateNeighborTraits(id, value)      { await this.#neighborPeople.updateTraits(id, value); }
	async updateNeighborHome(id, value)        { await this.#neighborPeople.updateHome(id, value); }
	async unlinkNeighbor(id)                   { await this.#neighborPeople.unlinkDocument(id); }
	async linkNeighbor(id, uuid)               { await this.#neighborPeople.linkDocument(id, uuid); }
	async updateNeighborPlaceNote(id, value)   { await this.#neighborPlaces.updateNote(id, value); }

	// ── Linked NPC actors ──────────────────────────────────────────────────────
	// Creating actors and folders is privileged work, so these run on the active GM's client (see
	// hooks/SteadingPeopleChanged) even when a player made the edit.

	/** Bring the rows named in `delta` — and only those — in step with their NPC actors. */
	async syncLinkedActors(delta) {
		await this.#residents.syncActors(delta?.residents ?? []);
		await this.#neighborPeople.syncActors(delta?.neighbors ?? []);
	}

	async createMissingResidentActors()  { await this.#residents.syncActors(); }
	async createMissingNeighborActors()  { await this.#neighborPeople.syncActors(); }
	async previewResidentActors()        { return this.#residents.previewActors(); }
	async previewNeighborActors()        { return this.#neighborPeople.previewActors(); }

	/** Whether anything on this steading points at that document — asked when it changes or dies. */
	linksDocument(uuid) {
		return this.#residents.linksDocument(uuid)
			|| this.#neighborPeople.linksDocument(uuid)
			|| this.#places.linksDocument(uuid);
	}

	// ── Places of interest ─────────────────────────────────────────────────────

	async addPlace()                     { await this.#places.addBlankPlace(); }
	async setPlaceValue(index, value)    { await this.#places.setPlaceValue(index, value); }
	async unlinkPlace(index)             { await this.#places.unlinkDocument(index); }
	async linkPlace(index, uuid)         { await this.#places.linkDocument(index, uuid); }

	// ── Improvements ───────────────────────────────────────────────────────────

	async revokeImprovement(slug) { await this.#improvements.revoke(slug); }

	// ── Choice groups ──────────────────────────────────────────────────────────
	// The same four the character answers, so one shared wiring drives either sheet.

	async setChoiceCountFor(target, count) {
		return this.#choiceStores.resolve(target)?.setCount(target.group, target.option, count);
	}

	// Track checkboxes: checking box `index` fills the track through index+1; unchecking empties
	// back to index.
	async setChoiceTrackFor(target, index, checked) {
		return this.setChoiceCountFor(target, checked ? Number(index) + 1 : Number(index));
	}

	async setChoicePickFor(target, checked = true) {
		const ctrl = this.#choiceStores.resolve(target);
		return ctrl ? applyPick(ctrl, target, checked) : undefined;
	}

	async setChoiceTextFor(target, text) {
		return this.#choiceStores.resolve(target)?.setText(target.group, target.option, text);
	}

	// Zero rather than a dropped key: Foundry deep-merges an update, so omitting it would leave the
	// old value in place.
	async clearChoicePickFor(target) {
		return this.setChoiceCountFor(target, 0);
	}

	// ── Moves ──────────────────────────────────────────────────────────────────

	async setMoveChecked(categoryKey, moveSlug, checked) {
		if (checked) await this.#moves.incrementMove(categoryKey, moveSlug);
		else         await this.#moves.decrementMove(categoryKey, moveSlug);
	}

	async sendMoveToChat(moveSlug)                          { await this.#moves.sendToChat(moveSlug); }
	async toggleMoveResourcePip(moveSlug, index, wasChecked) { await this.#moves.toggleResourcePip(moveSlug, index, wasChecked); }
	async setMoveResourceText(moveSlug, value)              { await this.#moves.setMoveResourceText(moveSlug, value); }

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	// Pre-create, before the document persists (updateSource-only territory). Steadings have no
	// pre-create defaults; the hook dispatches here uniformly.
	onPreCreate(_data) {}

	// Post-create initialization, once, on the creating client (CreateActor hook → typedActor
	// dispatch; async pack loads can't run preCreate). A brand-new steading adopts the Stonetop
	// steadfast so it opens with out-of-the-box values — one that already has a steadfast
	// (duplicated, imported, created from a template) is left alone. Then the reference moves seed as
	// owned items — idempotent, so a duplicated actor isn't re-seeded; after this they're ordinary
	// items the GM can edit, delete, or re-add via drag-drop.
	async onCreate() {
		if (!this.#actor.system?.steadfast) {
			const steadfast = await loadSteadfast("stonetop");
			if (steadfast) await applySteadfast(this.#actor, steadfast);
		}
		await this.#moves.seedReferenceMoves();
	}

	/** Backfill for existing steadings (migration): restamp, then seed only empty categories. */
	async backfillMoves() {
		await this.#moves.restampCategories();
		await this.#moves.seedMissingCategories();
	}

	/** Returns false when nothing claimed the drop — the sheet then falls back to core's embed. */
	async applyDroppedItem(item) {
		return this.#drops.handle(item);
	}

	// The name combobox doubles as the steadfast picker: a value matching a known steadfast name
	// applies that steadfast (re-seeds the definition fields and adopts its name; runtime state like
	// residents/debilities is preserved). Any other value is just the steading's own name.
	// `availableSteadfasts` is the {slug, name} list from loadAllSteadfasts.
	async renameOrApplySteadfast(value, availableSteadfasts = []) {
		const name = (value ?? "").trim();
		const match = matchSteadfastByName(name, availableSteadfasts);
		if (match) {
			const steadfast = await loadSteadfast(match.slug);
			if (steadfast) await applySteadfast(this.#actor, steadfast);
		} else if (name && name !== this.#actor.name) {
			await this.#actor.update({ name });
		}
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	async buildSnapshot() {
		const [improvements, moves, seasons] = await Promise.all([
			this.#improvements.buildSnapshot(),
			this.#moves.buildSnapshot(),
			this.#seasons.buildSnapshot(),
		]);
		return new SteadingSnapshot({
			fortunes: new FortunesSnapshot(
				SteadingDefaults.fortunes.title, startingAttributeNote(this.#actor, "fortunes"),
				this.fortunesCurrent, SteadingDefaults.fortunes.options, SteadingDefaults.fortunes.bonuses,
			),
			surplus: new SurplusSnapshot(
				SteadingDefaults.surplus.title, startingAttributeNote(this.#actor, "surplus"), this.surplusCurrent,
			),
			attributes:         this.#attributes.buildSnapshot(),
			debilities:         this.#debilities.buildSnapshot(),
			placesOfInterest:   this.#places.buildSnapshot(),
			notes:              this.notes,
			residents:          this.#residents.buildSnapshot(),
			neighbors: {
				people: this.#neighborPeople.buildSnapshot(),
				places: this.#neighborPlaces.buildSnapshot(),
			},
			contentDescription: SteadingDefaults.content.description,
			content:            this.#content.buildSnapshot(),
			assets:             this.#assets.buildSnapshot(),
			improvements,
			residentNames:      this.#actor.system.residents?.names ?? "",
			residentTraits:     this.#actor.system.residents?.traits ?? [],
			moves,
			seasons,
			rollMode:           this.rollMode,
		});
	}
}
