export class StonetopPlaybook {
	_stonetopItem;

	constructor(stonetopItem) {
		this._stonetopItem = stonetopItem;
	}

	get name() {
		return this._stonetopItem.name;
	}

	get slug() {
		return this._stonetopItem.system?.slug ?? null;
	}

	get img() {
		return this._stonetopItem.img ?? null;
	}

	get description() {
		return this._stonetopItem.system?.description ?? null;
	}

	get statsNote() {
		return this._stonetopItem.system?.statsNote ?? null;
	}

	get hp() {
		return this._stonetopItem.system?.hp;
	}

	get damage() {
		return this._stonetopItem.system?.damage ?? null;
	}

	get appearance() {
		return this._stonetopItem.system?.appearance ?? null;
	}

	get backgrounds() {
		return this._stonetopItem.system?.backgrounds ?? [];
	}

	get instinct() {
		return this._stonetopItem.system?.instinct ?? null;
	}

	get origin() {
		return this._stonetopItem.system?.origin ?? [];
	}

	get startingMovesNote() {
		return this._stonetopItem.system?.startingMovesNote ?? null;
	}

	get specialPossessions() {
		return this._stonetopItem.system?.specialPossessions ?? null;
	}

	get lore() {
		return this._stonetopItem.system?.lore ?? [];
	}
}
