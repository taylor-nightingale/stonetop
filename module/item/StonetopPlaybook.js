import {ITEM_FLAG_SCOPE} from "../actors/character/StonetopFlags.js";

export class StonetopPlaybook {
	_stonetopItem;

	constructor(stonetopItem) {
		this._stonetopItem = stonetopItem;
		this._stonetopFields = this._stonetopItem.flags[ITEM_FLAG_SCOPE];
	}

	get crew() {
		return this._stonetopFields.crew ?? null;
	}

	get animalCompanion() {
		return this._stonetopFields.animalCompanion ?? null;
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

	// "Either X OR Y" starting-move choices: groups of move names the player picks
	// one from (e.g. the Heavy's Armored OR Uncanny Reflexes). These are excluded
	// from the auto-granted starting moves; the chosen one is added separately.
	get startingMoveChoices() {
		return this._stonetopFields.moves?.choices ?? [];
	}

	get invocations() {
		return this._stonetopFields.invocations ?? null;
	}

	get specialPossessions() {
		return this._stonetopFields.specialPossessions ?? null;
	}

	get lore() {
		return this._stonetopFields.lore ?? [];
	}
}
