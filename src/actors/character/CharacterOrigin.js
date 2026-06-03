import { OriginOptionSnapshot, OriginSection } from "../../model/snapshot/character/CharacterSnapshot.js";

export class CharacterOrigin {
	constructor(actor) {
		this._actor = actor;
	}

	get selected() {
		return this._actor.system?.origin?.selected ?? "";
	}

	async select(region) {
		await this._actor.update({ "system.origin.selected": region });
	}

	async selectName(name) {
		await this._actor.update({ name });
	}

	buildSnapshot(originData) {
		const saved = this.selected || null;
		const options = (originData ?? []).map(({ region, names }) =>
			new OriginOptionSnapshot(region, names, region === saved)
		);
		return new OriginSection(saved, options);
	}
}
