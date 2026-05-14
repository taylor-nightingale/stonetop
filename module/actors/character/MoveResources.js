const key = "backgroundChoices";
export class MoveResources {
	_flags;

	constructor(flags) {
		this._flags = flags;
	}

	/**
	 * @param {MoveResourceButton} moveResourceButton
	 * @returns {Promise<void>}
	 */
	async add(moveResourceButton) {
		const newValue = moveResourceButton.isChecked() ? moveResourceButton.index : moveResourceButton.index + 1;
		const current = this.getMoveResources();
		await this._addMoveResource(current, moveResourceButton.moveName, newValue);
	}

	getMoveResources() {
		return this._flags.getFlag(key) ?? {};
	}

	async _addMoveResource(current, moveName, newValue) {
		await this._flags.setFlag(key, {...current, [moveName]: newValue});
	}

}
