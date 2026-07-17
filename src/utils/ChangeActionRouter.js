import { warn } from "./logger.js";

/**
 * One delegated "change" listener that dispatches to named handlers — the change-event mirror of
 * ApplicationV2's data-action click convention. Elements opt in with data-change-action="name";
 * the concrete sheet owns the handler map, this class stays generic.
 *
 * An element whose data-change-action has no handler logs a warning instead of silently no-oping:
 * template/map drift should be loud (see the choice-group namespace lesson).
 */
export class ChangeActionRouter {
	#handlers;
	#when;

	/**
	 * @param handlers  map of action name → (element, event) handler.
	 * @param when      optional predicate checked per event before any handler runs — the home
	 *                  for gates that must be evaluated at event time, not wiring time (e.g. a
	 *                  sheet's isEditable, which can change mid-session).
	 */
	constructor(handlers, { when = null } = {}) {
		this.#handlers = handlers;
		this.#when = when;
	}

	/** Wire the single delegated listener onto a rendered sheet root. Capture-phase, so a
	 *  stopPropagation in some widget's own bubble-phase change handler can't starve the router
	 *  (the lesson behind the steading's capture-phase track listener). */
	attach(root) {
		root.addEventListener("change", (ev) => this.#route(ev), true);
	}

	#route(ev) {
		const el = ev.target.closest?.("[data-change-action]");
		if (!el) return;
		const handler = this.#handlers[el.dataset.changeAction];
		if (!handler) {
			warn(`No change handler registered for data-change-action="${el.dataset.changeAction}"`);
			return;
		}
		if (this.#when && !this.#when(ev)) return;
		handler(el, ev);
	}
}
