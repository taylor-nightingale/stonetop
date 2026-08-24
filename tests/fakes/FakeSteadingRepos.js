import { FakeMoveRepository } from "./FakeMoveRepository.js";
import { FakeNpcRepository } from "./FakeNpcRepository.js";

/** An art store with nothing installed — the default world, where no plate is available. */
export class FakeSteadingArtRepository {
	constructor(plate = null) { this._plate = plate; }
	async seasonsPlate() { return this._plate; }
}

/**
 * The repository bag StonetopSteading composes with. Every key defaults to an empty stand-in, so a
 * test names only the repository it actually cares about — passing just `{ moves }`, say.
 */
export function steadingRepos({ moves, improvements, art, npcs } = {}) {
	return {
		moves:        moves        ?? new FakeMoveRepository(),
		improvements: improvements ?? { getBySlug: async () => null, getAll: async () => [] },
		art:          art          ?? new FakeSteadingArtRepository(),
		npcs:         npcs         ?? new FakeNpcRepository(),
	};
}
