import { withStonetopSheetChromeV2 } from "../utils/withStonetopSheetChromeV2.js";
import { buildFocusSelector } from "./buildFocusSelector.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";

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

	return class StonetopActorSheetV2 extends withStonetopSheetChromeV2(HandlebarsApplicationMixin(ActorSheetV2)) {
		static DEFAULT_OPTIONS = {
			classes: ["stonetop", "sheet", "actor"],
			window: { resizable: true },
			form: { submitOnChange: true },
		};

		// The actor's domain object. Named generically so shared sheet code (move rows, tag chips)
		// can reach it; concrete sheets alias it under their own domain name.
		get typedActor() {
			return this.actor.typedActor;
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
			context.stonetop = await this.typedActor.buildSnapshot();
			await enrichRichTextTree(context.stonetop, this.actor?.getRollData?.() ?? {});
			return context;
		}

		// Core's built-in focus restore only re-finds elements with an id or name; our sheets are
		// full of dataset-addressed controls (pips, chips, per-member inputs). state.focus is just
		// a selector string, so upgrade it with buildFocusSelector when it produces one.
		_preSyncPartState(partId, newElement, priorElement, state) {
			super._preSyncPartState(partId, newElement, priorElement, state);
			const focused = priorElement.contains(document.activeElement) ? document.activeElement : null;
			const selector = buildFocusSelector(focused, priorElement);
			if (selector) state.focus = selector;
		}

		// Core restores focus with a bare `.focus()`, which scrolls EVERY scrollable ancestor of the
		// refocused control into view — including ones outside our declared `scrollable` list (e.g.
		// the window content), which then stay scrolled because only the declared containers get
		// their scrollTop restored. That mismatch is the "page jumped to the top" glitch after a
		// change re-render. Hand core the state with focus suppressed so it still owns scroll (and
		// details) restore — the entry shape differs between v13 and v14 — then focus ourselves
		// with preventScroll so nothing moves.
		_syncPartState(partId, newElement, priorElement, state) {
			const { focus } = state;
			super._syncPartState(partId, newElement, priorElement, { ...state, focus: null });
			if (focus) newElement.querySelector(focus)?.focus({ preventScroll: true });
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
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
