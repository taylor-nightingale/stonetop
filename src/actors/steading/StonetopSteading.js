import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {RatingSnapshot, SteadingSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {PlacesOfInterest} from "./PlacesOfInterest.js";
import {SteadingAttributes} from "./SteadingAttributes.js";
import {SteadingDebilities} from "./SteadingDebilities.js";
import {Folk} from "./Folk.js";
import {FolkSuggestions} from "./FolkSuggestions.js";
import {NeighborPlaces} from "./NeighborPlaces.js";
import {SteadingContent} from "./SteadingContent.js";
import {SteadingAssets} from "./SteadingAssets.js";
import {SteadingImprovements} from "./SteadingImprovements.js";
import {SteadingEffects} from "./SteadingEffects.js";
import {SteadingMoves} from "./SteadingMoves.js";
import {GrantedMoves} from "./GrantedMoves.js";
import {SteadingChoices} from "./SteadingChoices.js";
import {SteadingSeasons} from "./SteadingSeasons.js";
import {SteadingSeason} from "./SteadingSeason.js";
import {SeasonSnapshot} from "../../model/snapshot/steading/TurnoverSnapshot.js";
import {SteadingRolls} from "./SteadingRolls.js";
import {RollModes} from "../RollModes.js";
import {SteadingDropRouter} from "./SteadingDropRouter.js";
import {ChoiceStores} from "../character/ChoiceStores.js";
import {applyPick} from "../character/ChoiceGroupController.js";
import {FoundrySteadingRepositoryFactory} from "./repositories/FoundrySteadingRepositoryFactory.js";
import {SteadingPeopleDelta} from "./SteadingPeopleDelta.js";
import {startingValue} from "./startingValue.js";
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
	#places; #attributes; #debilities; #folk; #suggestions; #neighborPlaces;
	#content; #assets; #improvements; #effects; #moves; #grantedMoves; #choices; #season; #seasons;
	#rolls; #drops; #choiceStores; #art;

	constructor(actor, repos = FoundrySteadingRepositoryFactory.create()) {
		this.#actor          = actor;
		this.#places         = new PlacesOfInterest(actor);
		this.#debilities     = new SteadingDebilities(actor);
		// Rolls before attributes: a rating tile names the debility bending it, and rolls is the one
		// place that knows a debility bends anything at all.
		this.#rolls          = new SteadingRolls(actor, this.#debilities);
		this.#attributes     = new SteadingAttributes(actor, this.#rolls);
		this.#folk           = new Folk(actor, repos.npcs);
		this.#suggestions    = new FolkSuggestions(actor, this.#folk);
		this.#neighborPlaces = new NeighborPlaces(actor);
		this.#content        = new SteadingContent(actor);
		this.#assets         = new SteadingAssets(actor);
		this.#improvements   = new SteadingImprovements(actor, repos.improvements);
		// What the improvements propose to do to the steading, and doing it. Built FROM the
		// improvements, so it is composed after them and handed to the board rather than held by it.
		this.#effects        = new SteadingEffects(actor, this.#improvements);
		this.#moves          = new SteadingMoves(actor, repos.moves);
		// Moves an improvement confers rather than moves the steading owns — looked up in the pack, so
		// they never join the Moves tab. See GrantedMoves.
		this.#grantedMoves   = new GrantedMoves(actor, repos.moves);
		this.#choices        = new SteadingChoices(actor);
		// The stored season and the turnover it drives. Built from the improvements, because the
		// checklist is assembled from what this steading has actually built.
		this.#season         = new SteadingSeason(actor, this.#effects, this.#choices);
		this.#seasons        = new SteadingSeasons(this.#choices, this.#moves, repos.art, this.#season);
		// Kept as well as handed to the seasons: the Play tab's own plate is asked for at snapshot
		// time, where there is no region class to own it.
		this.#art            = repos.art;
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
	async setAssetRequisitioned(index, flag) { await this.#assets.setRequisitioned(index, flag); }
	async updateCoinagePurses(title, count)  { await this.#assets.updatePurses(title, count); }
	async updateCoinageHandfuls(title, count){ await this.#assets.updateHandfuls(title, count); }
	async updateCoinageCoins(title, count)   { await this.#assets.updateCoins(title, count); }

	// ── Folk — one roster, residents and neighbours together ───────────────────

	async addPerson()                          { await this.#folk.add(); }
	async addPersonNamed(name, home = "")      { return this.#folk.addNamed(name, home); }
	async removePerson(id)                     { await this.#folk.remove(id); }
	async updatePersonName(id, value)          { await this.#folk.updateName(id, value); }
	async usePersonName(id, name, home = "")   { await this.#folk.useName(id, name, home); }
	async updatePersonOccupation(id, value)    { await this.#folk.updateOccupation(id, value); }
	async updatePersonTraits(id, value)        { await this.#folk.updateTraits(id, value); }
	async updatePersonHome(id, value)          { await this.#folk.updateHome(id, value); }
	async appendPersonTrait(id, trait)         { await this.#folk.appendTrait(id, trait); }
	async unlinkPerson(id)                     { await this.#folk.unlinkDocument(id); }
	async linkPerson(id, uuid)                 { await this.#folk.linkDocument(id, uuid); }
	async updateNeighborPlaceNote(id, value)   { await this.#neighborPlaces.updateNote(id, value); }

	// ── Linked NPC actors ──────────────────────────────────────────────────────
	// Creating actors and folders is privileged work, so these run on the active GM's client (see
	// hooks/SteadingPeopleChanged) even when a player made the edit.

	/** Bring the rows named in `delta` — and only those — in step with their NPC actors. */
	async syncLinkedActors(delta) {
		await this.#folk.syncActors(delta?.people ?? []);
	}

	async createMissingFolkActors()  { await this.#folk.syncActors(); }
	async previewFolkActors()        { return this.#folk.previewActors(); }

	/** Whether anything on this steading points at that document — asked when it changes or dies. */
	linksDocument(uuid) {
		return this.#folk.linksDocument(uuid) || this.#places.linksDocument(uuid);
	}

	// ── Places of interest ─────────────────────────────────────────────────────

	async addPlace()                     { await this.#places.addBlankPlace(); }
	async setPlaceValue(index, value)    { await this.#places.setPlaceValue(index, value); }
	async unlinkPlace(index)             { await this.#places.unlinkDocument(index); }
	async linkPlace(index, uuid)         { await this.#places.linkDocument(index, uuid); }

	// ── The season ─────────────────────────────────────────────────────────────
	// Displayed wherever the ratings are; advanced only on the Season tab, because advancing runs
	// the whole turnover procedure.

	get season() { return this.#season.season; }
	get year()   { return this.#season.year; }

	/**
	 * Turn the season — one act, because in the fiction it IS one act.
	 *
	 * Rolling the incoming season's Seasons Change move is what turning the wheel means ("when spring
	 * bursts forth upon the land, whoever is the most hopeful rolls +Fortunes"), so the sheet does not
	 * offer an abstract "advance" beside the move that advances it. The wheel turns first and the roll
	 * follows: the season changes whatever the dice say, and the card should be posted by a steading
	 * already in the season it is about.
	 */
	async turnSeason() {
		const moveSlug = this.season.next.moveSlug;
		await this.#season.turn();
		await this.#moves.roll(moveSlug);
	}

	/**
	 * Reset Fortunes, as the move tells you to on every result.
	 *
	 * To +1 — or to +0 while the steading is malcontent, which is that debility's whole effect. The
	 * debilities are asked rather than checked here, so the rule lives with the thing that causes it.
	 */
	async resetFortunes() { await this.setFortunes(this.#debilities.seasonalFortunesReset); }

	/** What that reset will actually set Fortunes to — the button says so rather than implying +1. */
	get fortunesResetValue() { return this.#debilities.seasonalFortunesReset; }

	/** Write what this season does to the steading — the turn's statement, once. */
	async applyTurnover() { return this.#season.applyTurnover(); }

	/**
	 * Write what a named moment of this season does — the harvest coming in, the hunt being led.
	 *
	 * Separate from the turnover because it happens at a different time, and the sheet cannot know
	 * when: the table says the harvest is in by applying it.
	 */
	async applyMoment(key) { return this.#season.applyMoment(key); }

	/** Roll a move an improvement conferred — the aurochs hunt, the news at the inn. */
	async rollGrantedMove(slug) { return this.#grantedMoves.roll(slug); }

	// ── Improvements ───────────────────────────────────────────────────────────

	async revokeImprovement(slug) { await this.#improvements.revoke(slug); }

	// ── Applying what improvements do ──────────────────────────────────────────
	// The sheet never writes a rating silently: every result is shown with its source, and each one
	// the sheet can write carries its own control. Nothing is applied that was not pressed.

	/** Write one result, recording what it wrote so it can be taken back. */
	async applyEffectLine(id) { return this.#effects.applyLine(id); }

	/** Take one result back, subtracting exactly what it wrote. */
	async revertEffectLine(id) { return this.#effects.revertLine(id); }

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
	async openMoveSheet(moveSlug)                            { await this.#moves.openSheet(moveSlug); }
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
		// Applying a steadfast OVERWRITES the profile — attributes, assets, places, neighbour places,
		// residents and improvements — with the pack's starting values. That is right when the name
		// changes TO a steadfast, and catastrophic when it is merely re-submitted: a steading named
		// after the steadfast it came from (which every steading seeded from one is) matched itself on
		// every change event the name field emitted, and a session's play was replaced by the book's
		// starting numbers. So the steadfast this steading already has is never re-applied here.
		// Deliberately re-seeding is the drop path (applyDroppedItem), where it is what was asked for.
		if (match && match.slug !== this.#actor.system.steadfast) {
			const steadfast = await loadSteadfast(match.slug);
			if (steadfast) await applySteadfast(this.#actor, steadfast);
		} else if (!match && name && name !== this.#actor.name) {
			await this.#actor.update({ name });
		}
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	async buildSnapshot() {
		const [improvements, moves, seasons, resourcesPlate, grantedMoves] = await Promise.all([
			this.#improvements.buildSnapshot(this.#effects),
			this.#moves.buildSnapshot(),
			this.#seasons.buildSnapshot(),
			this.#art.resourcesPlate(),
			this.#improvements.grantedMoveSlugs().then(slugs => this.#grantedMoves.bySlug(slugs)),
		]);
		return new SteadingSnapshot({
			fortunes: new RatingSnapshot(SteadingDefaults.fortunes, {
				current:  this.fortunesCurrent,
				starting: startingValue(this.#actor, "fortunes"),
			}),
			surplus: new RatingSnapshot(SteadingDefaults.surplus, {
				current:  this.surplusCurrent,
				starting: startingValue(this.#actor, "surplus"),
			}),
			attributes:         this.#attributes.buildSnapshot(),
			debilities:         this.#debilities.buildSnapshot(),
			placesOfInterest:   this.#places.buildSnapshot(),
			notes:              this.notes,
			folk:               this.#folk.buildSnapshot(),
			folkSuggestions:    this.#suggestions.build(),
			neighborPlaces:     this.#neighborPlaces.buildSnapshot(),
			contentDescription: SteadingDefaults.content.description,
			content:            this.#content.buildSnapshot(),
			assets:             this.#assets.buildSnapshot(),
			improvements,
			resourcesPlate,
			moves,
			seasons,
			// Keyed by slug at the root, because a granted move is named in three unrelated places —
			// its improvement's card, the season's statement, and the moment it fires at — and each
			// of them holds only the slug.
			grantedMoves,
			season:             new SeasonSnapshot(this.season, true),
			year:               this.year,
			fortunesReset:      this.fortunesResetValue,
			rollMode:           this.rollMode,
			rollModes:          RollModes.options(this.rollMode),
		});
	}
}
