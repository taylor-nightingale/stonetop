import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {AttributeSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {StonetopFlags} from "../character/StonetopFlags.js";

class AttributeState {
	items = [];
	current;
	defaultsAdded = false;

	addNewItem(item) {
		this.items.push(item);
		return this;
	}

	updateItem(index, item) {
		this.items[index] = item;
		return this;
	}

	setcurrent(current) {
		this.current = current;
		return this;
	}

	setDefaults(defaults) {
		this.current = defaults.current;
		this.items = [...(defaults.items ?? []), ...this.items];
		this.defaultsAdded = true;
	}
}

export class SteadingAttributes {
	constructor(actor) {
		this._flags = new StonetopFlags(actor, "steadingAttributes");
	}

	get _attributes() {
		return this._flags.getFlag("attributes") ?? {};
	}

	async _setAttributes(attributes) {
		await this._flags.setFlag("attributes", attributes);
	}

	_attribute(slug) {
		return this._attributes[slug] ?? new AttributeState();
	}

	async setcurrent(attributeSlug, current) {
		const attribute = this._attribute(attributeSlug).setcurrent(current);
		await this._updateAttribute(attributeSlug, attribute);
	}

	async addNewItemToAttribute(attributeSlug) {
		const attribute = this._attribute(attributeSlug).addNewItem();
		await this._updateAttribute(attributeSlug, attribute);
	}

	async updateItemOnAttribute(attributeSlug, index, value) {
		const attribute = this._attribute(attributeSlug).updateItem(index, value);
		await this._updateAttribute(attributeSlug, attribute);
	}

	async removeItemFromAttribute(attributeSlug, index) {
		const attribute = this._attribute(attributeSlug).removeItem(index);
		await this._updateAttribute(attributeSlug, attribute);
	}

	async _updateAttribute(attributeSlug, attribute) {
		const newAttributes = this._attributes;
		newAttributes[attributeSlug] = attribute;
		await this._setAttributes(newAttributes);
	}

	async buildSnapshot() {
		const [size, population, prosperity, defense] = await Promise.all([
			this._buildAttributeSnapshot("size"),
			this._buildAttributeSnapshot("population"),
			this._buildAttributeSnapshot("prosperity"),
			this._buildAttributeSnapshot("defenses")
		]);

		return {
			size: size,
			population: population,
			prosperity: prosperity,
			defenses: defense,
		};
	}

	async _buildAttributeSnapshot(slug) {
		const defaultValues = SteadingDefaults.attributes[slug];
		const attribute = this._attribute(slug)

		if (!attribute.defaultsAdded) {
			attribute.setDefaults(defaultValues);
			await this._updateAttribute(slug, attribute);
		}

		return new AttributeSnapshot(slug, defaultValues.title, defaultValues.note,
			attribute.current, defaultValues.options, attribute.items);
	}
}
