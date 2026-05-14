export class StonetopPlaybook {
	_stonetopItem;

	constructor(stonetopItem) {
		this._stonetopItem = stonetopItem;
		this._stonetopFields = this._stonetopItem.flags.stonetop;
	}

	/**
	 * @return {number|*}
	 */
	get hp() {
		return this._stonetopFields.hp;
	}

	/**
	 * @return {string}
	 */
	get damage() {
		return this._stonetopFields.damage;
	}

	/**
	 * @return {string[][]}
	 */
	get appearance() {
		return this._stonetopFields.appearance;
	}

}
