import { FollowersSnapshot } from "./FollowerSnapshot.js";
import { StatPairSnapshot } from "./StatPairSnapshot.js";
import { RailMoves } from "./RailMoves.js";
import { InstinctReadout } from "./InstinctReadout.js";
import { AppearanceLine } from "./AppearanceLine.js";
import { AilmentList } from "./AilmentList.js";
import { PlaybookSections } from "./PlaybookSections.js";
import { RollModes } from "../../../actors/RollModes.js";
export { Resource } from "../../data/Resource.js";
export { ResourceSnapshot, ResourceBuilder } from "../ResourceSnapshot.js";
export { StatSnapshot } from "./StatSnapshot.js";
export { StatPairSnapshot } from "./StatPairSnapshot.js";
export { ValueMax, VitalsSnapshot, VitalsSnapshotBuilder, VitalsSourcesSnapshot } from "./VitalsSnapshot.js";
export { DebilitySnapshot, DebilitySnapshotBuilder } from "./DebilitySnapshot.js";
export {
	OriginOptionSnapshot, OriginSection,
	BackgroundOptionSnapshot, BackgroundOptionSnapshotBuilder, BackgroundSection,
	PlaybookSnapshot, PlaybookSnapshotBuilder,
} from "./PlaybookSnapshot.js";
export { ReviewBlock, ReviewLine, condenseChoiceGroup } from "./ChoiceGroupReview.js";
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
	ProsperitySnapshot, ProsperityRowSnapshot,
	PossessionsSnapshot,
	PossessionItemSnapshot, PossessionItemSnapshotBuilder,
} from "./InventorySnapshot.js";
export { InsertSnapshot, InsertSnapshotBuilder } from "./InsertSnapshot.js";
export {
	LevelUpSnapshot, LevelUpSnapshotBuilder,
	AdvanceRow, ChooseMoveRow, StockRow, InvocationRow, ReviewRow,
} from "./LevelUpSnapshot.js";
export {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumSnapshot, ArcanumSnapshotBuilder,
	ArcanumSideSnapshot, ArcanumSideSnapshotBuilder,
	arcanumOutfitItemSnapshot,
} from "./ArcanaSnapshot.js";
export { ArcanumRenderContext } from "./ArcanumRenderContext.js";
export { FollowerSnapshot, FollowerSnapshotBuilder, FollowersSnapshot } from "./FollowerSnapshot.js";
export { ChoiceOption, ChoiceRow, EntryRow, ChoiceGroup, ChoiceValues } from "./ChoiceGroup.js";
export { buildChoiceGroup } from "./buildChoiceGroup.js";

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
 * @property {StatPairSnapshot[]} statPairs - the same six stats grouped by the debility that hinders
 *   them; derived from `debilities` + `stats`, never handed in
 * @property {VitalsSnapshot} vitals
 * @property {LevelUpSnapshot} levelUp - the Level Up strip; offers itself only when it has something to say
 * @property {Movelist} moves
 * @property {RailMoves} railMoves - the special moves, each for the place the rail gives it; derived from `moves`
 * @property {OutfitSnapshot} outfit
 * @property {PossessionsSnapshot|null} possessions
 * @property {ArcanaSnapshot} arcana
 * @property {InsertSnapshot[]} inserts
 * @property {FollowersSnapshot} followers - normalized { bySlug, tab }
 * @property {string} rollMode - "normal" | "adv" | "dis"
 * @property {Wound[]} wounds - problematic wounds, in the order they were written
 * @property {InstinctReadout} instinct - the instinct in force and where it is edited; derived
 * @property {AppearanceLine} appearance - the chosen appearance as one line; derived
 * @property {AilmentList} ailments - marked debilities then wounds, three shown; derived
 * @property {PlaybookSections|null} playbookSections - the Playbook tab's sections and their doors; derived
 */
export class CharacterSnapshot {
	constructor(b) {
		this.name            = b._name;
		this.playbook        = b._playbook;
		this.debilities      = b._debilities;
		this.stats           = b._stats;
		// Derived here rather than handed in: it is a view of the two fields above, so building it
		// from them is the only way the three can never disagree. A plain property, not a getter —
		// a partial invoked with hash params flattens its context and loses every getter silently.
		this.statPairs       = StatPairSnapshot.pairsFrom(this.debilities ?? [], this.stats ?? {});
		this.vitals          = b._vitals;
		this.levelUp         = b._levelUp ?? null;
		this.moves           = b._moves;
		this.railMoves       = RailMoves.from(this.moves);
		this.outfit          = b._outfit;
		this.possessions     = b._possessions ?? null;
		this.arcana          = b._arcana;
		this.inserts         = b._inserts ?? [];
		this.followers       = b._followers ?? new FollowersSnapshot();
		this.rollMode        = b._rollMode;
		this.wounds          = b._wounds ?? [];
		this.instinct        = InstinctReadout.from(this.playbook ?? null, this.inserts);
		this.appearance      = AppearanceLine.from(this.playbook?.appearanceGroup ?? null);
		this.ailments        = AilmentList.from(this.debilities ?? [], this.wounds);
		this.playbookSections = PlaybookSections.from(this.playbook ?? null);
		this.bio             = b._bio   ?? "";
		this.notes           = b._notes ?? "";
	}

	/** The side-bar's radio list, ticked to the mode this character is set to. */
	get rollModes() {
		return RollModes.options(this.rollMode);
	}
}

export class CharacterSnapshotBuilder {
	withName(v)            { this._name            = v; return this; }
	withPlaybook(v)        { this._playbook        = v; return this; }
	withDebilities(v)      { this._debilities      = v; return this; }
	withStats(v)           { this._stats           = v; return this; }
	withVitals(v)          { this._vitals          = v; return this; }
	withLevelUp(v)         { this._levelUp         = v; return this; }
	withMoves(v)           { this._moves           = v; return this; }
	withOutfit(v)          { this._outfit          = v; return this; }
	withPossessions(v)     { this._possessions     = v; return this; }
	withArcana(v)          { this._arcana          = v; return this; }
	withInserts(v)         { this._inserts         = v; return this; }
	withFollowers(v)       { this._followers       = v; return this; }
	withRollMode(v)        { this._rollMode        = v; return this; }
	withWounds(v)          { this._wounds          = v; return this; }
	withBio(v)             { this._bio             = v; return this; }
	withNotes(v)           { this._notes           = v; return this; }
	build()                { return new CharacterSnapshot(this); }
}
