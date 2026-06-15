// Dropdown for Selection fields (instinct, cost, tags, member tags/traits). You can TYPE a
// custom value in the input, and the list shows the FULL option set — it is NEVER filtered by
// what's typed (that is the whole point; a native <datalist> filters, which we don't want).
//
// The open list is portaled to <body> and positioned `fixed` at the input. This is the only way
// it can truly overlay: each follower-card child is its own stacking context (`.card > * {
// z-index: 1 }`) and the followers panel is a scroll container (`overflow-y: auto`), so an
// in-place dropdown is both painted under later cards and clipped by the scroll overflow.
//
// Saving is delegated: picking an option (or pressing Enter) sets the input value and fires the
// input's `change`, so the field's own listener persists it (single-select replaces; the tag
// adder toggles/adds). This util only manages open/close + positioning.
//
// Listeners are installed once on `document`/`window` (not per render): the list portals out of
// the sheet root, so root-scoped delegation can't see it, and re-installing each render would
// leak handlers. Everything is delegated by class, so it works for any current/future sheet.

let installed = false;

export function activateComboBoxes() {
	if (installed) return;
	installed = true;

	// The single open dropdown: { list, input, parent, next } — parent/next restore it on close.
	let open = null;

	const comboInput = el => el?.closest?.(".stonetop-combo-input");

	function position() {
		if (!open) return;
		const r = open.input.getBoundingClientRect();
		const { style } = open.list;
		style.left = `${r.left}px`;
		style.top = `${r.bottom + 2}px`;
		style.minWidth = `${r.width}px`;
	}

	function close() {
		if (!open) return;
		const { list, parent, next } = open;
		list.hidden = true;
		list.style.left = list.style.top = list.style.minWidth = "";
		if (parent.isConnected) parent.insertBefore(list, next); // back to its spot in the card
		else list.remove();                                       // sheet re-rendered: drop the orphan
		open = null;
	}

	function openFor(input) {
		if (open?.input === input) return;
		close();
		const list = input.closest(".stonetop-combo")?.querySelector(".stonetop-combo-list");
		if (!list) return;
		open = { list, input, parent: list.parentNode, next: list.nextSibling };
		document.body.appendChild(list);
		list.hidden = false;
		position();
	}

	// Open when an input gains focus (so the list shows as you start typing).
	document.addEventListener("focusin", ev => {
		const input = comboInput(ev.target);
		if (input) openFor(input);
	});

	// ▾ toggles; an option fills the input and saves. mousedown on either keeps input focus.
	document.addEventListener("mousedown", ev => {
		if (ev.target.closest(".stonetop-combo-toggle") || ev.target.closest(".stonetop-combo-option")) {
			ev.preventDefault();
			return;
		}
		// Outside click closes (the list is on <body>, so check both the combo and the list).
		if (open && !ev.target.closest(".stonetop-combo") && !ev.target.closest(".stonetop-combo-list")) close();
	}, true);

	document.addEventListener("click", ev => {
		const toggle = ev.target.closest(".stonetop-combo-toggle");
		if (toggle) {
			const input = toggle.closest(".stonetop-combo")?.querySelector(".stonetop-combo-input");
			if (open?.input === input) close();
			else { input?.focus(); openFor(input); }
			return;
		}
		const option = ev.target.closest(".stonetop-combo-option");
		if (option && open) {
			const input = open.input;
			input.value = option.dataset.value ?? option.textContent.trim();
			close();
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}
	});

	document.addEventListener("keydown", ev => {
		const input = comboInput(ev.target);
		if (!input) return;
		if (ev.key === "Enter") {
			ev.preventDefault();
			input.dispatchEvent(new Event("change", { bubbles: true }));
			close();
		} else if (ev.key === "Escape") {
			close();
		}
	});

	// The list is fixed to the viewport, so scrolling/resizing would detach it — just close.
	window.addEventListener("scroll", () => close(), true);
	window.addEventListener("resize", () => close());
}
