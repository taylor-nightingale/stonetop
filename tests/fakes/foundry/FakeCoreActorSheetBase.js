import { vi } from "vitest";

// A core-faithful stand-in for ActorSheetV2's drop pipeline, shared by every sheet-drop test so there
// is ONE description of how core behaves (a per-test copy would drift, and every test built on it
// would then quietly agree with a fiction).
//
// Faithful in three ways that matter:
//  - core binds the drop by ASSIGNING element.ondrop (no addEventListener stacking), which is what
//    makes a sheet that also wires its own `drop` listener handle every drop twice;
//  - a resolved drop goes to _onDropDocument, which routes by documentName (Actor → _onDropActor,
//    everything else → _onDropItem);
//  - the _onDropItem default is an embed, so a sheet that fails to intercept a drop silently creates
//    an embedded item.
//
// Tests fire a drop by dispatching an event carrying `_testDroppedItem` (standing in for the document
// core resolves from the drag data), or by calling the _onDrop* hooks directly.
//
// It also stands in for core's tab machinery: ApplicationV2 seeds tabGroups from the tabs config and
// routes _prepareTabs through _getTabsConfig (which a sheet may override for dynamic tabs).
export class FakeCoreActorSheetBase {
	tabGroups = {};
	isEditable = true;
	render = vi.fn();

	constructor(actor) {
		this.actor = actor;
		this.element = document.createElement("form");
		this.element.ondrop = ev => this._onDrop(ev);
	}

	async _onFirstRender() {}
	_onRender() {}

	_getTabsConfig(group) { return this.constructor.TABS?.[group] ?? null; }

	_prepareTabs(group) {
		const { tabs, initial = null, labelPrefix } = this._getTabsConfig(group) ?? { tabs: [] };
		this.tabGroups[group] ??= initial;
		return tabs.reduce((prepared, { id, ...cfg }) => {
			const active = this.tabGroups[group] === id;
			const tab = { id, group, active, cssClass: active ? "active" : "", ...cfg };
			if (labelPrefix) tab.label ??= `${labelPrefix}.${id}`;
			prepared[id] = tab;
			return prepared;
		}, {});
	}

	async _prepareContext() { return { tabs: this._prepareTabs("primary") }; }

	async _onDrop(event) {
		return this._onDropDocument(event, event._testDroppedItem);
	}

	async _onDropDocument(event, document) {
		if (document?.documentName === "Actor") return this._onDropActor(event, document);
		return this._onDropItem(event, document);
	}

	async _onDropActor() { return null; }

	async _onDropItem(event, item) {
		await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
		return item;
	}
}
