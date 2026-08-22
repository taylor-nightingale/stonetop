import { withStonetopSheetChromeV2 } from "../utils/withStonetopSheetChromeV2.js";

/**
 * The shared ApplicationV2 base for all Stonetop item sheets: HandlebarsApplicationMixin over
 * core's ItemSheetV2, plus the size-memory mixin (matching the V1 `ItemSheetBase`).
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

	return class StonetopItemSheetV2 extends withStonetopSheetChromeV2(HandlebarsApplicationMixin(ItemSheetV2)) {
		static DEFAULT_OPTIONS = {
			classes: ["stonetop", "sheet", "item"],
			window: { resizable: true },
			form: { submitOnChange: true },
		};

	};
}
