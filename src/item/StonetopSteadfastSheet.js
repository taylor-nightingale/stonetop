// Item sheet for authoring a `steadfast` — the definition of a place (Stonetop, Barrier Pass) a
// steading begins from. Minimal by design: edit the name/description and starting numbers (Foundry
// auto-saves `name`/`system.*` fields), and compose the granted-improvement list by dragging
// `improvement` items onto the sheet (per custom-items-authored-in-Foundry: drag-drop, no "+ add"
// button). The heavy default data (resident traits, coinage, places) is generated, not hand-edited.

import { addImprovement, removeImprovement } from "./steadfastImprovements.js";

export function createStonetopSteadfastSheetClass(Base) {
	return class StonetopSteadfastSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "steadfast"],
				width:  560,
				height: 640,
				resizable: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/item/steadfast.hbs";
		}

		async getData() {
			const context = await super.getData();
			const sys = this.item.system;
			context.system = sys;
			// Each granted improvement as {slug} — the sheet lists slugs; name resolution lands with the
			// Stage E repository that already loads the improvement packs.
			context.grantedImprovements = (sys.improvements ?? []).map((slug) => ({ slug }));
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			html.find(".steadfast-improvement-remove").on("click", (ev) => {
				const slug = ev.currentTarget.dataset.slug;
				this.item.update({ "system.improvements": removeImprovement(this.item.system.improvements ?? [], slug) });
			});
		}

		async _onDrop(event) {
			const data = TextEditor.getDragEventData(event);
			if (data?.type !== "Item") return super._onDrop?.(event);
			const item = await Item.implementation.fromDropData(data);
			if (item?.type !== "improvement") return;
			const next = addImprovement(this.item.system.improvements ?? [], item.system?.slug);
			if (next.length !== (this.item.system.improvements ?? []).length) {
				await this.item.update({ "system.improvements": next });
			}
		}
	};
}
