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

	// The move that renames this playbook on the front page, and the name it leaves behind — the
	// Would-be Hero crosses off "Would-be" on taking Big Damn Hero. Null on every other playbook.
	get renameOnMove() {
		return this._stonetopItem.system?.renameOnMove ?? null;
	}

	get specialPossessions() {
		return this._stonetopItem.system?.specialPossessions ?? null;
	}

	get followers() {
		return this._stonetopItem.system?.followers ?? [];
	}

	get inserts() {
		return this._stonetopItem.system?.inserts ?? [];
	}

	// The playbook owns its moves by slug; startingMoves is the subset seeded acquired at creation.
	// initPlaybookCategory reads both — without these getters the moves tab stays empty.
	get moves() {
		return this._stonetopItem.system?.moves ?? [];
	}

	get startingMoves() {
		return this._stonetopItem.system?.startingMoves ?? [];
	}

	get lore() {
		return this._stonetopItem.system?.lore ?? [];
	}

	get choices() {
		return this._stonetopItem.system?.choices ?? [];
	}

	get introductions() {
		return this._stonetopItem.system?.introductions ?? null;
	}
}
