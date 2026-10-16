/** The three roll modes, and the one place their order is decided — the roll dialog's buttons. */

export class RollModeOption {
	constructor(key, labelKey) {
		this.key = key;
		this.labelKey = labelKey;
	}
}

const MODES = [
	["adv",    "stonetop.rollMode.adv"],
	["normal", "stonetop.rollMode.normal"],
	["dis",    "stonetop.rollMode.dis"],
];

export class RollModes {
	static options() {
		return MODES.map(([key, labelKey]) => new RollModeOption(key, labelKey));
	}
}
