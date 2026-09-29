/**
 * One line of what ails a character: a marked debility, or a problematic wound.
 *
 * A debility is a readout here, named with its first sentence; it is marked on its bracket. A wound
 * carries its state where a move row carries its roll, and says nothing while it is simply active.
 */
export class AilmentRow {
	constructor(kind, name, note, woundId = null, state = null) {
		this.kind     = kind;
		this.name     = name;
		this.note     = note;
		this.woundId  = woundId;
		this.state    = state;
		this.stateKey = state && state !== "active" ? `stonetop.character.wounds.state.${state}` : null;
	}

	static debility(debility) {
		return new AilmentRow("debility", debility.name, debility.summary);
	}

	static wound(wound) {
		return new AilmentRow("wound", wound.name, "", wound.id, wound.state);
	}
}

/**
 * The band's Ailments panel (D7): the marked debilities, then the wounds. The first three always
 * show and the rest are a count on the bar, so the band never grows as a character gets hurt.
 */
export class AilmentList {
	static SHOWN = 3;

	constructor(rows) {
		this.shown     = rows.slice(0, AilmentList.SHOWN);
		this.moreCount = Math.max(0, rows.length - AilmentList.SHOWN);
		this.isEmpty   = rows.length === 0;
	}

	/**
	 * @param {DebilitySnapshot[]} debilities
	 * @param {Wound[]} wounds
	 */
	static from(debilities, wounds) {
		return new AilmentList([
			...debilities.filter(d => d.active).map(AilmentRow.debility),
			...wounds.filter(w => w.isNamed).map(AilmentRow.wound),
		]);
	}
}
