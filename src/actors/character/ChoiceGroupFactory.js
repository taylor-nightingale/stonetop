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

	// `sideEffects: false` yields a value-persistence-only controller (no follower/outfit-item handlers
	// fire). Use it for choice groups whose side effects are owned by a bespoke, non-choice-group path —
	// e.g. possessions, whose item-granting is selection-gated and handled by syncPossessionItems, so
	// routing writes through the shared controller must NOT also fire the registered OutfitItemSideEffectHandler.
	// `render: false` persists without re-rendering the owning sheet — use it for write-in fields whose
	// DOM already reflects the typed value (arcanum blanks), where a re-render would steal focus mid-edit.
	forItem(itemId, valueField, { sideEffects = true, render = true } = {}) {
		const actor   = this._actor;
		const handlers = this._handlers;
		const getItem  = () => [...actor.items].find(i => i._id === itemId) ?? null;
		return new ChoiceGroupController({
			reader:           () => getItem()?.system?.[valueField] ?? {},
			writer:           async (v) => actor.updateEmbeddedDocuments("Item", [{ _id: itemId, system: { [valueField]: v } }], { render }),
			definitionGetter: sideEffects ? (ns) => _smartDefaultDef(getItem(), ns) : () => null,
			handlers:         sideEffects ? handlers : [],
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
