export class MoveResourceButton {
	constructor(ev) {
		this._buttonElement = ev.currentTarget;
		this._moveName = this._buttonElement.dataset.moveName;
		this._index = Number(this._buttonElement.dataset.index);

	}

	get moveName() {
		return this._moveName;
	}

	isChecked() {
		return this._buttonElement.classList.contains("is-checked");
	}

	get index()  {
		return this._index;
	}

}
