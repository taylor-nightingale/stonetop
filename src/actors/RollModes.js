/**
 * The three roll modes, and the one place their order is decided.
 *
 * The character sheet's move side-bar and the stat-pick dialog render the same radio list from the
 * same partial, so the list itself has to come from one place too — otherwise the two drift the way
 * their markup already had.
 */

export class RollModeOption {
	constructor(key, labelKey, shortKey, checked) {
		this.key = key;
		this.labelKey = labelKey;
		// The inline line's short word ("Adv"), drawn where the full word does not fit; null where the
		// word is short already. The full label is still what a screen reader hears.
		this.shortKey = shortKey;
		this.checked = checked;
	}
}

const MODES = [
	["adv",    "stonetop.rollMode.adv",    "stonetop.rollMode.short.adv"],
	["normal", "stonetop.rollMode.normal", null],
	["dis",    "stonetop.rollMode.dis",    "stonetop.rollMode.short.dis"],
];

export class RollModes {
	/** The radio list for `roll-mode-picker.hbs`, with `selected` pre-ticked. */
	static options(selected = "normal") {
		return MODES.map(([key, labelKey, shortKey]) => new RollModeOption(key, labelKey, shortKey, key === selected));
	}
}
