import { FakeMoveRepository }       from "./FakeMoveRepository.js";
import { FakeInventoryRepository }  from "./FakeInventoryRepository.js";
import { FakeArcanaRepository }     from "./FakeArcanaRepository.js";
import { FakeFollowerRepository }   from "./FakeFollowerRepository.js";
import { FakePossessionRepository } from "./FakePossessionRepository.js";
import { FakePlaybookRepository }   from "./FakePlaybookRepository.js";
import { FakeSteadingRepository }   from "./FakeSteadingRepository.js";

export class FakeRepositoryFactory {
	constructor({ moves, inventory, arcana, followers, possessions, playbooks, steading } = {}) {
		this.moves       = moves       ?? new FakeMoveRepository();
		this.inventory   = inventory   ?? new FakeInventoryRepository();
		this.arcana      = arcana      ?? new FakeArcanaRepository();
		this.followers   = followers   ?? new FakeFollowerRepository();
		this.possessions = possessions ?? new FakePossessionRepository();
		this.playbooks   = playbooks   ?? new FakePlaybookRepository();
		// Default: a world with no steading, so a character built without one still resolves its own
		// stats and falls through to null for anything else.
		this.steading    = steading    ?? new FakeSteadingRepository();
	}
}
