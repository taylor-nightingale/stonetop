import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class ChoiceGroupController {
	constructor({ reader, writer, definitionStore = null, followers = null, outfitItems = null }) {
		this._reader       = reader;
		this._writer       = writer;
		this._defStore     = definitionStore;
		this._followers    = followers;
		this._outfitItems  = outfitItems;
	}

	static forActorSection(actor, section, { followers, outfitItems } = {}) {
		return new ChoiceGroupController({
			reader: () => actor.system?.[section]?.values ?? {},
			writer: async (v) => actor.update({ [`system.${section}.values`]: v }),
			definitionStore: {
				get:    (ns) => actor.system?.[section]?.groupDefs?.[ns] ?? null,
				getAll: ()   => actor.system?.[section]?.groupDefs ?? {},
				save:   async (defs) => actor.update({ [`system.${section}.groupDefs`]: defs }),
			},
			followers,
			outfitItems,
		});
	}

	static forItem(actor, itemId, valueField, { followers, outfitItems, definitionGetter } = {}) {
		const getItem = () => [...actor.items].find(i => i._id === itemId) ?? null;
		const defaultDef = (ns) => (getItem()?.system?.choices ?? []).find(c => c.slug === ns) ?? null;
		return new ChoiceGroupController({
			reader: () => getItem()?.system?.[valueField] ?? {},
			writer: async (v) => actor.updateEmbeddedDocuments("Item", [{ _id: itemId, system: { [valueField]: v } }]),
			definitionStore: { get: definitionGetter ?? defaultDef },
			followers,
			outfitItems,
		});
	}

	get _values() { return new ChoiceValues(this._reader()); }

	async addGroup(namespace, groupData) {
		const seen = new Set();
		for (const item of groupData.list) {
			if (!item.slug) continue;
			if (seen.has(item.slug)) throw new Error(`Duplicate slug "${item.slug}" in group "${namespace}"`);
			seen.add(item.slug);
		}
		if (!this._defStore?.save) return;
		const existing = this._defStore.getAll?.() ?? {};
		await this._defStore.save({ ...existing, [namespace]: groupData });
	}

	buildGroupSnapshot(namespace, followersBySlug = {}) {
		const def = this._defStore?.get(namespace) ?? null;
		if (!def) return null;
		return ChoiceGroup.fromPackData({ slug: namespace, list: def.list }, this._values, followersBySlug);
	}

	async selectOption(namespace, slug, siblingSlugsCsv) {
		let values = this._values;
		if (siblingSlugsCsv) {
			for (const sib of siblingSlugsCsv.split(",")) values = values.set(namespace, sib, 0);
		}
		const newValues = values.set(namespace, slug, 1);
		await this._writer(newValues.toRaw());
		await this._fireSideEffects(namespace, slug, 1, newValues);
	}

	async setCount(namespace, optionSlug, count) {
		const newValues = this._values.set(namespace, optionSlug, count);
		await this._writer(newValues.toRaw());
		await this._fireSideEffects(namespace, optionSlug, count, newValues);
	}

	async setText(namespace, optionSlug, text) {
		const newValues = this._values.set(namespace, optionSlug, text);
		await this._writer(newValues.toRaw());
	}

	async clearValues(namespace) {
		const raw = { ...this._values.toRaw() };
		delete raw[namespace];
		await this._writer(raw);
	}

	async _fireSideEffects(namespace, optionSlug, count, newValues) {
		const def = this._defStore?.get(namespace);
		if (!def) return;
		const row = (def.list ?? []).find(r => r.slug === optionSlug);
		if (row?.type === "follower" && this._followers) {
			if (count > 0) await this._followers.addFollower(optionSlug);
			else           await this._followers.removeFollower(optionSlug);
		}
		if (this._outfitItems) {
			await this._syncOutfitItems(def, newValues);
		}
	}

	async _syncOutfitItems(def, values) {
		const items = [];
		for (const row of def.list ?? []) {
			for (const opt of row.options ?? []) {
				if (opt.outfitItems?.length && values.getCount(def.slug, opt.slug) > 0) {
					items.push(...opt.outfitItems);
				}
			}
		}
		await this._outfitItems.items.sync(this._outfitItems.source, items);
	}
}
