export class PossessionUseButton {
	constructor(ev) {
		this._button = ev.currentTarget;
		this._slug = this._button.dataset.possessionSlug;
		this._choiceSlug = this._button.dataset.choiceSlug ?? null;
		this._index = Number(this._button.dataset.index);
	}

	get possessionSlug() { return this._slug; }
	get choiceSlug()     { return this._choiceSlug; }

	isChecked() { return this._button.classList.contains("is-checked"); }

	get index() { return this._index; }
}
