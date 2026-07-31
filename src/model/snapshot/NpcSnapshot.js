import { Selection } from "../data/Selection.js";
import { hasGroupTag } from "../data/groupTag.js";
import { rich } from "./RichText.js";

export class NpcSnapshot {
	constructor(b) {
		this.hp               = b._hp;
		this.hpMax            = b._hpMax;
		// Rendered game text → RichText (enriched by the sheet's enrichRichTextTree pass). damage and
		// specialQuality carry stat dice, so roll:true turns a bare `d6` into a roll button.
		this.armor            = rich(b._armor);
		this.damage           = rich(b._damage, { roll: true });
		this.tagSelection     = Selection.fromStored(b._tags);
		this.tags             = this.tagSelection.text;
		this.isGroup          = hasGroupTag(this.tagSelection);
		this.specialQuality   = rich(b._specialQuality ?? "", { roll: true });
		this.instinctSelection = Selection.fromStored(b._instinct);
		this.instinct         = this.instinctSelection.text;
		this.moves            = rich(b._moves ?? "");
		this.description      = rich(b._description ?? "");
		this.cost             = b._cost             ?? "";
		this.loyalty          = b._loyalty          ?? 0;
		this.isFollower       = b._isFollower       ?? false;
	}
}

export class NpcSnapshotBuilder {
	withHp(v)               { this._hp               = v; return this; }
	withHpMax(v)            { this._hpMax            = v; return this; }
	withArmor(v)            { this._armor            = v; return this; }
	withDamage(v)           { this._damage           = v; return this; }
	withTags(v)             { this._tags             = v; return this; }
	withSpecialQuality(v)   { this._specialQuality   = v; return this; }
	withInstinct(v)         { this._instinct         = v; return this; }
	withMoves(v)            { this._moves            = v; return this; }
	withDescription(v)      { this._description      = v; return this; }
	withCost(v)             { this._cost             = v; return this; }
	withLoyalty(v)          { this._loyalty          = v; return this; }
	withIsFollower(v)       { this._isFollower       = v; return this; }
	build()                 { return new NpcSnapshot(this); }
}
