import { FakeMoveRepository }       from "./FakeMoveRepository.js";
import { FakeInventoryRepository }  from "./FakeInventoryRepository.js";
import { FakeArcanaRepository }     from "./FakeArcanaRepository.js";
import { FakeFollowerRepository }   from "./FakeFollowerRepository.js";
import { FakePossessionRepository } from "./FakePossessionRepository.js";
import { FakePlaybookRepository }   from "./FakePlaybookRepository.js";
import { FakeSteadingRepository }   from "./FakeSteadingRepository.js";

export class FakeRepositoryFactory {
	constructor({ moves, inventory, arcana, followers, possessions, playbooks, steading, inventoryPage } = {}) {
		this.moves       = moves       ?? new FakeMoveRepository();
		this.inventory   = inventory   ?? new FakeInventoryRepository();
		this.arcana      = arcana      ?? new FakeArcanaRepository();
		this.followers   = followers   ?? new FakeFollowerRepository();
		this.possessions = possessions ?? new FakePossessionRepository();
		this.playbooks   = playbooks   ?? new FakePlaybookRepository();
		// Default: a world with no steading, so a character built without one still resolves its own
		// stats and falls through to null for anything else.
		this.steading    = steading    ?? new FakeSteadingRepository();
		this._inventoryPage = inventoryPage ?? null;
	}

	// The real page names Book I p. 142's rows by slug, so a fixture's "test-item" would render
	// against nothing. A fixture's page is the fixture's own gear — see FakeInventoryRepository.page.
	// Derived on read, not in the constructor: builders swap `inventory` in after construction
	// (TestCharacterBuilder.withInventoryRepo), and a page built too early lists nothing.
	get inventoryPage() {
		return this._inventoryPage ?? this.inventory.page;
	}
}
