import { InstinctOptionSnapshotBuilder, InstinctSection } from "../../model/snapshot/character/CharacterSnapshot.js";

export class CharacterInstincts {
	constructor(flags) {
		this._flags = flags;
	}

	get selectedValue() {
		return this._flags.getFlag("selected") ?? "";
	}

	async select(value) {
		await this._flags.setFlag("selected", value);
	}

	buildSnapshot(instinctsData) {
		const saved = this.selectedValue || null;
		const options = (instinctsData ?? []).map(({ word, description }) => {
			const value = `${word} — ${description}`;
			return new InstinctOptionSnapshotBuilder()
				.withWord(word)
				.withDescription(description)
				.withValue(value)
				.withSelected(saved === value)
				.build();
		});
		return new InstinctSection(saved, options);
	}
}
