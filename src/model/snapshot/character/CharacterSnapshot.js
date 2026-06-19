export { Resource } from "../../data/Resource.js";
export { ResourceSnapshot, ResourceBuilder } from "../ResourceSnapshot.js";
export { StatSnapshot } from "./StatSnapshot.js";
export { ValueMax, VitalsSnapshot, VitalsSnapshotBuilder } from "./VitalsSnapshot.js";
export { DebilitySnapshot, DebilitySnapshotBuilder } from "./DebilitySnapshot.js";
export {
	OriginOptionSnapshot, OriginSection,
	BackgroundOptionSnapshot, BackgroundOptionSnapshotBuilder, BackgroundSection,
	PlaybookSnapshot, PlaybookSnapshotBuilder,
} from "./PlaybookSnapshot.js";
export {
	RequirementSnapshot,
	MoveSnapshot, MoveSnapshotBuilder,
	MoveCategorySnapshot, MoveCategorySnapshotBuilder,
} from "./MoveSnapshot.js";
export {
	Movelist, MovelistBuilder,
} from "./Movelist.js";
export {
	LoadOptionSnapshot, LoadSnapshot, LoadSnapshotBuilder,
	OutfitItemSnapshot, OutfitItemSnapshotBuilder,
	OutfitSection,
	OutfitSnapshot, OutfitSnapshotBuilder,
	PossessionsSnapshot,
	PossessionItemSnapshot, PossessionItemSnapshotBuilder,
} from "./InventorySnapshot.js";
export { InsertSnapshot, InsertSnapshotBuilder } from "./InsertSnapshot.js";
export {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumSnapshot, ArcanumSnapshotBuilder,
	ArcanumFrontSnapshot, ArcanumFrontSnapshotBuilder,
	ArcanumBackSnapshot, ArcanumBackSnapshotBuilder,
} from "./ArcanaSnapshot.js";
export { FollowerSnapshot, FollowerSnapshotBuilder } from "./FollowerSnapshot.js";
export { ChoiceOption, ChoiceRow, EntryRow, ChoiceGroup, ChoiceValues } from "./ChoiceGroup.js";

/**
 * The canonical read-only data object returned by `StonetopCharacter.buildSnapshot()`.
 *
 * External sheets and systems consume this shape directly — no Foundry APIs
 * or Stonetop internals required after the snapshot is built.
 *
 * @property {string} name
 * @property {PlaybookSnapshot|null} playbook
 * @property {DebilitySnapshot[]} debilities - always 3: weakened, dazed, miserable
 * @property {Object.<string, StatSnapshot>} stats - keys: str dex con int wis cha
 * @property {VitalsSnapshot} vitals
 * @property {Movelist} moves
 * @property {OutfitSnapshot} outfit
 * @property {PossessionsSnapshot|null} possessions
 * @property {ArcanaSnapshot} arcana
 * @property {InsertSnapshot[]} inserts
 * @property {FollowerSnapshot[]} followers
 * @property {string} rollMode - "normal" | "adv" | "dis"
 */
export class CharacterSnapshot {
	constructor(b) {
		this.name            = b._name;
		this.playbook        = b._playbook;
		this.debilities      = b._debilities;
		this.stats           = b._stats;
		this.vitals          = b._vitals;
		this.moves           = b._moves;
		this.outfit          = b._outfit;
		this.possessions     = b._possessions ?? null;
		this.arcana          = b._arcana;
		this.inserts         = b._inserts ?? [];
		this.followers       = b._followers ?? [];
		this.rollMode        = b._rollMode;
		this.bio             = b._bio   ?? "";
		this.notes           = b._notes ?? "";
	}
}

export class CharacterSnapshotBuilder {
	withName(v)            { this._name            = v; return this; }
	withPlaybook(v)        { this._playbook        = v; return this; }
	withDebilities(v)      { this._debilities      = v; return this; }
	withStats(v)           { this._stats           = v; return this; }
	withVitals(v)          { this._vitals          = v; return this; }
	withMoves(v)           { this._moves           = v; return this; }
	withOutfit(v)          { this._outfit          = v; return this; }
	withPossessions(v)     { this._possessions     = v; return this; }
	withArcana(v)          { this._arcana          = v; return this; }
	withInserts(v)         { this._inserts         = v; return this; }
	withFollowers(v)       { this._followers       = v; return this; }
	withRollMode(v)        { this._rollMode        = v; return this; }
	withBio(v)             { this._bio             = v; return this; }
	withNotes(v)           { this._notes           = v; return this; }
	build()                { return new CharacterSnapshot(this); }
}
