const percent = (value, of) => (of > 0 ? Math.round(Math.min(value / of, 1) * 100) : 0);

/**
 * Hit points as a bar. The current value changes many times a session; the maximum is granted by the
 * playbook and still set by hand. Zero is not the bottom of a range but a state with its own move.
 */
export class HpMeter {
	constructor(hp) {
		this.value   = hp.value;
		this.max     = hp.max;
		this.pct     = percent(hp.value, hp.max);
		this.isLow   = this.pct <= 25;
		this.isDying = hp.value <= 0;
	}
}

/**
 * Experience as a bar that does not stop at the cost of a level. Burn Brightly triggers on HAVING
 * enough to level, so what is past the threshold is a decision: the track rescales to the value and
 * the threshold becomes a mark on it. Below it, nothing changes and the bar ends at the threshold.
 */
export class XpTrack {
	constructor(xp) {
		this.value            = xp.value;
		this.max              = xp.max;
		this.scale            = Math.max(xp.value, xp.max) || 1;
		this.pct              = percent(xp.value, this.scale);
		this.thresholdPct     = percent(xp.max, this.scale);
		this.hasThresholdMark = this.thresholdPct < 100;
		this.surplus          = Math.max(0, xp.value - xp.max);
		this.isReady          = xp.isFull;
	}
}
