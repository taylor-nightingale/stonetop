import { RememberedSize } from "./RememberedSize.js";
import { getSetting, setSetting } from "../settings.js";

/**
 * Persists the last window size of each sheet, keyed (per sheet type, e.g. "Actor.character"). Backed
 * by a client-scoped setting holding a `{ key -> {width, height, rootFontSizePx} }` map. The backing is injected so
 * the store can be unit-tested without a live `game.settings`.
 */
export class SheetSizeMemory {
	#read;
	#write;

	/** @param backing `{ read(): object, write(map): void }` — defaults to the `sheetSizes` client setting. */
	constructor(backing = SheetSizeMemory.#settingBacking()) {
		this.#read = backing.read;
		this.#write = backing.write;
	}

	/** The remembered size for a key, or null when nothing valid is stored. */
	get(key) {
		const map = this.#read() ?? {};
		return RememberedSize.fromObject(map[key]);
	}

	/** Remember `remembered` (a RememberedSize) for `key`, leaving other keys untouched. */
	set(key, remembered) {
		const map = { ...(this.#read() ?? {}) };
		map[key] = remembered.toObject();
		this.#write(map);
	}

	static #settingBacking() {
		return {
			read: () => getSetting("sheetSizes"),
			write: (map) => setSetting("sheetSizes", map),
		};
	}
}

/** The production singleton the sheet mixin uses by default. */
export const sheetSizeMemory = new SheetSizeMemory();
