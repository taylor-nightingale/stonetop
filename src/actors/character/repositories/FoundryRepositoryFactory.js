import {FoundryPlaybookRepository} from "./FoundryPlaybookRepository.js";
import {FoundryMoveRepository} from "./FoundryMoveRepository.js";
import {FoundryOutfitItemRepository} from "./FoundryOutfitItemRepository.js";
import {FoundryArcanaRepository} from "./FoundryArcanaRepository.js";
import {FoundryPostDeathInsertRepository} from "./FoundryPostDeathInsertRepository.js";
import {FoundryFollowerRepository} from "./FoundryFollowerRepository.js";
import {FoundryPossessionRepository} from "./FoundryPossessionRepository.js";

export class FoundryRepositoryFactory {
	get playbook() {
		return this._playbook ??= new FoundryPlaybookRepository();
	}

	get moves() {
		return this._moves ??= new FoundryMoveRepository();
	}

	get inventory() {
		return this._inventory ??= new FoundryOutfitItemRepository();
	}

	get arcana() {
		return this._arcana ??= new FoundryArcanaRepository();
	}

	get postDeathInsert() {
		return this._postDeathInsert ??= new FoundryPostDeathInsertRepository();
	}

	get followers() {
		return this._followers ??= new FoundryFollowerRepository();
	}

	get possessions() {
		return this._possessions ??= new FoundryPossessionRepository();
	}
}
