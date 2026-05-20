import {MoveDefinition} from "../../module/model/MoveDefinition.js";

export class FakeMoveRepository {
	constructor(playbookMoves = [], basicMoves = []) {
		this._playbookMoves = playbookMoves;
		this._basicMoves = basicMoves;
	}

	async getPlaybookMoves() {
		return this._playbookMoves.map(m => new MoveDefinition(m));
	}

	async getPlaybookMoveDocument(id) {
		return this._playbookMoves.find(m => m._id === id) ?? null;
	}

	async getBasicMoves() {
		return this._basicMoves.map(m => new MoveDefinition(m));
	}

	async getBasicMoveDocument(id) {
		return this._basicMoves.find(m => m._id === id) ?? null;
	}

	addBasic(move) {
		this._basicMoves.push(move);
	}

	addPlaybook(move) {
		this._playbookMoves.push(move);
	}
}

