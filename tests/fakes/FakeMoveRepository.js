import {Move} from "../../src/model/data/Move.js";

export class FakeMoveRepository {
	constructor(playbookMoves = [], basicMoves = [], postDeathMoves = []) {
		this._playbookMoves  = playbookMoves;
		this._basicMoves     = basicMoves;
		this._postDeathMoves = postDeathMoves;
	}

	async getPlaybookMoves() {
		return this._playbookMoves.map(m => new Move(m));
	}

	async getPlaybookMoveDocument(id) {
		return this._playbookMoves.find(m => m._id === id) ?? null;
	}

	async getBasicMoves() {
		return this._basicMoves.map(m => new Move(m));
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

	async getPostDeathMoves() {
		return this._postDeathMoves.map(m => new Move(m));
	}

	async getPostDeathMoveDocument(id) {
		return this._postDeathMoves.find(m => m._id === id) ?? null;
	}

	addPostDeath(move) {
		this._postDeathMoves.push(move);
	}

	async buildSlugIndex() {
		const all = [...this._playbookMoves, ...this._basicMoves, ...this._postDeathMoves];
		const entries = all.map(m => new Move(m));
		return new Map(entries.map(m => [m.slug, m]));
	}
}

