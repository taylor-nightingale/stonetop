const EDGE = 8;
const BESIDE = 8;
const BELOW = 6;

/**
 * Where a move row's hover card goes. The lists it sits in scroll, so a card placed inside one is
 * clipped by it; the card is `position: fixed` and this says where.
 *
 * Beside the row when the row leaves a card's width spare — the row stays visible and nothing it sits
 * in is covered. A row too wide for either side (a tab's) gets the card under it at its own left edge,
 * or above it when there is no room below: sent left, a tab row's card landed on top of the rail.
 */
export class MovePreviewPlacement {
	static place(row, card, viewport) {
		const fitsRight = row.right + BESIDE + card.width < viewport.width;
		const fitsLeft  = row.left - BESIDE - card.width > 0;
		const fitsBelow = row.bottom + BELOW + card.height < viewport.height;
		const [x, y] = fitsRight ? [row.right + BESIDE, row.top]
			: fitsLeft ? [row.left - BESIDE - card.width, row.top]
			: [row.left, fitsBelow ? row.bottom + BELOW : row.top - BELOW - card.height];
		const clamp = (v, max) => Math.round(Math.max(EDGE, Math.min(v, max - EDGE)));
		return { x: clamp(x, viewport.width - card.width), y: clamp(y, viewport.height - card.height) };
	}
}

/**
 * Places each row's card as a pointer or the keyboard reaches the row, and lets Escape put a
 * keyboard-shown card away. Bound once on the sheet's root, which outlives its renders.
 */
export class MovePreviews {
	static ROW  = ".stonetop-mrow";
	static CARD = ".stonetop-move-preview";

	/** `width` answers the card's CSS width in px (it is in rem, so it follows the font size);
	 *  `viewport` answers the window's size. */
	constructor({ width, viewport }) {
		this._width    = width;
		this._viewport = viewport;
	}

	attach(root) {
		const place = ev => {
			const row = ev.target.closest?.(MovePreviews.ROW);
			if (row && root.contains(row)) this._place(row);
		};
		root.addEventListener("pointerover", place);
		root.addEventListener("focusin", place);
		root.addEventListener("keydown", ev => {
			if (ev.key !== "Escape") return;
			const focused = ev.target.closest?.(MovePreviews.ROW) ? ev.target : null;
			focused?.blur();
		});
	}

	_place(row) {
		const card = row.querySelector(MovePreviews.CARD);
		if (!card) return;
		const viewport = this._viewport();
		const size = { width: this._width(), height: Math.min(card.scrollHeight || 260, 0.6 * viewport.height) };
		const { x, y } = MovePreviewPlacement.place(row.getBoundingClientRect(), size, viewport);
		card.style.setProperty("--move-preview-x", `${x}px`);
		card.style.setProperty("--move-preview-y", `${y}px`);
	}
}
