/**
 * Which of a sheet's tabs its strip shows whole, and which go into the strip's "More" menu.
 *
 * Tabs never shrink, overlap or wrap. As many as fit are shown, in order, and the rest are listed
 * under More at the strip's end — except the open tab, which always stays in the strip, the one
 * before it going instead, so the strip always says where the reader is. With room for all of them
 * there is no More.
 *
 * Measured rather than a breakpoint: the labels translate, an insert adds a tab, and the room depends
 * on whether the rail is a column.
 */
export class TabStripFit {
	static TAB  = ":scope > .item";
	static MORE = ":scope > .stonetop-tab-more";
	static ENTRY = ".stonetop-tab-more-item";

	/**
	 * The rule itself. Half a pixel of slack.
	 *
	 * @param {number[]} widths each tab's width, in order
	 * @param {number} room the strip's content width, less anything else it holds
	 * @param {number} more the More control's width
	 * @param {number} gap the strip's gap between items
	 * @param {number} active the open tab's index, or -1
	 * @returns {boolean[]} for each tab, whether it goes into the menu
	 */
	static decide(widths, room, more, gap, active) {
		const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
		if (total <= room + 0.5) return widths.map(() => false);
		const overflow = widths.map(() => true);
		let budget = room - more - gap;
		if (active >= 0) {
			overflow[active] = false;
			budget -= widths[active];
		}
		for (let i = 0; i < widths.length; i++) {
			if (i === active) continue;
			const need = widths[i] + gap;
			if (need > budget + 0.5) break;
			overflow[i] = false;
			budget -= need;
		}
		return overflow;
	}

	constructor(strip) {
		this._strip = strip;
	}

	/** Measure every tab at its own width, decide, and show and list them accordingly. */
	fit() {
		const tabs = [...this._strip.querySelectorAll(TabStripFit.TAB)];
		const more = this._strip.querySelector(TabStripFit.MORE);
		if (!tabs.length || !more) return;
		for (const tab of tabs) tab.hidden = false;
		more.hidden = false;
		const gap = parseFloat(this.#style(this._strip).columnGap) || 0;
		const overflow = TabStripFit.decide(
			tabs.map(width), this.#room(tabs, more, gap), width(more), gap,
			tabs.findIndex(tab => tab.classList.contains("active")));
		tabs.forEach((tab, i) => { tab.hidden = overflow[i]; });
		const entries = new Map([...more.querySelectorAll(TabStripFit.ENTRY)].map(entry => [entry.dataset.tab, entry]));
		tabs.forEach((tab, i) => {
			const entry = entries.get(tab.dataset.tab);
			if (entry) entry.hidden = !overflow[i];
		});
		more.hidden = !overflow.some(Boolean);
	}

	// The strip's content width, less whatever else it holds (the steading's ?) and the gap before it.
	#room(tabs, more, gap) {
		const style = this.#style(this._strip);
		const inner = width(this._strip) - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
		const others = [...this._strip.children].filter(el => !tabs.includes(el) && el !== more);
		return inner - others.reduce((sum, el) => sum + width(el) + gap, 0);
	}

	#style(el) {
		return (el.ownerDocument?.defaultView ?? globalThis).getComputedStyle(el);
	}
}

const width = el => el.getBoundingClientRect().width;

/**
 * One sheet's tab strip, across renders: fitted after every render, again whenever the strip changes
 * size — a Foundry window resizes without re-rendering — and again when the open tab changes, which
 * core does without a render either.
 */
export class TabStripWatch {
	#fit = null;
	#observer = null;

	/** After render: fit now, and again on every resize of this strip. */
	watch(root) {
		this.#observer?.disconnect();
		this.#observer = null;
		const strip = stripIn(root);
		this.#fit = strip ? new TabStripFit(strip) : null;
		if (!strip) return;
		this.#fit.fit();
		const Observer = strip.ownerDocument?.defaultView?.ResizeObserver;
		if (!Observer) return;
		this.#observer = new Observer(() => this.#fit?.fit());
		this.#observer.observe(strip);
	}

	/** The open tab changed. */
	refit() {
		this.#fit?.fit();
	}
}

const stripIn = root => [...(root?.querySelectorAll?.(".sheet-tabs") ?? [])]
	.find(strip => strip.querySelector(TabStripFit.MORE)) ?? null;
