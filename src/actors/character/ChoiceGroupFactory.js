import { ChoiceGroupController } from "./ChoiceGroupController.js";

export class ChoiceGroupFactory {
	constructor(actor) {
		this._actor    = actor;
		this._handlers = [];
	}

	register(handler) {
		this._handlers.push(handler);
		return this;
	}

	forItem(itemId, valueField) {
		const actor   = this._actor;
		const handlers = this._handlers;
		const getItem  = () => [...actor.items].find(i => i._id === itemId) ?? null;
		return new ChoiceGroupController({
			reader:           () => getItem()?.system?.[valueField] ?? {},
			writer:           async (v) => actor.updateEmbeddedDocuments("Item", [{ _id: itemId, system: { [valueField]: v } }]),
			definitionGetter: (ns) => _smartDefaultDef(getItem(), ns),
			handlers,
		});
	}

	forItemType(type, valueField, definitionGetter = null) {
		const actor    = this._actor;
		const handlers = this._handlers;
		const getItem  = () => [...actor.items].find(i => i.type === type) ?? null;
		return new ChoiceGroupController({
			reader: () => getItem()?.system?.[valueField] ?? {},
			writer: async (v) => {
				const item = getItem();
				if (!item) return;
				await actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { [valueField]: v } }]);
			},
			definitionGetter: definitionGetter
				? (ns) => definitionGetter(ns, getItem())
				: (ns) => _smartDefaultDef(getItem(), ns),
			handlers,
		});
	}
}

function _smartDefaultDef(item, ns) {
	if (!item) return null;
	if (ns === "instinct" && item.system?.instinct?.slug === "instinct")
		return item.system.instinct;
	const choices = item.system?.choices;
	if (Array.isArray(choices)) return choices.find(c => c.slug === ns) ?? null;
	if (choices?.slug === ns)   return choices;
	const back = item.system?.back?.choices;
	if (back?.slug === ns)      return back;
	return null;
}
