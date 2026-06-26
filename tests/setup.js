import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

global.Application = class {};

// Load the real English table so localize()/format() return the strings players
// actually see — production code can call game.i18n directly without carrying
// duplicate English fallbacks just for the tests.
const _i18nTable = JSON.parse(fs.readFileSync(
	path.join(path.dirname(fileURLToPath(import.meta.url)), "../languages/en.json"), "utf8"));

// Resolve a dot-path key to its leaf string, mirroring Foundry's localize():
// a missing key (or a non-leaf path) returns the key unchanged.
function _localize(key) {
	const value = String(key).split(".").reduce((node, part) => node?.[part], _i18nTable);
	return typeof value === "string" ? value : key;
}

global.game = {
	i18n: {
		localize: _localize,
		// {placeholder} interpolation from `data`, like Foundry's format().
		format: (key, data = {}) => _localize(key).replace(/\{(\w+)\}/g, (m, name) => (name in data ? data[name] : m)),
	},
};

global.Hooks = {
	once: () => {},
	on: () => {},
};

global.CONFIG = {};

global.foundry = {
	// V13 sentinel that, when set as an update value, forces deletion of that key.
	data: { operators: { ForcedDeletion: Symbol.for("ForcedDeletion") } },
	utils: {
		mergeObject: (a, b) => ({ ...a, ...b }),
		deepClone: (value) => structuredClone(value),
		escapeHTML: (value) => String(value ?? "")
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
		// Deterministic, monotonic stand-in for Foundry's random doc id. Tests assert on the
		// surrounding slug shape (e.g. the "custom-possession-" prefix), not the id's randomness.
		randomID: (n = 16) => `id${String((global.foundry.utils.__rid = (global.foundry.utils.__rid ?? 0) + 1)).padStart(Math.max(1, n - 2), "0")}`,
		getProperty: (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj),
		flattenObject: (obj, prefix = "") => Object.entries(obj ?? {}).reduce((acc, [key, value]) => {
			const path = prefix ? `${prefix}.${key}` : key;
			if (value && typeof value === "object" && !Array.isArray(value)) {
				Object.assign(acc, global.foundry.utils.flattenObject(value, path));
			} else {
				acc[path] = value;
			}
			return acc;
		}, {}),
	},
};

Math.clamp = (value, min, max) => Math.min(Math.max(value, min), max);
