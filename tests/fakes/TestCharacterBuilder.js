import {StonetopCharacter} from "../../module/actors/character/StonetopCharacter.js";
import {FakePlaybookRepository} from "./FakePlaybookRepository.js";
import {FakeMoveRepository} from "./FakeMoveRepository.js";
import {FakeInventoryRepository} from "./FakeInventoryRepository.js";
import {FakeArcanaRepository} from "./FakeArcanaRepository.js";

export class TestCharacterBuilder {
	_actor;
	_playbookRepo = new FakePlaybookRepository();
	_moveRepo = new FakeMoveRepository();
	_inventoryRepo = new FakeInventoryRepository();
	_arcanaRepo = new FakeArcanaRepository();

	constructor(actor) {
		this._actor = actor;
	}

	withPlaybookRepo(repo) {
		this._playbookRepo = repo ?? this._playbookRepo;
		return this;
	}

	addPlaybook(playbook) {
		this._playbookRepo.add(playbook);
		return	this;
	}

	withMoveRepo(repo) {
		this._moveRepo = repo ?? this._moveRepo;
		return this;
	}
	addPlaybookMove(move) {
		this._moveRepo.addPlaybook(move);
		return this;
	}

	addBasicMove(move) {
		this._moveRepo.addBasic(move);
		return this;
	}

	withInventoryRepo(repo) {
		this._inventoryRepo = repo ?? this._inventoryRepo;
		return this;
	}

	withArcanaRepo(repo) {
		this._arcanaRepo = repo ?? this._arcanaRepo;
		return this;
	}

	addArcanum(arcanum) {
		this._arcanaRepo.add(arcanum);
		return this;
	}

	build() {
		return new StonetopCharacter(
			this._actor,
			this._playbookRepo,
			this._moveRepo,
			this._inventoryRepo,
			this._arcanaRepo,
		);
	}
}
