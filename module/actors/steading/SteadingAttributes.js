import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {AttributeSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";

export class SteadingAttributes {
	constructor(actor) {
		this._actor = actor;
	}

	_attr(slug) {
		return this._actor.system.attributes[slug] ?? {current: 0, items: []};
	}

	async _save(slug, attr) {
		await this._actor.update({[`system.attributes.${slug}`]: attr});
	}

	async setCurrent(slug, current) {
		await this._save(slug, {...this._attr(slug), current});
	}

	async addNewItemToAttribute(slug) {
		const attr = this._attr(slug);
		await this._save(slug, {...attr, items: [...attr.items, ""]});
	}

	async updateItemOnAttribute(slug, index, value) {
		const attr  = this._attr(slug);
		const items = [...attr.items];
		items[index] = value;
		await this._save(slug, {...attr, items});
	}

	async removeItemFromAttribute(slug, index) {
		const attr  = this._attr(slug);
		const items = [...attr.items];
		items.splice(index, 1);
		await this._save(slug, {...attr, items});
	}

	buildSnapshot() {
		return {
			size:       this._attrSnapshot("size"),
			population: this._attrSnapshot("population"),
			prosperity: this._attrSnapshot("prosperity"),
			defenses:   this._attrSnapshot("defenses"),
		};
	}

	_attrSnapshot(slug) {
		const def  = SteadingDefaults.attributes[slug];
		const attr = this._attr(slug);
		return new AttributeSnapshot(slug, def.title, def.note, attr.current, def.options, attr.items);
	}
}
