import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {AttributeSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {StonetopFlags} from "../character/StonetopFlags.js";

class AttributeState {
	slug;
	items = [];
	current;
	defaultsAdded = false;
	constructor(slug) {
		this.slug = slug;
	}

	static fromRaw(raw) {
		const instance = new AttributeState();
		instance.slug = raw.slug;
		instance.items = raw.items ?? [];
		instance.current = raw.current;
		instance.defaultsAdded = raw.defaultsAdded ?? false;
		return instance;
	}

	toPlainData() {
		return  {
			slug: this.slug,
			items: this.items,
			current: this.current,
			defaultsAdded: this.defaultsAdded
		};
	}
	addNewItem() {
		this.items.push("");
		return this;
	}

	updateItem(index, item) {
		this.items[index] = item;
		return this;
	}

	removeItem(index) {
		this.items.splice(index, 1);
		return this;
	}

	setCurrent(current) {
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

	async _setAttribute(attribute) {
		return await this._flags.setFlag(attribute.slug, attribute.toPlainData());
	}

	_attribute(slug) {
		const raw = this._flags.getFlag(slug) ?? new AttributeState(slug);

		if (raw instanceof AttributeState) {
			return raw;
		}

		return AttributeState.fromRaw(raw);
	}


	async setCurrent(attributeSlug, current) {
		const attribute = this._attribute(attributeSlug).setCurrent(current);
		await this._setAttribute(attribute);
	}

	async addNewItemToAttribute(attributeSlug) {
		const attribute = this._attribute(attributeSlug).addNewItem();
		await this._setAttribute(attribute);
	}

	async updateItemOnAttribute(attributeSlug, index, value) {
		const attribute = this._attribute(attributeSlug).updateItem(index, value);
		await this._setAttribute(attribute);
	}

	async removeItemFromAttribute(attributeSlug, index) {
		const attribute = this._attribute(attributeSlug).removeItem(index);
		await this._setAttribute(attribute);
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
			await this._setAttribute(attribute);
		}

		return new AttributeSnapshot(slug, defaultValues.title, defaultValues.note,
			attribute.current, defaultValues.options, attribute.items);
	}
}
