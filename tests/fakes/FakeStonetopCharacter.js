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

	// XP marking (ActorRolling's 6- rule). `xpMarks` counts landed marks; `xpFull` simulates a
	// full track (markXp then reports false, like the real vitals).
	xpMarks = 0;
	xpFull = false;

	async markXp() {
		if (this.xpFull) return false;
		this.xpMarks++;
		return true;
	}
}
