import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeRepositoryFactory } from "./FakeRepositoryFactory.js";

export class TestCharacterBuilder {
	constructor(actor) {
		this._actor = actor;
		this._repos = new FakeRepositoryFactory();
	}

	withMoveRepo(repo) {
		this._repos.moves = repo ?? this._repos.moves;
		return this;
	}

	addPlaybookMove(move) {
		this._repos.moves.addPlaybook(move);
		return this;
	}

	addBasicMove(move) {
		this._repos.moves.addBasic(move);
		return this;
	}

	addInsertMove(move) {
		this._repos.moves.addInsertMove(move);
		return this;
	}

	withInventoryRepo(repo) {
		this._repos.inventory = repo ?? this._repos.inventory;
		return this;
	}

	withArcanaRepo(repo) {
		this._repos.arcana = repo ?? this._repos.arcana;
		return this;
	}

	addArcanum(arcanum) {
		this._repos.arcana.add(arcanum);
		return this;
	}

	withPossessionRepo(repo) {
		this._repos.possessions = repo ?? this._repos.possessions;
		return this;
	}

	build() {
		return new StonetopCharacter(this._actor, this._repos);
	}
}
