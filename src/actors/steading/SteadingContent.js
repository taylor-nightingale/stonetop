import {ContentSection} from "../../model/snapshot/steading/SteadingSnapshot.js";

const SECTIONS = [
	{slug: "excluded",        label: "Excluded Content",  note: "(Not part of the game, on-camera or off)", textKey: "excludedText"},
	{slug: "veiled",          label: "Veiled Content",    note: "(Part of the fiction, but only off-camera)", textKey: "veiledText"},
	{slug: "specialHandling", label: "Special Handling",  note: null, textKey: "specialHandlingText"},
];

export class SteadingContent {
	constructor(actor) {
		this._actor = actor;
	}

	get _state() {
		return this._actor.system.content;
	}

	async addItem(section) {
		const state = this._state;
		await this._actor.update({"system.content": {...state, [section]: [...(state[section] ?? []), ""]}});
	}

	async removeItem(section, index) {
		const state  = this._state;
		const list   = [...(state[section] ?? [])];
		list.splice(index, 1);
		await this._actor.update({"system.content": {...state, [section]: list}});
	}

	async updateItem(section, index, value) {
		const state = this._state;
		const list  = [...(state[section] ?? [])];
		list[index] = value;
		await this._actor.update({"system.content": {...state, [section]: list}});
	}

	async updateText(section, value) {
		const textKey = SECTIONS.find(s => s.slug === section)?.textKey;
		if (!textKey) return;
		await this._actor.update({[`system.content.${textKey}`]: value});
	}

	buildSnapshot() {
		const state = this._state;
		return SECTIONS.map(s => new ContentSection(s.slug, s.label, s.note, state[s.textKey] ?? "", state[s.slug] ?? []));
	}
}
