const MIN_COL_WIDTH = 50;
const STORAGE_PREFIX = "stonetop.columnWidths.";

/**
 * Lets users drag-resize the columns of a `.steading-residents-table` (the
 * grid-based Players/Residents/Neighbors tables on the steading sheet), and
 * persists the chosen widths in localStorage so they survive re-renders.
 *
 * All resizable columns get a fixed pixel width except the last one, which
 * stays `minmax(0, 1fr)` and absorbs whatever space remains — mirroring how
 * spreadsheet/table UIs let you shrink one column to reveal more of another.
 * The trailing actions column is always fixed at 32px and never resizable.
 *
 * @param {HTMLElement} table       - the `.steading-residents-table` wrapper
 * @param {string}      storageKey  - unique key (e.g. "players", "neighbors")
 */
export function makeColumnsResizable(table, storageKey) {
	const header = table.querySelector(":scope > .steading-residents-header");
	const list = table.querySelector(":scope > .steading-residents-list");
	if (!header || !list) return;

	const headerCells = Array.from(header.children)
		.filter(cell => !cell.classList.contains("steading-residents-col-actions"));
	if (headerCells.length < 2) return;

	const storageId = `${STORAGE_PREFIX}${storageKey}`;
	let widths = null;
	try {
		const saved = JSON.parse(localStorage.getItem(storageId) ?? "null");
		if (Array.isArray(saved) && saved.length === headerCells.length && saved.every(Number.isFinite)) widths = saved;
	} catch (_err) { widths = null; }

	const applyTemplate = () => {
		if (!widths) return;
		const columns = widths.map((w, i) => i === widths.length - 1 ? "minmax(0, 1fr)" : `${Math.round(w)}px`);
		columns.push("32px");
		const template = columns.join(" ");
		header.style.gridTemplateColumns = template;
		list.querySelectorAll(":scope > .steading-residents-row").forEach(row => {
			row.style.gridTemplateColumns = template;
		});
	};

	const persist = () => {
		try { localStorage.setItem(storageId, JSON.stringify(widths)); } catch (_err) { /* ignore quota/availability errors */ }
	};

	// The table may be on a hidden tab when this runs, so rendered widths read
	// as 0 — only measure them lazily, at drag start, once it's actually visible.
	const ensureWidths = () => {
		if (widths) return;
		widths = headerCells.map(cell => cell.getBoundingClientRect().width);
	};

	applyTemplate();

	headerCells.slice(0, -1).forEach((cell, index) => {
		const handle = document.createElement("div");
		handle.className = "steading-col-resize-handle";
		cell.classList.add("steading-residents-col-resizable");
		cell.appendChild(handle);

		let startX = 0;
		let startWidth = 0;

		const onMove = ev => {
			widths[index] = Math.max(MIN_COL_WIDTH, startWidth + (ev.clientX - startX));
			applyTemplate();
		};
		const onUp = ev => {
			handle.releasePointerCapture(ev.pointerId);
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.classList.remove("is-dragging");
			persist();
		};

		handle.addEventListener("pointerdown", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			ensureWidths();
			applyTemplate();
			startX = ev.clientX;
			startWidth = widths[index];
			handle.setPointerCapture(ev.pointerId);
			handle.classList.add("is-dragging");
			handle.addEventListener("pointermove", onMove);
			handle.addEventListener("pointerup", onUp);
		});
	});
}
