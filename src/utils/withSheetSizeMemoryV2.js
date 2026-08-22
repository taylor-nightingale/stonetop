import { SheetSize } from "./SheetSize.js";
import { sheetSizeMemory } from "./SheetSizeMemory.js";
import { RootFontScale } from "./RootFontScale.js";
import { RememberedSize } from "./RememberedSize.js";

// How long after the last resize/drag to persist the size — avoids a localStorage write per mouse-move.
const SAVE_DEBOUNCE_MS = 500;

/**
 * ApplicationV2 sheet base mixin: remembers a sheet's window size (per sheet type) and reopens it
 * at that size. V2 counterpart of withSheetSizeMemory (which stays until the last V1 sheet is gone).
 *
 * ApplicationV2 freezes `this.options` at construction, so the saved size is injected in
 * `_initializeApplicationOptions` (pre-freeze) instead of the constructor. Saves hang off
 * `_onPosition`, which V2 calls after every setPosition (drag, resize, programmatic) with the full
 * merged position.
 *
 * Both the designed size and a remembered one are read against the reader's Font Size setting,
 * because a sheet's contents are all rem and its `position` is px. A designed size is scaled from
 * the 16px baseline it was drawn at; a remembered size is converted from the setting the user chose
 * it at, so their choice is preserved as an amount of sheet rather than a number of pixels that
 * silently means something different once the setting moves.
 *
 * @param Base    the ApplicationV2 document-sheet base to extend (needs `options.document`).
 * @param memory  the SheetSizeMemory store (injectable for tests; defaults to the shared singleton).
 * @param scaleOf how to read the current root font scale (injectable for tests).
 */
export function withSheetSizeMemoryV2(Base, memory = sheetSizeMemory, scaleOf = () => RootFontScale.fromDocument()) {
	return class SheetSizeMemoryMixin extends Base {
		#saveSize = foundry.utils.debounce(
			(size) => memory.set(this.#sizeKey(), new RememberedSize(size, scaleOf().rootFontSizePx)),
			SAVE_DEBOUNCE_MS
		);

		_initializeApplicationOptions(options) {
			const opts = super._initializeApplicationOptions(options);
			const key = SheetSizeMemoryMixin.#keyFor(options.document);
			const scale = scaleOf();
			const remembered = key ? memory.get(key) : null;
			const size = remembered
				? scale.convert(remembered).clampedTo(globalThis.innerWidth, globalThis.innerHeight)
				: SheetSizeMemoryMixin.#designedFor(opts, scale);
			if (size) opts.position = { ...opts.position, width: size.width, height: size.height };
			return opts;
		}

		/** The sheet's declared size, grown for the reader's font setting and kept on the display. */
		static #designedFor(opts, scale) {
			const designed = SheetSize.fromObject(opts.position);
			if (!designed) return null;
			return scale.scale(designed).clampedTo(globalThis.innerWidth, globalThis.innerHeight);
		}

		// Storage key: the document's type is enough to share size across all sheets of that type
		// (e.g. "Actor.character", "Item.follower"). Null when there's no document to key on.
		static #keyFor(doc) {
			return doc?.documentName && doc?.type ? `${doc.documentName}.${doc.type}` : null;
		}

		#sizeKey() {
			return SheetSizeMemoryMixin.#keyFor(this.document);
		}

		_onPosition(position) {
			super._onPosition(position);
			const size = SheetSize.fromObject(position);
			if (size && this.#sizeKey()) this.#saveSize(size);
		}
	};
}
