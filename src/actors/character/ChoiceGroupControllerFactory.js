import { ChoiceGroupController } from "./ChoiceGroupController.js";

/**
 * Builds the write-side controller for a choice-value store. It knows nothing about item types, field
 * names or any particular group: the caller says which document and which field, and subscribers say
 * what should happen when a value changes.
 *
 * `forDocument` binds one specific document by id — used where the character owns many of a thing and
 * the caller has already picked one, and builds the controller immediately before writing.
 * `forSingleton` binds whichever document of a type the character currently has, re-resolved on every
 * write. That is what a long-lived controller needs when the document underneath it can be replaced:
 * a controller held in a constructor would otherwise keep writing to a deleted id once the document is
 * swapped, and it no-ops cleanly while the character has none yet.
 */
export class ChoiceGroupControllerFactory {
	constructor(actor) {
		this._actor       = actor;
		this._subscribers = [];
	}

	/** Everything that reacts to a choice value changing. Each subscriber owns its own relevance test. */
	subscribe(subscriber) {
		this._subscribers.push(subscriber);
		return this;
	}

	forDocument(itemId, valueField) {
		return this._bind(() => [...this._actor.items].find(i => i._id === itemId) ?? null, valueField);
	}

	forSingleton(type, valueField) {
		return this._bind(() => [...this._actor.items].find(i => i.type === type) ?? null, valueField);
	}

	// One binding for both: the caller supplies the item-resolution strategy (by id or by type) and the
	// store field. The writer re-resolves through `getItem` every time so a controller that outlives its
	// document (a deleted/swapped item) no-ops cleanly instead of writing to a stale id.
	_bind(getItem, valueField) {
		const actor = this._actor;
		return new ChoiceGroupController({
			reader: () => getItem()?.system?.[valueField] ?? {},
			writer: async (v) => {
				const item = getItem();
				if (!item) return;
				await actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { [valueField]: v } }]);
			},
			itemGetter:  getItem,
			subscribers: this._subscribers,
		});
	}
}
