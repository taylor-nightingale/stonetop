export class MoveResourceButton {
	constructor(ev) {
		this._buttonElement = ev.currentTarget;
		this._moveSlug = this._buttonElement.dataset.moveSlug;
		this._index = Number(this._buttonElement.dataset.index);
	}

	get moveSlug() {
		return this._moveSlug;
	}

	isChecked() {
		return this._buttonElement.classList.contains("is-checked");
	}

	get index() {
		return this._index;
	}
}
