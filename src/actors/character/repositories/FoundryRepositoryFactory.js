import {FoundryMoveRepository} from "./FoundryMoveRepository.js";
import {FoundryOutfitItemRepository} from "./FoundryOutfitItemRepository.js";
import {FoundryArcanaRepository} from "./FoundryArcanaRepository.js";
import {FoundryFollowerRepository} from "./FoundryFollowerRepository.js";
import {FoundryPossessionRepository} from "./FoundryPossessionRepository.js";

export class FoundryRepositoryFactory {
	get moves() {
		return this._moves ??= new FoundryMoveRepository();
	}

	get inventory() {
		return this._inventory ??= new FoundryOutfitItemRepository();
	}

	get arcana() {
		return this._arcana ??= new FoundryArcanaRepository();
	}

	get followers() {
		return this._followers ??= new FoundryFollowerRepository();
	}

	get possessions() {
		return this._possessions ??= new FoundryPossessionRepository();
	}
}
