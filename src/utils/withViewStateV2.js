import { OpenDisclosures } from "./OpenDisclosures.js";
import { buildFocusSelector } from "../actors/buildFocusSelector.js";

/**
 * What a Stonetop ApplicationV2 sheet keeps across its own re-renders: the regions its reader opened,
 * and where their focus was. Composed by both the actor and the item bases — core rebuilds a part's
 * DOM on every render, on either kind of sheet.
 */
export function withViewStateV2(Base) {
	return class extends Base {
		/**
		 * The collapsible regions this reader has opened or shut — move rows, the steading's name
		 * lists, an improvement card's parts. Every Stonetop sheet renders disclosures through shared
		 * partials, so the one place that knows a region can be opened is also the one place that has
		 * to put it back — here, rather than in each sheet.
		 */
		get openDisclosures() {
			return this._openDisclosures ??= new OpenDisclosures();
		}

		// Core's built-in focus restore only re-finds elements with an id or name; our sheets are
		// full of dataset-addressed controls (pips, chips, per-member inputs). state.focus is just
		// a selector string, so upgrade it with buildFocusSelector when it produces one.
		//
		// The view state goes back here as well as in _syncPartState, and the difference is a frame:
		// core hands this the new part element BEFORE it is put in the document, and _syncPartState
		// after. Restored only after, every re-render painted the template's own defaults for one
		// frame first — ticking a debility flipped the band's fold caret open and back, because the
		// markup ships expanded and the class saying otherwise arrived a frame late.
		//
		// Both calls stay. This one cannot answer anything that needs layout — a detached element has
		// no computed style, and an untouched rail is open or shut according to its WIDTH — so the
		// call in _syncPartState is what settles those, over a tree that is already correct.
		_preSyncPartState(partId, newElement, priorElement, state) {
			super._preSyncPartState(partId, newElement, priorElement, state);
			const focused = priorElement.contains(document.activeElement) ? document.activeElement : null;
			const selector = buildFocusSelector(focused, priorElement);
			if (selector) state.focus = selector;
			this.restoreViewState(newElement);
		}

		/**
		 * Put every region this reader has opened, shut, hidden or filtered back the way they left
		 * it, in a freshly rendered tree.
		 *
		 * Core rebuilds the part's DOM on every render, which takes all of that with it — so a pip
		 * ticked anywhere on the sheet, or another player's edit arriving over the socket, shut the
		 * move you were reading. Lives here rather than in each sheet: the markup is shared.
		 *
		 * A subclass extends this with what only it can collapse; it must not restore anything by
		 * FOCUSING an element (see _syncPartState — focus is core's, and moves scroll).
		 */
		restoreViewState(root) {
			this.openDisclosures.restore(root);
		}

		// Everything that has to be true of the new DOM before core measures it, in the order core's
		// own restore depends on.
		//
		// The view state goes back FIRST, because it changes how tall the part is: the template
		// renders every disclosure shut, so restoring scroll against that tree writes a scrollTop
		// the browser clamps to the shorter content — and re-opening the regions afterwards left the
		// clamped value in place and set the browser's own scroll anchoring pushing against it. A
		// checkbox ticked low on a long tab could throw the view several hundred pixels.
		//
		// Focus goes back LAST and by our own hand: core restores it with a bare `.focus()`, which
		// scrolls EVERY scrollable ancestor of the refocused control into view — including ones
		// outside our declared `scrollable` list (e.g. the window content), which then stay scrolled
		// because only the declared containers get their scrollTop restored. Hand core the state with
		// focus suppressed so it still owns scroll (and details) restore — the entry shape differs
		// between v13 and v14 — then focus ourselves with preventScroll so nothing moves.
		_syncPartState(partId, newElement, priorElement, state) {
			const { focus } = state;
			this.restoreViewState(newElement);
			super._syncPartState(partId, newElement, priorElement, { ...state, focus: null });
			if (focus) newElement.querySelector(focus)?.focus({ preventScroll: true });
		}
	};
}
