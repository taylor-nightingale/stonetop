import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {AttributeSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {startingAttributeNote} from "./startingAttributeNote.js";

// Which asset list backs each rating. Prosperity's sources are `resources`; Defenses' are
// `fortifications`. Size and Population have no backing list.
const BACKING_LIST = { prosperity: "resources", defenses: "fortifications" };

export class SteadingAttributes {
	constructor(actor) {
		this._actor = actor;
	}

	// The stored rating — an actual value (number, or the size tier string), not an index.
	_value(slug) {
		return this._actor.system.attributes?.[slug];
	}

	// The list backing a rating lives under assets (resources/fortifications), so it can share the
	// steadfast's shape; size/population have none.
	_items(slug) {
		const list = BACKING_LIST[slug];
		return list ? (this._actor.system.assets?.[list] ?? []) : [];
	}

	async setValue(slug, value) {
		await this._actor.update({[`system.attributes.${slug}`]: value});
	}

	async _saveItems(slug, items) {
		const list = BACKING_LIST[slug];
		if (!list) return;
		await this._actor.update({[`system.assets.${list}`]: items});
	}

	async addNewItemToAttribute(slug) {
		await this._saveItems(slug, [...this._items(slug), ""]);
	}

	async updateItemOnAttribute(slug, index, value) {
		const items = [...this._items(slug)];
		items[index] = value;
		await this._saveItems(slug, items);
	}

	async removeItemFromAttribute(slug, index) {
		const items = [...this._items(slug)];
		items.splice(index, 1);
		await this._saveItems(slug, items);
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
		const def = SteadingDefaults.attributes[slug];
		// Ratings select by their `bonuses`; size selects by its tier `values`. The "Starts at …" note is
		// derived from the steadfast-supplied starting baseline (empty until a steadfast is applied).
		const values = def.values ?? def.bonuses;
		const note   = startingAttributeNote(this._actor, slug);
		return new AttributeSnapshot(slug, def.title, note, this._value(slug), def.options, values, this._items(slug));
	}
}
