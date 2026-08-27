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

	async getMovesByType(moveType) {
		const world = await this._worldStore.filterEntries(e => e.system?.moveType === moveType);
		return [...this._basicMoves, ...world]
			.filter(m => (m.system?.moveType ?? "basic") === moveType)
			.map(m => new Move(m));
	}

	async getBasicMoves() {
		return this.getMovesByType("basic");
	}

	// Pack-only reference source (mirrors the real repo): world moves are NOT included, so seeding
	// never picks up a homebrew/dragged-out copy. `_basicMoves` stands in for the compendium here.
	async getReferenceMovesByType(moveType) {
		return this._basicMoves
			.filter(m => (m.system?.moveType ?? "basic") === moveType)
			.map(m => new Move(m));
	}

	addBasic(move) {
		this._basicMoves.push(move);
		return this;
	}

	addPlaybook(move) {
		this._playbookMoves.push(move);
		return this;
	}

	async getMovesBySlugs(slugs = []) {
		if (!slugs?.length) return [];
		const index = await this.buildSlugIndex();
		return slugs.map(s => index.get(s)).filter(Boolean);
	}

	async getReferencedMoveDocument(id) {
		return this._insertMoves.find(m => m._id === id)
			?? this._playbookMoves.find(m => m._id === id)
			?? this._basicMoves.find(m => m._id === id)
			?? await this._worldStore.getDocument(id)
			?? null;
	}

	addInsertMove(move) {
		this._insertMoves.push(move);
		return this;
	}

	async namesBySlug() {
		return new Map([...await this.buildSlugIndex()]
			.map(([slug, move]) => [slug, move?.name])
			.filter(([slug, name]) => slug && name));
	}

	async buildSlugIndex() {
		const world = await this._worldStore.getAll();
		const all   = [...this._playbookMoves, ...this._basicMoves, ...this._insertMoves, ...world];
		return new Map(all.map(m => new Move(m)).map(m => [m.slug, m]));
	}

	// Slugs of fixture moves flagged `.asStarting()` — lets tests build a container's startingMoves.
	async startingSlugs() {
		const world = await this._worldStore.getAll();
		return [...this._playbookMoves, ...this._basicMoves, ...this._insertMoves, ...world]
			.filter(m => m._starting)
			.map(m => m.system?.slug);
	}
}

