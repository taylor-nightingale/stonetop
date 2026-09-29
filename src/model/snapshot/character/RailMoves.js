/**
 * The special moves, each for the place the rail gives it (D9) — they are not a group, so they do not
 * land together. Death's Door hangs off hit points, unless the character holds a move made instead
 * of it (`replaces`), which an insert gained by dying brings.
 */
export class RailMoves {
	constructor({ atZeroHp = null, burnBrightly = null, endOfSession = null, advantage = null } = {}) {
		this.atZeroHp     = atZeroHp;
		this.burnBrightly = burnBrightly;
		this.endOfSession = endOfSession;
		this.advantage    = advantage;
	}

	static from(movelist) {
		const all = (movelist?.categories ?? []).flatMap(c => c.moves ?? []);
		const bySlug = slug => all.find(m => m.slug === slug) ?? null;
		const deathsDoor = bySlug("deaths-door");
		// Every move the sheet draws, not only the Moves tab's: an insert's are on its own tab (D12).
		const drawn = [...all, ...Object.values(movelist?.bySlug ?? {})];
		return new RailMoves({
			atZeroHp:     drawn.find(m => m.replaces === "deaths-door") ?? deathsDoor,
			burnBrightly: bySlug("burn-brightly"),
			endOfSession: bySlug("end-of-session"),
			advantage:    bySlug("advantage-disadvantage"),
		});
	}
}
