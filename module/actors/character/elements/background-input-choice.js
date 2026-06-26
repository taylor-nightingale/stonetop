export class BackgroundInputChoice {
	_inputChoice;
	_slug;

	constructor(ev) {
		this._inputChoice = ev.currentTarget; // input.stonetop-bg-choice
		this._slug = this._inputChoice.dataset.slug;

	}

	get isChecked() {
		return this._inputChoice.checked;
	}

	get slug() {
		return this._slug;
	}

}
