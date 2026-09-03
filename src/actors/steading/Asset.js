/**
 * One thing the steading owns in common — a wagon, a pair of draft horses — and whether it is at home
 * or out.
 *
 * The Assets panel says it outright: to take an asset on an expedition or otherwise put it at risk,
 * you must Requisition. So an asset has a state, and leaving town is exactly what puts it in question.
 * Deliberately NOT modelled: which character has it. That is what the party's own sheets and the
 * fiction are for; a pointer from the steading to a character is bookkeeping nobody maintains.
 */
export class Asset {
	constructor(text = "", requisitioned = false) {
		this.text = text;
		this.requisitioned = requisitioned;
	}

	withText(text)                   { return new Asset(text, this.requisitioned); }
	withRequisitioned(requisitioned) { return new Asset(this.text, requisitioned); }

	static blank() {
		return new Asset();
	}

	static fromRaw(raw) {
		return new Asset(raw?.text ?? "", raw?.requisitioned === true);
	}
}
