export { ValueMax } from "./VitalsSnapshot.js";
import { ValueMax } from "./VitalsSnapshot.js";
import { rich } from "../RichText.js";

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
 * @property {string} description
 * @property {string|null} rollStat    - stat key | "ask" | "prompt" | null
 * @property {{ type: string }} source
 * @property {string|null} sourceLabel
 * @property {ValueMax} selection      - { value: acquired count, max: max acquirable }
 * @property {boolean} selectable      - computed: can the player increment selection?
 * @property {RequirementSnapshot|null} requirement
 * @property {string|null} requiresLabel
 * @property {ResourceSnapshot|null} resource
 */
export class MoveSnapshot {
	constructor(b) {
		this.id            = b._id;
		this.ownedId       = b._ownedId;
		this.slug          = b._slug;
		this.name          = b._name;
		this.description   = b._description;
		this.rollStat      = b._rollStat;
		this.source        = b._source;
		this.sourceLabel   = b._sourceLabel;
		this.selection     = b._selection;
		this.selectable    = b._selectable;
		this.requirement   = b._requirement;
		this.requiresLabel = b._requiresLabel;
		this.resource      = b._resource;
		this.choices       = b._choices ?? null;
	}
}

export class MoveSnapshotBuilder {
	withId(v)            { this._id            = v; return this; }
	withOwnedId(v)       { this._ownedId       = v; return this; }
	withSlug(v)          { this._slug          = v; return this; }
	withName(v)          { this._name          = v; return this; }
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
 */
export class MoveCategorySnapshot {
	constructor(b) {
		this.key             = b._key;
		this.label           = b._label;
		this.renderStyle     = b._renderStyle;
		this.allowAdditional = b._allowAdditional;
		this.note            = b._note;
		this.moves           = b._moves;
	}
}

export class MoveCategorySnapshotBuilder {
	withKey(v)             { this._key             = v; return this; }
	withLabel(v)           { this._label           = v; return this; }
	withRenderStyle(v)     { this._renderStyle     = v; return this; }
	withAllowAdditional(v) { this._allowAdditional = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withMoves(v)           { this._moves           = v; return this; }
	build()                { return new MoveCategorySnapshot(this); }
}
