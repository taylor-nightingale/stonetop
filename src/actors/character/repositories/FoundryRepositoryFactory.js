import {FoundryMoveRepository} from "./FoundryMoveRepository.js";
import {FoundryOutfitItemRepository} from "./FoundryOutfitItemRepository.js";
import {FoundryArcanaRepository} from "./FoundryArcanaRepository.js";
import {FoundryFollowerRepository} from "./FoundryFollowerRepository.js";
import {FoundryPossessionRepository} from "./FoundryPossessionRepository.js";
import {FoundryPlaybookRepository} from "./FoundryPlaybookRepository.js";
import {FoundryInsertRepository} from "./FoundryInsertRepository.js";
import {FoundrySteadingRepository} from "./FoundrySteadingRepository.js";
import {INVENTORY_INSERT_PAGE} from "../../../model/data/character/inventoryInsertPage.js";

export class FoundryRepositoryFactory {
	get moves() {
		return this._moves ??= new FoundryMoveRepository();
	}

	get inventory() {
		return this._inventory ??= new FoundryOutfitItemRepository();
	}

	/** The printed sheet the Outfit tab reproduces. Not a repository — the page is the system's own,
	 *  not the world's — but it is a collaborator the character's subsystems need, and this is where
	 *  they are handed the rest of theirs. */
	get inventoryPage() {
		return INVENTORY_INSERT_PAGE;
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

	get playbooks() {
		return this._playbooks ??= new FoundryPlaybookRepository();
	}

	get inserts() {
		return this._inserts ??= new FoundryInsertRepository();
	}

	get steading() {
		return this._steading ??= new FoundrySteadingRepository();
	}
}
