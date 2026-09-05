import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {DebilitySnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";

export class SteadingDebilities {
	constructor(actor) {
		this._actor = actor;
	}

	get _state() {
		return this._actor.system.debilities ?? {};
	}

	/**
	 * What Fortunes resets to when the season turns.
	 *
	 * The move says "+1"; the malcontent debility says "Fortunes reset to +0 each season, not +1".
	 * Asked of the debilities because they are what changes the answer — the season has no opinion.
	 */
	get seasonalFortunesReset() {
		return this.isActive("malcontent") ? 0 : 1;
	}

	isActive(slug) {
		return this._state[slug] === true;
	}

	hindersMove(moveSlug) {
		if (!moveSlug) return false;
		return SteadingDefaults.debilities.some(
			def => def.hindersMoves.includes(moveSlug) && this.isActive(def.slug),
		);
	}

	async setDebility(slug, active) {
		await this._actor.update({"system.debilities": {...this._state, [slug]: active}});
	}

	buildSnapshot() {
		const state = this._state;
		return SteadingDefaults.debilities.map(def =>
			new DebilitySnapshot(def.slug, state[def.slug] ?? false),
		);
	}
}
