// Thin wrappers over Foundry's i18n that degrade to the key when the table isn't
// available, so callers never have to guard `game.i18n` themselves. The unit
// tests load the real English table (tests/setup.js), so localized strings are
// exercised the way players see them — no English fallbacks duplicated in code.

/**
 * Localize a key. Returns the key unchanged when no translation is available.
 * @param {string} key
 * @returns {string}
 */
export function localize(key) {
	return globalThis.game?.i18n?.localize?.(key) ?? key;
}

/**
 * Localize a key with `{placeholder}` interpolation from `data`.
 * @param {string} key
 * @param {object} data
 * @returns {string}
 */
export function format(key, data) {
	return globalThis.game?.i18n?.format?.(key, data) ?? key;
}
