export class StonetopPlaybook {
	_stonetopItem;

	constructor(stonetopItem) {
		this._stonetopItem = stonetopItem;
		this._stonetopFields = this._stonetopItem.flags.stonetop;
	}

	get description() {
		return this._stonetopItem.system?.description ?? null;
	}

	get statsNote() {
		return this._stonetopFields.statsNote ?? null;
	}

	get hp() {
		return this._stonetopFields.hp;
	}

	get damage() {
		return this._stonetopFields.damage;
	}

	get appearance() {
		return this._stonetopFields.appearance ?? [];
	}

	get backgrounds() {
		return this._stonetopFields.backgrounds ?? [];
	}

	get instincts() {
		return this._stonetopFields.instincts ?? [];
	}

	get origin() {
		return this._stonetopFields.origin ?? [];
	}

	get startingMovesNote() {
		return this._stonetopFields.moves?.startingMovesNote ?? null;
	}

	get specialPossessions() {
		return this._stonetopFields.specialPossessions ?? null;
	}
}
