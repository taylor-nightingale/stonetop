import { AppearanceLineSnapshot, AppearanceOptionSnapshot, AppearanceSection } from "../../model/snapshot/character/CharacterSnapshot.js";

export class CharacterAppearance {
	constructor(flags) {
		this._flags = flags;
	}

	get saved() {
		return this._flags.getFlag("selected") ?? {};
	}

	async select(lineIdx, value) {
		const current = this.saved;
		await this._flags.setFlag("selected", { ...current, [lineIdx]: value });
	}

	buildSnapshot(appearanceData) {
		const saved = this.saved;
		const options = (appearanceData ?? []).map((opts, i) =>
			new AppearanceLineSnapshot(i, opts.map(v =>
				new AppearanceOptionSnapshot(v, saved?.[i] === v)
			))
		);
		return new AppearanceSection(options);
	}
}
