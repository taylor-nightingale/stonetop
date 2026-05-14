class CharacterInstinct {
	word;
	description;
}

export class CharacterInstincts {
	_flags;
	_selected;

	constructor(flags) {
		this._flags = flags;
	}

	/**
	 *
	 * @return {CharacterInstinct}
	 */
	get selected() {
		return this._flags.getFlag("instincts.selected");
	}

}
