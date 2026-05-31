export { Resource } from "../../data/Resource.js";
export { ResourceSnapshot, ResourceBuilder } from "../ResourceSnapshot.js";
export { StatSnapshot } from "./StatSnapshot.js";
export { ValueMax, VitalsSnapshot, VitalsSnapshotBuilder } from "./VitalsSnapshot.js";
export { DebilitySnapshot, DebilitySnapshotBuilder } from "./DebilitySnapshot.js";
export {
	OriginOptionSnapshot, OriginSection,
	BackgroundChoiceOptionSnapshot,
	BackgroundChoicesSnapshot, BackgroundChoicesSnapshotBuilder,
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
	InventorySnapshot,
} from "./InventorySnapshot.js";
export {
	PostDeathInsertSnapshot, PostDeathInsertSnapshotBuilder,
	PostDeathSectionSnapshot, PostDeathSectionSnapshotBuilder,
} from "./PostDeathInsertSnapshot.js";
export {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumSnapshot, ArcanumSnapshotBuilder,
	ArcanumFrontSnapshot, ArcanumFrontSnapshotBuilder,
	ArcanumBackSnapshot, ArcanumBackSnapshotBuilder,
} from "./ArcanaSnapshot.js";
export { FollowerSnapshot, FollowerSnapshotBuilder } from "./FollowerSnapshot.js";
export { ChoiceOption, ChoiceRow, HeadingRow, TextRow, FollowerRow, ChoiceGroup, ChoiceValues } from "./ChoiceGroup.js";

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
 * @property {InventorySnapshot} inventory
 * @property {ArcanaSnapshot} arcana
 * @property {PostDeathSectionSnapshot} postDeathInsert
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
		this.inventory       = b._inventory;
		this.arcana          = b._arcana;
		this.postDeathInsert = b._postDeathInsert;
		this.followers       = b._followers ?? [];
		this.rollMode        = b._rollMode;
	}
}

export class CharacterSnapshotBuilder {
	withName(v)            { this._name            = v; return this; }
	withPlaybook(v)        { this._playbook        = v; return this; }
	withDebilities(v)      { this._debilities      = v; return this; }
	withStats(v)           { this._stats           = v; return this; }
	withVitals(v)          { this._vitals          = v; return this; }
	withMoves(v)           { this._moves           = v; return this; }
	withInventory(v)       { this._inventory       = v; return this; }
	withArcana(v)          { this._arcana          = v; return this; }
	withPostDeathInsert(v) { this._postDeathInsert = v; return this; }
	withFollowers(v)       { this._followers       = v; return this; }
	withRollMode(v)        { this._rollMode        = v; return this; }
	build()                { return new CharacterSnapshot(this); }
}
