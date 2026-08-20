import { ChoiceTarget } from "../actors/character/ChoiceTarget.js";

/**
 * How a rendered choice row behaves, described once for every sheet that shows one.
 *
 * Every row the shared choice-row partial emits stamps `data-change-action` (cgTrack/cgPick/cgText)
 * and the `data-cg-*` attributes a ChoiceTarget is built from. The host only has to be a typed actor
 * that answers the four choice methods; nothing here knows what an improvement, an arcanum or a
 * seasonal gain is — that routing is the host's ChoiceStores.
 *
 * Capture phase, because a widget's own bubble-phase change handler must not be able to starve this
 * (the lesson behind the steading's original track listener).
 */
export class ChoiceGroupWiring {
	// The change actions this wiring owns. A ChangeActionRouter sharing the same root is handed
	// these as `ignore`, so choice rows don't read as template drift to it.
	static CHANGE_ACTIONS = ["cgTrack", "cgPick", "cgText"];

	#host;
	#when;

	/**
	 * @param host  typed actor answering setChoiceTrackFor / setChoicePickFor / setChoiceTextFor /
	 *              clearChoicePickFor.
	 * @param when    predicate checked per event — the home for gates evaluated at event time rather
	 *                than at wiring time (a sheet's isEditable, which can change mid-session).
	 */
	constructor(host, { when = () => true } = {}) {
		this.#host = host;
		this.#when = when;
	}

	attach(root) {
		root.addEventListener("change", ev => this.#onChange(ev), true);
		root.addEventListener("click", ev => this.#onClick(ev), true);
		return this;
	}

	#onChange(ev) {
		const el = this.#row(ev, "[data-change-action]");
		if (!el) return;
		const target = ChoiceTarget.fromElement(el);
		switch (el.dataset.changeAction) {
			case "cgTrack": return void this.#host.setChoiceTrackFor(target, el.dataset.cgIndex, el.checked);
			case "cgPick":  return void this.#host.setChoicePickFor(target, el.checked);
			case "cgText":  return void this.#host.setChoiceTextFor(target, el.value);
		}
	}

	// A "pick 1" row renders radios, which a browser will never let you untick. Clicking the option
	// that is already picked releases it instead. `defaultChecked` is the RENDERED (i.e. persisted)
	// state, which is what separates "re-clicked the current pick" from "moved the pick" — at click
	// time `checked` is already true either way. preventDefault stops the browser re-checking it
	// before the re-render lands.
	#onClick(ev) {
		const el = this.#row(ev, ".stonetop-cg-pick");
		if (!el || !el.defaultChecked) return;
		ev.preventDefault();
		void this.#host.clearChoicePickFor(ChoiceTarget.fromElement(el));
	}

	// No context check: `data-change-action="cg*"` and `.stonetop-cg-pick` are already cg-specific,
	// and an unregistered context resolves to null in the host's store — "nothing to write" is a
	// normal answer there, not an error.
	#row(ev, selector) {
		if (!this.#when(ev)) return null;
		return ev.target.closest?.(selector) ?? null;
	}
}
