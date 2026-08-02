import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {DebilitySnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";

export class SteadingDebilities {
	constructor(actor) {
		this._actor = actor;
	}

	get _state() {
		return this._actor.system.debilities ?? {};
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
			new DebilitySnapshot(def.slug, def.description, def.note, state[def.slug] ?? false),
		);
	}
}
