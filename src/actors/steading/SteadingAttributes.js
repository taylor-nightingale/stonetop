import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {RatingSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {startingValue} from "./startingValue.js";

// Which asset list backs each rating. Prosperity's sources are `resources`; Defenses' are
// `fortifications`. Size and Population have no backing list.
const BACKING_LIST = { prosperity: "resources", defenses: "fortifications" };

export class SteadingAttributes {
	// `rolls` is what the ratings are worth once debilities have had their say — asked here so a tile
	// can name the debility bending it rather than silently showing a different number. Optional, so
	// a steadfast (a template, with no debilities to speak of) can build the same snapshots.
	constructor(actor, rolls = null) {
		this._actor = actor;
		this._rolls = rolls;
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
		return new RatingSnapshot(SteadingDefaults.attributes[slug], {
			current:    this._value(slug),
			starting:   startingValue(this._actor, slug),
			adjustment: this._rolls?.adjustmentFor(slug) ?? null,
			items:      this._items(slug),
		});
	}
}
