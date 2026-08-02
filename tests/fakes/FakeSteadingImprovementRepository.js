import { SteadingImprovement } from "../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";

// Stands in for FoundrySteadingImprovementRepository: the catalog a steading's owned slugs resolve
// against. Returns the real SteadingImprovement entity, so a test can't accidentally rely on a shape
// the production repo never produces.
export class FakeSteadingImprovementRepository {
	_improvements = [];

	// `choices` is the improvement's choice-group definition ({ slug, list }) — null models a pack
	// entry with no content yet, which the steading must skip rather than render blank.
	withImprovement(slug, choices = { slug, list: [] }) {
		this._improvements.push(new SteadingImprovement(slug, choices, this._improvements.length));
		return this;
	}

	async getAll() {
		return [...this._improvements];
	}

	async getBySlug(slug) {
		return this._improvements.find(imp => imp.slug === slug) ?? null;
	}
}
