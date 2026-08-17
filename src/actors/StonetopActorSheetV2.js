import { withSheetSizeMemoryV2 } from "../utils/withSheetSizeMemoryV2.js";
import { buildFocusSelector } from "./buildFocusSelector.js";
import { activateEditToggles } from "../utils/editToggle.js";
import { activateSteppers } from "../utils/stepper.js";
import { activateComboBoxes } from "../utils/comboBox.js";
import { reenableViewStateControls } from "../utils/viewStateControls.js";
import { ScrollAnchor } from "../utils/ScrollAnchor.js";

/**
 * The shared ApplicationV2 base for all Stonetop actor sheets: HandlebarsApplicationMixin over
 * core's ActorSheetV2, plus the size-memory mixin (matching the V1 `StonetopActorSheet`).
 *
 * Class factory, deferred to init like the sheet classes: the ApplicationV2 bases only exist once
 * Foundry has booted.
 *
 * What the V1 base did that V2 makes free:
 * - scroll restore across re-renders → declare `scrollable` on the concrete sheet's PARTS
 * - the whole `_render` override → gone
 *
 * `submitOnChange: true` matches V1 ActorSheet's default (how `name="system.x"` stat inputs save).
 */
export function createStonetopActorSheetV2Class() {
	const { HandlebarsApplicationMixin } = foundry.applications.api;
	const { ActorSheetV2 } = foundry.applications.sheets;

	return class StonetopActorSheetV2 extends withSheetSizeMemoryV2(HandlebarsApplicationMixin(ActorSheetV2)) {
		static DEFAULT_OPTIONS = {
			// "themed theme-light": parchment sheets are always light. Core sees "themed" already
			// present and skips imposing the client theme (see the item base for details).
			classes: ["stonetop", "sheet", "actor", "themed", "theme-light"],
			window: { resizable: true },
			form: { submitOnChange: true },
		};

		// Core's built-in focus restore only re-finds elements with an id or name; our sheets are
		// full of dataset-addressed controls (pips, chips, per-member inputs). state.focus is just
		// a selector string, so upgrade it with buildFocusSelector when it produces one.
		_preSyncPartState(partId, newElement, priorElement, state) {
			super._preSyncPartState(partId, newElement, priorElement, state);
			const selector = buildFocusSelector(priorElement.querySelector(":focus"), priorElement);
			if (selector) state.focus = selector;
		}

		// Same as core's _syncPartState (restore focus, then scroll positions), but focus with
		// `preventScroll: true`. Core's bare `.focus()` scrolls EVERY scrollable ancestor of the
		// refocused control into view — including ones outside our declared `scrollable` list
		// (e.g. the window content), which then stay scrolled because only the declared containers
		// get their scrollTop restored afterward. That mismatch is the "page jumped to the top"
		// glitch after a change re-render. preventScroll keeps focus from moving anything; the
		// declared containers are then restored to exactly where they were.
		_syncPartState(partId, newElement, priorElement, state) {
			if (state.focus) {
				const newFocus = newElement.querySelector(state.focus);
				if (newFocus) newFocus.focus({ preventScroll: true });
			}
			for (const [el, scrollTop, scrollLeft] of state.scrollPositions ?? [])
				Object.assign(el, { scrollTop, scrollLeft });
		}

		// Set by an action whose writes are about to re-render the sheet; applied on each of those
		// renders until the action releases it (see keepAnchored).
		#scrollAnchor = null;

		/**
		 * Run `work` (an action's writes) while keeping `element` visually still, however many renders
		 * those writes cause.
		 *
		 * One render is not enough to anchor against. An action that writes twice — flipping an arcanum
		 * updates the card AND adds/removes the gear that side grants — renders twice, and the second
		 * render can begin before the first has finished restoring: it then captures the mid-swap
		 * scroll position (0, because a container that has not been laid out yet clamps the
		 * assignment) and restores that instead. So the anchor is held for the whole action rather
		 * than consumed by the first render. Re-applying is idempotent — once the element is back
		 * where it was the correction is 0 — so the extra passes cost nothing.
		 *
		 * Released a tick after the writes settle, since the last render they trigger is not awaited
		 * by the write itself.
		 */
		async keepAnchored(element, anchorSelector, containerSelector, work) {
			this.#scrollAnchor = ScrollAnchor.capture(element, anchorSelector, containerSelector);
			try {
				return await work();
			} finally {
				setTimeout(() => { this.#scrollAnchor = null; }, 0);
			}
		}

		// Root-delegated listeners go here: unlike V1, the V2 root element PERSISTS across
		// re-renders (only part content is swapped), so wiring these per render would stack
		// duplicate handlers (and editToggle's class *toggle* would cancel itself out).
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			activateEditToggles(this.element);
			activateComboBoxes(); // installs once on document; internally guarded
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

		// An observer-permission sheet is read-only, but collapsing the header or filtering the
		// moves tab changes nothing on the actor — see reenableViewStateControls.
		_toggleDisabled(disabled) {
			super._toggleDisabled(disabled);
			if (disabled) reenableViewStateControls(this.element);
		}

		// Per-element DOM decoration must re-run every render — the part content it decorated
		// was just replaced. activateSteppers is idempotent per input, so this is safe.
		_onRender(context, options) {
			super._onRender(context, options);
			activateSteppers(this.element);
			// Held, not consumed: see keepAnchored — a two-write action renders more than once.
			this.#scrollAnchor?.restore(this.element);
		}
	};
}
