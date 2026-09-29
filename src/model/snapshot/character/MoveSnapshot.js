export { ValueMax } from "./VitalsSnapshot.js";
import { ValueMax } from "./VitalsSnapshot.js";
import { rich } from "../RichText.js";
import { MoveGloss } from "./MoveGloss.js";

/** Move or possession requirement. */
export class RequirementSnapshot {
	constructor(label, met) {
		this.label = label;
		this.met   = met;
	}
}

/**
 * @property {string|null} id          - compendium document ID
 * @property {string|null} ownedId     - last actor item ID (for rolling); null if not acquired
 * @property {string} name
 * @property {boolean} nameless     - the book prints no name over it; the row shows none
 * @property {string} description
 * @property {string|null} rollStat    - stat key | "ask" | "prompt" | null
 * @property {{ type: string }} source
 * @property {string|null} sourceLabel
 * @property {ValueMax} selection      - { value: acquired count, max: max acquirable }
 * @property {boolean} selectable      - computed: can the player increment selection?
 * @property {RequirementSnapshot|null} requirement
 * @property {string|null} requiresLabel
 * @property {ResourceSnapshot|null} resource
 * @property {string} gloss - the move's own trigger, for a collapsed disclosure row
 * @property {RollModeNotes|null} rollNotes - why it might not roll 2d6; steading moves only
 * @property {string|null} phase    - "setting-out" | "on-the-road" | "getting-home"; expedition moves only
 * @property {string|null} replaces - slug of the move this one is made instead of
 * @property {MoveResults|null} results - its authored result tiers, for a card that prints them
 * @property {string|null} rollLabel - what it adds to 2d6, as its row prints it ("+INT"); see MoveRollLabel
 * @property {number} timesTaken, maxTakes - its takes, against the book's limit
 * @property {boolean} isTaken, isRepeatable
 * @property {boolean} canTakeAgain - taken, under its limit, and selectable
 */
export class MoveSnapshot {
	constructor(b) {
		this.id            = b._id;
		this.ownedId       = b._ownedId;
		this.slug          = b._slug;
		this.name          = b._name;
		// The book printed no name over this move, so the row draws none — the name is still what the
		// chat card, the roll button's accessible name and every lookup use to refer to it.
		this.nameless      = b._nameless === true;
		this.description   = b._description;
		// What a collapsed row says about itself: the move's own emphasised trigger, lifted from the
		// text above. Derived here rather than at a render site so every surface that shows a move row
		// says the same thing about it.
		this.gloss         = MoveGloss.from(b._description);
		this.rollStat      = b._rollStat;
		this.source        = b._source;
		// The caption beside the name, or null where the row is not to carry one — only an arcanum's
		// back move sets it.
		this.sourceLabel   = b._sourceLabel ?? null;
		this.selection     = b._selection;
		this.selectable    = b._selectable;
		this.requirement   = b._requirement;
		this.requiresLabel = b._requiresLabel;
		this.resource      = b._resource;
		this.choices       = b._choices ?? null;
		// The move's own procedure, where it has one — the four Seasons Change moves. Read through
		// SeasonProcedure; null on every other move, like `resource` and `choices`.
		this.steps         = b._steps ?? null;
		// The move's three authored result tiers, raw as the item carries them. Read through
		// MoveResults by whatever prints them: the chat card, and the Seasons Change box, which draws
		// them as the rows of the season's own roll rather than authoring a second copy.
		this.moveResults   = b._moveResults ?? null;
		// Why this move might not roll a flat 2d6 — a RollModeNotes, or null where nothing speaks for
		// it. A reminder the row draws, never a change to the roll: only the steading builds these, so
		// on a character's moves tab the slot is empty and nothing renders.
		this.rollNotes     = b._rollNotes ?? null;
		this.phase         = b._phase ?? null;
		this.replaces      = b._replaces ?? null;
		this.rollLabel     = b._rollLabel ?? null;
		this.results       = b._results ?? null;
		// The move as a choice, said here rather than worked out by the row: fields, because the row
		// partial is called with hash params, which drops getters.
		this.timesTaken    = this.selection?.value ?? 0;
		this.maxTakes      = this.selection?.max ?? 1;
		this.isTaken       = this.timesTaken > 0;
		this.isRepeatable  = this.maxTakes > 1;
		this.canTakeAgain  = this.isTaken && this.timesTaken < this.maxTakes && this.selectable === true;
	}
}

