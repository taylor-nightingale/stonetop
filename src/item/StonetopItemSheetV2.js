import { withStonetopSheetChromeV2 } from "../utils/withStonetopSheetChromeV2.js";
import { EDIT_IMAGE_ACTIONS } from "../utils/editImageAction.js";
import { withViewStateV2 } from "../utils/withViewStateV2.js";

/**
 * The shared ApplicationV2 base for all Stonetop item sheets: HandlebarsApplicationMixin over
 * core's ItemSheetV2, plus the size-memory mixin (matching the V1 `ItemSheetBase`) and the view state
 * every Stonetop sheet keeps across a re-render (withViewStateV2).
 *
 * Class factory, deferred to init like the sheet classes: the ApplicationV2 bases only exist once
 * Foundry has booted. Concrete item sheets are created as `create*SheetClass(base)` with this as
 * the injected base, same as the V1 path.
 *
 * `submitOnChange: true` replaces V1's save-on-close: V2 defaults BOTH submitOnChange and
 * closeOnSubmit to false, so without this, `name="system.x"` inputs would never persist.
 */
export function createStonetopItemSheetV2BaseClass() {
	const { HandlebarsApplicationMixin } = foundry.applications.api;
	const { ItemSheetV2 } = foundry.applications.sheets;

	return class StonetopItemSheetV2 extends withViewStateV2(withStonetopSheetChromeV2(HandlebarsApplicationMixin(ItemSheetV2))) {
		static DEFAULT_OPTIONS = {
			classes: ["stonetop", "sheet", "item"],
			window: { resizable: true },
			form: { submitOnChange: true },
			actions: { ...EDIT_IMAGE_ACTIONS },
		};

		// As on the actor sheets (StonetopActorSheetV2): a control a domain method persists has
		// nothing for core's submit to do.
		_onChangeForm(formConfig, event) {
			if (event.target?.closest?.("[data-change-action]")) return;
			super._onChangeForm(formConfig, event);
		}

		// And the only inputs core owns are `name`, `img` and `system.*`; any other `name` is there
		// to group radios, and would be written to the item as a junk top-level key.
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
