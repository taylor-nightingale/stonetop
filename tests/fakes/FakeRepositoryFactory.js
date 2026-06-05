import { FakeMoveRepository }             from "./FakeMoveRepository.js";
import { FakeInventoryRepository }        from "./FakeInventoryRepository.js";
import { FakeArcanaRepository }           from "./FakeArcanaRepository.js";
import { FakePostDeathInsertRepository }  from "./FakePostDeathInsertRepository.js";
import { FakeFollowerRepository }         from "./FakeFollowerRepository.js";
import { FakePossessionRepository }       from "./FakePossessionRepository.js";

export class FakeRepositoryFactory {
	constructor({ moves, inventory, arcana, postDeathInsert, followers, possessions } = {}) {
		this.moves           = moves           ?? new FakeMoveRepository();
		this.inventory       = inventory       ?? new FakeInventoryRepository();
		this.arcana          = arcana          ?? new FakeArcanaRepository();
		this.postDeathInsert = postDeathInsert ?? new FakePostDeathInsertRepository();
		this.followers       = followers       ?? new FakeFollowerRepository();
		this.possessions     = possessions     ?? new FakePossessionRepository();
	}
}
