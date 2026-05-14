class CharacterBackground {
	label;
	description;
	slug;
}

export class CharacterBackgrounds {
	_flags;

	/**
	 * @param {CharacterFlags} flags
	 */
	constructor(flags) {
		this._flags = flags;
	}

	/**
	 *
	 * @return {CharacterBackground[]}
	 */
	get choices() {
		return this._flags.getFlag("choices") ?? {};
	}

	/**
	 * @return {string}
	 */
	get name() {
		return this._flags.getFlag("selected.label");
	}

	/**
	 * @param {BackgroundInputChoice} selectedChoice
	 */
	async select(selectedChoice) {
		if (selectedChoice.isChecked()) {
			for (const choice of this.choices) {
				if (choice.slug === selectedChoice.slug) {
					await this._flags.setFlag("selected", choice);
				}
			}
		}


	}
}
