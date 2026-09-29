/**
 * How the character band's foot — the roll mode and the fold control — keeps to its column beside
 * the stats. It never goes under them. Short of room, the fold control drops its word and keeps its
 * caret (`is-foot-compact`); short of room even for that, the line wraps inside its own column
 * (`is-foot-wrapped`, which is compact too).
 *
 * Measured rather than a breakpoint: what the foot needs is its words, which translate, and what it
 * gets depends on whether the rail is a column. The breakpoints see to it that English never wraps.
 *
 * Asked only while the band is open: folded there is no stats column to be beside, and the answer
 * the open band last gave stands.
 */
export class BandFootFit {
	static FULL = "full";
	static COMPACT = "compact";
	static WRAPPED = "wrapped";

	static COMPACT_CLASS = "is-foot-compact";
	static WRAPPED_CLASS = "is-foot-wrapped";

	/**
	 * The rule itself. Half a pixel of slack.
	 *
	 * @param {number} full what the whole line needs
	 * @param {number} compact what it needs with the fold control's word dropped
	 * @param {number} room what the column beside the stats has
	 */
	static decide(full, compact, room) {
		if (full <= room + 0.5) return BandFootFit.FULL;
		if (compact <= room + 0.5) return BandFootFit.COMPACT;
		return BandFootFit.WRAPPED;
	}

	constructor(band) {
		this._band = band;
	}

	/** Put an answer on the band: an earlier one on a freshly rendered band, or one just decided. */
	apply(fit) {
		this._band.classList.toggle(BandFootFit.COMPACT_CLASS, fit !== BandFootFit.FULL);
		this._band.classList.toggle(BandFootFit.WRAPPED_CLASS, fit === BandFootFit.WRAPPED);
	}

	/**
	 * Measure and decide. Returns the answer, or null while the band is folded (nothing decided).
	 * Each line is measured with the band put in its state, inside one task, so nothing paints.
	 */
	fit() {
		if (this._band.closest(".sheet-wrapper")?.classList.contains("top-collapsed")) return null;
		const foot = this._band.querySelector(":scope > .stonetop-band-foot");
		if (!foot) return null;
		this.apply(BandFootFit.FULL);
		const full = this.#needs(foot);
		this.apply(BandFootFit.COMPACT);
		const compact = this.#needs(foot);
		const fit = BandFootFit.decide(full, compact, this.#room());
		this.apply(fit);
		return fit;
	}

	// What the foot's drawn controls ask for, and the gaps between them.
	#needs(foot) {
		const items = [...foot.children].filter(el => el.getBoundingClientRect().width > 0);
		const gap = parseFloat(this.#style(foot).columnGap) || 0;
		return items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + gap * Math.max(0, items.length - 1);
	}

	// The band's content width, less its first column and the gutter beside it. The first column is
	// as wide as the stats or the name above them, whichever is wider — measured off those two rather
	// than off the column's box, which the fold eases while it moves.
	#room() {
		const style = this.#style(this._band);
		const inner = this._band.getBoundingClientRect().width
			- (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
		const first = Math.max(...FIRST_COLUMN.map(sel => this._band.querySelector(sel)?.getBoundingClientRect().width ?? 0));
		return inner - first - (parseFloat(style.columnGap) || 0);
	}

	#style(el) {
		return (el.ownerDocument?.defaultView ?? globalThis).getComputedStyle(el);
	}
}

/**
 * One sheet's band foot, across renders: the answer the open band last gave, put back on every
 * freshly rendered band before it is painted (a folded band cannot be asked), and asked again
 * whenever the band changes size — a Foundry window resizes without re-rendering.
 *
 * On the sheet instance, like the rail's and the band's own state.
 */
export class BandFootWatch {
	#fit = BandFootFit.FULL;
	#observer = null;

	/** Before paint: the last answer, on the new band. */
	restore(root) {
		const band = bandIn(root);
		if (band) new BandFootFit(band).apply(this.#fit);
	}

	/** After render: ask now, and again on every resize of this band. */
	watch(root) {
		this.#observer?.disconnect();
		this.#observer = null;
		const band = bandIn(root);
		if (!band) return;
		const fit = new BandFootFit(band);
		const refit = () => {
			const answer = fit.fit();
			if (answer !== null) this.#fit = answer;
		};
		refit();
		const Observer = band.ownerDocument?.defaultView?.ResizeObserver;
		if (!Observer) return;
		this.#observer = new Observer(refit);
		this.#observer.observe(band);
	}
}

const BAND = ".stonetop-band";
const FIRST_COLUMN = [":scope > .sheet-top .stonetop-stats-column", ":scope > .stonetop-masthead .stonetop-masthead-id"];
const bandIn = root => (root?.matches?.(BAND) ? root : root?.querySelector?.(BAND)) ?? null;
