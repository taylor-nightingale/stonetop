import { FoundryMoveRepository } from "../../character/repositories/FoundryMoveRepository.js";
import { FoundrySteadingImprovementRepository } from "./FoundrySteadingImprovementRepository.js";
import { FoundrySteadingArtRepository } from "./FoundrySteadingArtRepository.js";

// The Foundry-backed repositories a steading composes with, in one place — the steading's answer to
// the character's FoundryRepositoryFactory. Passing a bag lets a test supply only what it needs, and
// lets a new repository arrive without every caller learning a new constructor argument.
export class FoundrySteadingRepositoryFactory {
	static create() {
		return {
			moves:        new FoundryMoveRepository(),
			improvements: new FoundrySteadingImprovementRepository(),
			art:          new FoundrySteadingArtRepository(),
		};
	}
}
