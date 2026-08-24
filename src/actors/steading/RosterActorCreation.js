import { confirmAction } from "../../utils/confirmAction.js";
import { PersonActorPlans } from "./PersonActorPlans.js";

/**
 * The GM's bulk pass over one roster: rows that have a name but no document yet.
 *
 * Deliberately a button rather than something that happens on its own — the automatic path only ever
 * reacts to a row someone just edited, so a roster typed up before this existed, or while no GM was
 * connected, is caught up here, and only once the GM has seen exactly what it will do to a directory
 * they curate.
 *
 * Each factory hard-codes its own roster's pair of steading methods, so callers name a roster rather
 * than assembling one.
 */
export class RosterActorCreation {
	static forResidents(steading) {
		return new RosterActorCreation(
			() => steading.previewResidentActors(),
			() => steading.createMissingResidentActors(),
		);
	}

	static forNeighbors(steading) {
		return new RosterActorCreation(
			() => steading.previewNeighborActors(),
			() => steading.createMissingNeighborActors(),
		);
	}

	constructor(preview, create) {
		this._preview = preview;
		this._create  = create;
	}

	async run() {
		const plans = new PersonActorPlans(await this._preview());
		if (!plans.hasWork) {
			ui.notifications?.info(game.i18n.localize("stonetop.steading.createActors.nothing"));
			return;
		}
		if (await confirmAction("stonetop.steading.createActors.title", plans.describe())) await this._create();
	}
}
