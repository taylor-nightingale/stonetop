import {Move} from "../../src/model/data/Move.js";
import {FakeWorldItemStore} from "./FakeWorldItemStore.js";

export class FakeMoveRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(playbookMoves = [], basicMoves = [], insertMoves = []) {
		this._playbookMoves = playbookMoves;
		this._basicMoves    = basicMoves;
		this._insertMoves   = insertMoves;
	}

	addWorld(item) { this._worldStore.add(item); return this; }

	async getPlaybookMoves(playbookName) {
		const world = await this._worldStore.filterEntries(
			e => e.system?.moveType === "playbook" && e.system?.playbook === playbookName
		);
		return [...this._playbookMoves, ...world].map(m => new Move(m));
	}

	async getPlaybookMoveDocument(id) {
		return this._playbookMoves.find(m => m._id === id)
			?? await this._worldStore.getDocument(id)
			?? null;
	}

	async getBasicMoves() {
		const world = await this._worldStore.filterEntries(e => e.system?.moveType === "basic");
		return [...this._basicMoves, ...world].map(m => new Move(m));
	}

	async getBasicMoveDocument(id) {
		return this._basicMoves.find(m => m._id === id)
			?? await this._worldStore.getDocument(id)
			?? null;
	}

	addBasic(move) {
		this._basicMoves.push(move);
	}

	addPlaybook(move) {
		this._playbookMoves.push(move);
	}

	async getInsertMoves() {
		return this._insertMoves.map(m => new Move(m));
	}

	async getInsertMoveDocument(id) {
		return this._insertMoves.find(m => m._id === id) ?? null;
	}

	addInsertMove(move) {
		this._insertMoves.push(move);
	}

	async buildSlugIndex() {
		const world = await this._worldStore.getAll();
		const all   = [...this._playbookMoves, ...this._basicMoves, ...this._insertMoves, ...world];
		return new Map(all.map(m => new Move(m)).map(m => [m.slug, m]));
	}
}

