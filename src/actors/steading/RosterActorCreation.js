import { confirmAction } from "../../utils/confirmAction.js";
import { PersonActorPlans } from "./PersonActorPlans.js";

/**
 * The GM's bulk pass over the roster: rows that have a name but no document yet.
 *
 * Deliberately a button rather than something that happens on its own — the automatic path only ever
 * reacts to a row someone just edited, so a roster typed up before this existed, or while no GM was
 * connected, is caught up here, and only once the GM has seen exactly what it will do to a directory
 * they curate.
 *
 * The factory hard-codes the roster's pair of steading methods, so callers name a roster rather than
 * assembling one. `app` is the sheet the question opens over.
 */
export class RosterActorCreation {
	static forFolk(steading, app) {
		return new RosterActorCreation(
			() => steading.previewFolkActors(),
			() => steading.createMissingFolkActors(),
			app,
		);
	}

	constructor(preview, create, app) {
		this._preview = preview;
		this._create  = create;
		this._app     = app;
	}

	async run() {
		const plans = new PersonActorPlans(await this._preview());
		if (!plans.hasWork) {
			ui.notifications?.info(game.i18n.localize("stonetop.steading.createActors.nothing"));
			return;
		}
		if (await confirmAction("stonetop.steading.createActors.title", plans.describe(), this._app)) await this._create();
	}
}
