export class FakeStonetopCharacter {
	rollMode = "normal";
	type = "character";
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

	// The roll mode is FORWARD: every stat roll spends it (ActorRolling#execute). `cleared` counts
	// the times it was spent, so a test can assert that a roll gave it back rather than leaving the
	// picker lit for the next one.
	cleared = 0;

	async clearRollMode() {
		this.cleared++;
		this.rollMode = "normal";
	}

	// XP marking (ActorRolling's 6- rule). `xpMarks` counts landed marks.
	xpMarks = 0;

	async markXp() {
		this.xpMarks++;
		return true;
	}
}
