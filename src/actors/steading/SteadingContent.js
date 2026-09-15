import {ContentSection} from "../../model/snapshot/steading/SteadingSnapshot.js";

// The three lists the book prints on the playbook, in the order it prints them — which is the order
// they are read aloud in at session zero. The slug is the whole definition: the heading and its
// gloss are localized from it (see ContentSection), so nothing here is in English.
const SECTIONS = ["excluded", "veiled", "specialHandling"];

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

	buildSnapshot() {
		const state = this._state;
		return SECTIONS.map(slug => new ContentSection(slug, state[slug] ?? []));
	}
}