export class MoveSnapshotBuilder {
	withId(v)            { this._id            = v; return this; }
	withOwnedId(v)       { this._ownedId       = v; return this; }
	withSlug(v)          { this._slug          = v; return this; }
	withName(v)          { this._name          = v; return this; }
	withNameless(v)      { this._nameless      = v; return this; }
	withDescription(v)   { this._description   = v; return this; }
	withRollStat(v)      { this._rollStat      = v; return this; }
	withSource(v)        { this._source        = v; return this; }
	withSourceLabel(v)   { this._sourceLabel   = v; return this; }
	withSelection(v)     { this._selection     = v; return this; }
	withSelectable(v)    { this._selectable    = v; return this; }
	withRequirement(v)   { this._requirement   = v; return this; }
	withRequiresLabel(v) { this._requiresLabel = v; return this; }
	withResource(v)      { this._resource      = v; return this; }
	withChoices(v)       { this._choices       = v; return this; }
	withSteps(v)         { this._steps         = v; return this; }
	withMoveResults(v)   { this._moveResults   = v; return this; }
	withRollNotes(v)     { this._rollNotes     = v; return this; }
	withPhase(v)         { this._phase         = v; return this; }
	withReplaces(v)      { this._replaces      = v; return this; }
	withRollLabel(v)     { this._rollLabel     = v; return this; }
	withResults(v)       { this._results       = v; return this; }
	build()              { return new MoveSnapshot(this); }

	// An inline arcanum back move ({id, name, text, subtitle?}) shaped as a MoveSnapshot so it renders
	// through the SAME move-item partial as the moves tab. The fallback for minor/custom arcana that carry
	// inline back.moves (no owned move item): always active ({1,1}, checkbox suppressed), non-rollable.
	// MAJOR arcana bypass this — their moves are real owned move items resolved via CharacterMoves, which
	// carry ownedId + rollStat.
	static forArcanum(move) {
		return new MoveSnapshotBuilder()
			.withId(move.id ?? null)
			.withOwnedId(null)
			.withSlug(move.id ?? null)
			.withName(move.name ?? "")
			.withNameless(move.nameless === true)
			.withDescription(rich(move.text ?? ""))
			.withRollStat(null)
			.withSource({ type: "arcanum" })
			.withSourceLabel(move.subtitle || null)
			.withSelection(new ValueMax(1, 1))
			.withSelectable(false)
			.withRequirement(null)
			.withRequiresLabel(null)
			.withResource(null)
			.withChoices(null)
			.withSteps(null)
			.withMoveResults(null)
			.withRollNotes(null)
			.build();
	}
}

/**
 * @property {string} key
 * @property {string} label
 * @property {"standard"|"side-bar"} renderStyle
 * @property {boolean} allowAdditional
 * @property {string|null} note
 * @property {MoveSnapshot[]} moves
 * @property {MovePhaseGroup[]|null} phases - the expedition moves by the part of the journey each is for
 * @property {MoveSnapshot[]} taken - what its panel rests on
 * @property {boolean} offersChoice - a move here is not taken, or can be taken again: its panel has a door
 * @property {"change"|"choose"} door - the door's word
 * @property {string} sectionKey - its panel's section on the Moves tab
 * @property {boolean} isPlaybook - a playbook's own moves
 */
export class MoveCategorySnapshot {
	constructor(b) {
		this.key             = b._key;
		this.label           = b._label;
		this.renderStyle     = b._renderStyle;
		this.allowAdditional = b._allowAdditional;
		this.note            = b._note;
		this.moves           = b._moves;
		this.phases          = b._phases ?? null;
		// On the Moves tab: a panel that rests on what is taken, and has a door where there is
		// anything to choose.
		const moves          = this.moves ?? [];
		this.taken           = moves.filter(m => m.isTaken);
		this.offersChoice    = moves.some(m => !m.isTaken || m.canTakeAgain);
		this.door            = this.taken.length ? "change" : "choose";
		this.sectionKey      = MoveCategorySnapshot.sectionKeyFor(this.key);
		this.isPlaybook      = (this.key ?? "").startsWith("playbook-");
	}

	/** The Moves-tab section a category's panel is, which a route can open by name. */
	static sectionKeyFor(key) {
		return `moves-${key}`;
	}
}

export class MoveCategorySnapshotBuilder {
	withKey(v)             { this._key             = v; return this; }
	withLabel(v)           { this._label           = v; return this; }
	withRenderStyle(v)     { this._renderStyle     = v; return this; }
	withAllowAdditional(v) { this._allowAdditional = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withMoves(v)           { this._moves           = v; return this; }
	withPhases(v)          { this._phases          = v; return this; }
	build()                { return new MoveCategorySnapshot(this); }
}
