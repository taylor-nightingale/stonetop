/**
 * The three roll modes, and the one place their order is decided.
 *
 * The character sheet's move side-bar and the stat-pick dialog render the same radio list from the
 * same partial, so the list itself has to come from one place too — otherwise the two drift the way
 * their markup already had.
 */

export class RollModeOption {
	constructor(key, labelKey, checked) {
		this.key = key;
		this.labelKey = labelKey;
		this.checked = checked;
	}
}

const MODES = [
	["adv",    "stonetop.rollMode.adv"],
	["normal", "stonetop.rollMode.normal"],
	["dis",    "stonetop.rollMode.dis"],
];

export class RollModes {
	/** The radio list for `roll-mode-picker.hbs`, with `selected` pre-ticked. */
	static options(selected = "normal") {
		return MODES.map(([key, labelKey]) => new RollModeOption(key, labelKey, key === selected));
	}
}
