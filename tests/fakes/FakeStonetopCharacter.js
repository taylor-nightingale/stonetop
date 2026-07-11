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

	// XP marking (ActorRolling's 6- rule). `xpMarks` counts landed marks.
	xpMarks = 0;

	async markXp() {
		this.xpMarks++;
		return true;
	}
}
