export class FakeStonetopCharacter {
	type = "character";
	directoryNote = null;
	_bonuses = {};

	withBonus(stat, value) {
		this._bonuses[stat] = value;
		return this;
	}

	resolveBonus(stat) {
		return stat in this._bonuses ? this._bonuses[stat] : null;
	}

	applyRollMode(stat, mode) {
		return mode;
	}

	getRollableStats() {
		return [];
	}

	// Every roll offers the tier it landed in to the actor that made it (ActorRolling#execute).
	// `outcomes` is what was offered, so a test can assert what the roll handed over.
	outcomes = [];

	async recordMoveOutcome(moveSlug, outcome) {
		this.outcomes.push({ moveSlug, outcome });
	}

	// What the roll dialog shows beside the modes (ActorRolling#execute). Tests set these directly.
	notesBySlug = new Map();
	rule = null;
	opened = [];

	async rollNotesFor(moveSlug) {
		return this.notesBySlug.get(moveSlug) ?? null;
	}

	async rollModeRule() {
		return this.rule;
	}

	async openMoveSheet(moveSlug) {
		this.opened.push(moveSlug);
	}

	// XP marking (ActorRolling's 6- rule). `xpMarks` counts landed marks.
	xpMarks = 0;

	async markXp() {
		this.xpMarks++;
		return true;
	}
}
