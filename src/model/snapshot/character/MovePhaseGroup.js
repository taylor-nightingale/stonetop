/** The order a journey runs in (Book I), which is the order the rail draws the expedition moves. */
const PHASES = ["setting-out", "on-the-road", "getting-home"];

/**
 * One part of an expedition and the moves for it. `key` is null for the moves no phase names, which
 * come after the phases under no heading rather than being left off.
 */
export class MovePhaseGroup {
	constructor(key, moves) {
		this.key      = key;
		this.labelKey = key ? `stonetop.character.moves.phase.${key}` : null;
		this.moves    = moves;
	}

	static fromMoves(moves) {
		const phased = PHASES
			.map(key => new MovePhaseGroup(key, moves.filter(m => m.phase === key)))
			.filter(g => g.moves.length);
		const rest = moves.filter(m => !PHASES.includes(m.phase));
		return rest.length ? [...phased, new MovePhaseGroup(null, rest)] : phased;
	}
}
