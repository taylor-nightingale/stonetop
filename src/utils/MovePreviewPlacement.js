const EDGE = 8;
const BESIDE = 8;
const BELOW = 6;

/**
 * Where a move row's hover card goes, in window coordinates.
 *
 * Beside the row, on its right, when the row leaves a card's width spare — the row stays visible and
 * nothing it sits in is covered. Otherwise (a tab's row) under it at its own left edge, or above it when
 * there is no room below. Never on the left: a tab row's card sent there landed on top of the rail.
 */
export class MovePreviewPlacement {
	static place(row, card, viewport) {
		const fitsRight = row.right + BESIDE + card.width < viewport.width;
		const fitsBelow = row.bottom + BELOW + card.height < viewport.height;
		const [x, y] = fitsRight ? [row.right + BESIDE, row.top]
			: [row.left, fitsBelow ? row.bottom + BELOW : row.top - BELOW - card.height];
		const clamp = (v, max) => Math.round(Math.max(EDGE, Math.min(v, max - EDGE)));
		return { x: clamp(x, viewport.width - card.width), y: clamp(y, viewport.height - card.height) };
	}
}

/**
 * Shows a row's card as a pointer or the keyboard reaches the row, and puts it away as they leave.
 * Bound once on the sheet's root, which outlives its renders.
 *
 * The card is a popover, in the top layer. Merely `position: fixed`, it is placed against whatever
 * ancestor captures fixed positioning — core's dark theme blurs behind `.window-content`, which does —
 * and clipped by it: the card landed a window's offset away from its row and was cut off at the
 * window's edge.
 */
export class MovePreviews {
	static ROW  = ".stonetop-mrow";
	static CARD = ".stonetop-move-preview";
	static ROLL = ".stonetop-mrow-roll";

	/** `viewport` answers the window's size. */
	constructor({ viewport }) {
		this._viewport = viewport;
	}

	/** Cards on a sheet's root, placed within the window that root is in. */
	static attachTo(root) {
		const view = root.ownerDocument?.defaultView ?? globalThis;
		new MovePreviews({ viewport: () => ({ width: view.innerWidth, height: view.innerHeight }) }).attach(root);
	}

	attach(root) {
		const rowOf = el => {
			const row = el?.closest?.(MovePreviews.ROW);
			return row && root.contains(row) ? row : null;
		};
		root.addEventListener("pointerover", ev => {
			const row = rowOf(ev.target);
			if (row) this.show(row);
		});
		root.addEventListener("pointerout", ev => {
			const row = rowOf(ev.target);
			if (row && !row.contains(ev.relatedTarget)) this.hide(row);
		});
		// The keyboard route is the roll button taking visible focus, which a mouse click does not give it.
		root.addEventListener("focusin", ev => {
			const row = rowOf(ev.target);
			if (row && ev.target.matches(`${MovePreviews.ROLL}:focus-visible`)) this.show(row);
		});
		root.addEventListener("focusout", ev => {
			const row = rowOf(ev.target);
			if (row && !row.contains(ev.relatedTarget)) this.hide(row);
		});
		// A click rolls the move or opens its text, and an open text is the same move said twice.
		root.addEventListener("click", ev => {
			const row = rowOf(ev.target);
			if (row) this.hide(row);
		});
		root.addEventListener("keydown", ev => {
			const row = ev.key === "Escape" ? rowOf(ev.target) : null;
			if (row) this.hide(row);
		});
	}

	show(row) {
		const card = row.querySelector(`:scope > ${MovePreviews.CARD}`);
		if (!card || row.classList.contains("is-open")) return;
		card.showPopover();
		const viewport = this._viewport();
		const box = card.getBoundingClientRect();
		const { x, y } = MovePreviewPlacement.place(row.getBoundingClientRect(), { width: box.width, height: box.height }, viewport);
		card.style.setProperty("--move-preview-x", `${x}px`);
		card.style.setProperty("--move-preview-y", `${y}px`);
	}

	hide(row) {
		row.querySelector(`:scope > ${MovePreviews.CARD}`)?.hidePopover();
	}
}
