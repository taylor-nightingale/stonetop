import { FoundrySteadingMovesRepository } from "./repositories/FoundrySteadingMovesRepository.js";

export class SteadingMoves {
	constructor(actor, repo = new FoundrySteadingMovesRepository()) {
		this._actor = actor;
		this._repo  = repo;
	}

	async buildSnapshot() {
		const entries = await this._repo.getHomefrontMoves();
		if (!entries.length) return null;

		const moves = await Promise.all(entries.map(e => this._buildMoveSnapshot(e)));

		return {
			key:             "homefront",
			label:           "Homefront Moves",
			renderStyle:     "standard",
			allowAdditional: false,
			note:            null,
			moves,
		};
	}

	async _buildMoveSnapshot(entry) {
		const description = await this._enrichDescription(entry.description);

		return {
			id:            entry.id,
			ownedId:       null,
			slug:          entry.slug ?? entry.id,
			name:          entry.name,
			description,
			rollStat:      entry.rollStat || null,
			isStarting:    true,
			selectable:    false,
			selection:     { value: 1, max: 1 },
			requirement:   null,
			requiresLabel: null,
			sourceLabel:   null,
			resource:      entry.resource ?? null,
			choices:       null,
		};
	}

	async _enrichDescription(raw) {
		if (!raw) return "";
		return foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, {
			async:    true,
			rollData: this._actor.getRollData?.() ?? {},
		});
	}
}
