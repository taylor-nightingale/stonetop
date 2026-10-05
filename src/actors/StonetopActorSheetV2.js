import { withStonetopSheetChromeV2 } from "../utils/withStonetopSheetChromeV2.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { ADVICE_ACTIONS } from "../utils/adviceAction.js";
import { EDIT_IMAGE_ACTIONS } from "../utils/editImageAction.js";
import { withViewStateV2 } from "../utils/withViewStateV2.js";
import { RailState } from "../utils/SheetRail.js";
import { TabStripWatch } from "../utils/TabStripFit.js";
import { TabMoreMenu } from "../utils/TabMoreMenu.js";

/**
 * The shared ApplicationV2 base for all Stonetop actor sheets: HandlebarsApplicationMixin over
 * core's ActorSheetV2, plus the shared Stonetop sheet chrome.
 *
 * Class factory, deferred to init like the sheet classes: the ApplicationV2 bases only exist once
 * Foundry has booted.
 *
 * `submitOnChange: true` is what persists the `name` / `name="system.stats.*"` inputs core owns.
 */
export function createStonetopActorSheetV2Class() {
	const { HandlebarsApplicationMixin } = foundry.applications.api;
	const { ActorSheetV2 } = foundry.applications.sheets;

	return class StonetopActorSheetV2 extends withViewStateV2(withStonetopSheetChromeV2(HandlebarsApplicationMixin(ActorSheetV2))) {
		static DEFAULT_OPTIONS = {
			classes: ["stonetop", "sheet", "actor"],
			window: { resizable: true },
			form: { submitOnChange: true },
			actions: { ...ADVICE_ACTIONS, ...EDIT_IMAGE_ACTIONS },
		};

		// The actor's domain object. Named generically so shared sheet code (move rows, tag chips)
		// can reach it; concrete sheets alias it under their own domain name.
		get typedActor() {
			return this.actor.typedActor;
		}

		/**
		 * Which side rails this reader has put away — the character sheet's moves index, the
		 * steading's arches. Same reason it lives here rather than on either sheet: both render the
		 * one shared rail, so one place puts it back.
		 */
		get railState() {
			return this._railState ??= new RailState();
		}

		/**
		 * Which tabs the strip has room for, and which it lists under "More" — both sheets render the
		 * one shared strip. Refitted after every render, on every resize, and whenever the open tab
		 * changes, since the open tab always keeps its place in the strip.
		 */
		get tabStrip() {
			return this._tabStrip ??= new TabStripWatch();
		}

		changeTab(tab, group, options) {
			super.changeTab(tab, group, options);
			this.tabStrip.refit();
		}

		_onRender(context, options) {
			super._onRender(context, options);
			this.tabStrip.watch(this.element);
		}

		/**
		 * Every Stonetop actor sheet renders from a snapshot built by its typed actor, with the
		 * rich text enriched in one pass. A subclass adds only what is its own — and can start any
		 * independent async work BEFORE calling super, so it still overlaps the snapshot build.
		 */
		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.actor    = this.actor;
			context.editable = this.isEditable;
			// Scopes every id this sheet's markup mints for aria-controls / aria-labelledby wiring.
			// Per-application, because two sheets open at once must not mint the same ids.
			context.sheetIdPrefix = this.id;
			context.stonetop = await this.typedActor.buildSnapshot();
			await enrichRichTextTree(context.stonetop, this.actor?.getRollData?.() ?? {});
			return context;
		}

		// The shared restore (withViewStateV2) plus the side rails, which only actor sheets have.
		restoreViewState(root) {
			super.restoreViewState(root);
			this.railState.restore(root);
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			// The first render has no prior element, so core never calls _syncPartState for it — and a
			// rail nobody has touched still has to have its toggle pointed the way the layout went.
			this.restoreViewState(this.element);
			new TabMoreMenu().attach(this.element);
			// Editability is checked per event, not at wiring time: first render happens exactly
			// once, and a sheet can become editable later (ownership granted mid-session).
			this.element.addEventListener("click", async ev => {
				if (!this.isEditable) return;
				const rollable = ev.target.closest(".rollable[data-roll]");
				if (!rollable) return;
				ev.stopPropagation();
				await this.actor._onRoll(ev);
			}, true);
		}

		// A control persisted by a domain method has nothing for core's submit to do, and that submit
		// is not cheap: it builds a FormDataExtended over the WHOLE form, expands it, and runs a full
		// document validate — then _processFormData throws almost all of it away and the diff comes
		// back empty. Skip it for those, so only the fields core actually owns pay for it.
		_onChangeForm(formConfig, event) {
			if (event.target?.closest?.("[data-change-action]")) return;
			super._onChangeForm(formConfig, event);
		}

		// submitOnChange makes core submit the WHOLE form on every change, but the only inputs core
		// legitimately owns are `name` and `system.*`. Every other named input on a Stonetop sheet
		// (roll-mode / background / origin / load-level / playbook-select, the choice-group radios,
		// the steading's fortunes and attribute radios) carries a `name` purely for browser radio
		// grouping and is persisted by a domain method. Left in, they'd drive a SECOND actor.update
		// per change — a redundant re-render that races the click you're making (the "click after
		// typing didn't take" glitch) and churns validation on junk top-level keys.
		_processFormData(event, form, formData) {
			const data = super._processFormData(event, form, formData);
			const clean = {};
			for (const key of ["name", "img", "system"]) {
				if (data[key] !== undefined) clean[key] = data[key];
			}
			return clean;
		}
	};
}
