import { withSheetSizeMemoryV2 } from "./withSheetSizeMemoryV2.js";
import { activateEditToggles } from "./editToggle.js";
import { activateComboBoxes } from "./comboBox.js";
import { activateSteppers } from "./stepper.js";
import { reenableViewStateControls } from "./viewStateControls.js";

/**
 * The behavior every Stonetop sheet has regardless of what document it edits: remembered window
 * size, the shared widget set (edit toggles, comboboxes, steppers), and keeping view-state controls
 * usable on a read-only sheet.
 *
 * Applied by both document bases. Before this existed the two maintained their own copies and had
 * already drifted — the item base activated no widgets at all, so `.stonetop-step` inputs in item
 * templates silently never got steppers.
 *
 * `DEFAULT_OPTIONS` deliberately stays on the concrete bases: `classes` differs per document type,
 * and core merges that static along the prototype chain at construction, which is machinery worth
 * keeping visible in one place per base rather than split across a mixin.
 *
 * @param Base  the ApplicationV2 document-sheet base to extend.
 */
export function withStonetopSheetChromeV2(Base) {
	return class StonetopSheetChrome extends withSheetSizeMemoryV2(Base) {
		// Root-delegated wiring goes here: the V2 root element PERSISTS across re-renders (only
		// part content is swapped), so wiring per render would stack duplicate handlers — and
		// editToggle's class *toggle* would cancel itself out.
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			activateEditToggles(this.element);
			activateComboBoxes(); // installs once on document; internally guarded
		}

		// An observer-permission sheet is read-only, but collapsing a header or filtering a list
		// changes nothing on the document — see reenableViewStateControls.
		_toggleDisabled(disabled) {
			super._toggleDisabled(disabled);
			if (disabled) reenableViewStateControls(this.element);
		}

		// Per-element decoration must re-run every render — the part content it decorated was just
		// replaced. activateSteppers is idempotent per input, so this is safe.
		_onRender(context, options) {
			super._onRender(context, options);
			activateSteppers(this.element);
		}
	};
}
