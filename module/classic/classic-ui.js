// UI-affordance helpers for the ported "Classic" sheets, vendored VERBATIM from Taylor Nightingale's
// src/utils/{editToggle,stepper,comboBox}.js (dependency-free, pure DOM). His base sheet wired all
// three in activateListeners; the fork's Classic sheets call them the same way. Kept separate from
// classic-support.js (markdown/helpers/partials) so the data layer and the UI layer stay distinct.
//
//   - activateEditToggles(root): the .stonetop-edit-toggle pencil swaps a .stonetop-editable's
//       enriched display for its raw-markdown edit field (follower armor/damage/instinct/cost/moves/
//       notes ride this — they are HIDDEN until the pencil, so this is REQUIRED for editing them).
//   - activateSteppers(root): wraps any input.stonetop-step with hover-revealed ▲▼ buttons (vitals,
//       follower/member HP); the input still works without it (this is a convenience layer).
//   - activateComboBoxes(): unfiltered dropdown for Selection fields. Installs ONCE on document; the
//       open list is portaled to <body> (so its CSS lives OUTSIDE @scope in classic.css — see the
//       global .stonetop-combo-list block there). The combo-input still works as plain text without it.

// ── Edit toggle ────────────────────────────────────────────────────────────────────────────────
export function activateEditToggles(root) {
	root.addEventListener("click", ev => {
		const btn = ev.target.closest(".stonetop-edit-toggle");
		if (!btn) return;
		ev.preventDefault();
		ev.stopPropagation();
		const wrap = btn.closest(".stonetop-editable");
		if (!wrap) return;
		const editing = wrap.classList.toggle("is-editing");
		const field = wrap.querySelector(".stonetop-editable__edit");
		if (editing && field) {
			field.focus();
			field.select?.();
		}
	}, true);

	// Leave edit mode when the field loses focus (its change handler has already saved).
	// If focus is moving to this field's own pencil, let the click handler toggle instead —
	// otherwise the two fight and clicking the pencil to close just re-opens it.
	root.addEventListener("focusout", ev => {
		const field = ev.target.closest?.(".stonetop-editable__edit");
		if (!field) return;
		const wrap = field.closest(".stonetop-editable");
		if (wrap?.contains(ev.relatedTarget)) return;
		wrap?.classList.remove("is-editing");
	}, true);
}

// ── Steppers ───────────────────────────────────────────────────────────────────────────────────
export function activateSteppers(root) {
	if (!root) return;
	for (const input of root.querySelectorAll("input.stonetop-step")) {
		if (input.parentElement?.classList.contains("stonetop-stepper")) continue; // already wrapped

		const wrap = document.createElement("span");
		wrap.className = "stonetop-stepper";
		input.replaceWith(wrap);
		wrap.appendChild(input);

		wrap.appendChild(_stepButton(input, +1, "▲", "up"));
		wrap.appendChild(_stepButton(input, -1, "▼", "down"));
	}
}

function _stepButton(input, dir, glyph, kind) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.tabIndex = -1;
	btn.className = `stonetop-stepper-btn stonetop-stepper-btn--${kind}`;
	btn.textContent = glyph;
	btn.addEventListener("click", ev => {
		ev.preventDefault();
		ev.stopPropagation();
		const stepBy = Number(input.step) || 1;
		const hasMin = input.min !== "";
		const hasMax = input.max !== "";
		let next = (Number(input.value) || 0) + dir * stepBy;
		if (hasMin) next = Math.max(next, Number(input.min));
		if (hasMax) next = Math.min(next, Number(input.max));
		input.value = String(next);
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
	return btn;
}

// ── Combo boxes ──────────────────────────────────────────────────────────────────────────────────
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

	function commit(input, value) {
		input.value = value;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}

	// -- Fill-in-the-blank (Mad-Libs) for options containing `__` -----------------------
	let fill = null; // { combo, input, toggle, editor, parts, blanks: [inputs] }

	function cancelFill() {
		if (!fill) return;
		fill.editor.remove();
		fill.input.hidden = false;
		if (fill.toggle) fill.toggle.hidden = false;
		fill.combo.classList.remove("is-filling");
		fill = null;
	}

	function confirmFill() {
		if (!fill) return;
		const assembled = fill.parts
			.map((p, i) => p + (i < fill.blanks.length ? fill.blanks[i].value.trim() : ""))
			.join("");
		const input = fill.input;
		cancelFill();
		commit(input, assembled);
	}

	function startFill(combo, input, value) {
		cancelFill();
		const toggle = combo.querySelector(".stonetop-combo-toggle");
		const parts = value.split("__");
		const editor = document.createElement("span");
		editor.className = "stonetop-fill";
		const blanks = [];
		parts.forEach((p, i) => {
			if (p) editor.appendChild(document.createTextNode(p));
			if (i < parts.length - 1) {
				const b = document.createElement("input");
				b.type = "text";
				b.size = 6;                       // small intrinsic width; CSS lets it flex/wrap
				b.className = "stonetop-fill-blank";
				editor.appendChild(b);
				blanks.push(b);
			}
		});
		const mkBtn = (cls, label) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = cls;
			btn.textContent = label;
			return btn;
		};
		editor.appendChild(mkBtn("stonetop-fill-confirm", "✓"));
		editor.appendChild(mkBtn("stonetop-fill-cancel", "✕"));

		input.hidden = true;
		if (toggle) toggle.hidden = true;
		combo.classList.add("is-filling"); // take a full-width line so the row can't overflow
		combo.appendChild(editor);
		fill = { combo, input, toggle, editor, parts, blanks };
		blanks[0]?.focus();
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
		// Outside click closes the list (on <body>, so check the combo + the list) and any fill row.
		const inCombo = ev.target.closest(".stonetop-combo");
		const inList  = ev.target.closest(".stonetop-combo-list");
		if (open && !inCombo && !inList) close();
		if (fill && ev.target.closest(".stonetop-combo") !== fill.combo) cancelFill();
	}, true);

	document.addEventListener("click", ev => {
		if (ev.target.closest(".stonetop-fill-confirm")) { confirmFill(); return; }
		if (ev.target.closest(".stonetop-fill-cancel"))  { cancelFill();  return; }
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
			const value = option.dataset.value ?? option.textContent.trim();
			const combo = input.closest(".stonetop-combo");
			close();
			if (value.includes("__")) {
				startFill(combo, input, value);       // fill the blank(s) first (keeps focus)
			} else {
				commit(input, value);
				input.blur();                          // selecting defocuses + dismisses the dropdown
			}
			return;
		}
		// Clicking the input itself (re)opens its dropdown, even if it's already focused.
		const clickedInput = ev.target.closest(".stonetop-combo-input");
		if (clickedInput) openFor(clickedInput);
	});

	document.addEventListener("keydown", ev => {
		const blank = ev.target.closest?.(".stonetop-fill-blank");
		if (blank) {
			if (ev.key === "Enter") { ev.preventDefault(); confirmFill(); }
			else if (ev.key === "Escape") cancelFill();
			return;
		}
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

	// The list is fixed to the viewport, so scrolling the PAGE would detach it — close. But ignore
	// scrolling INSIDE the list itself (its own overflow), or the list couldn't be scrolled.
	window.addEventListener("scroll", ev => {
		if (open && (ev.target === open.list || open.list?.contains?.(ev.target))) return;
		close();
	}, true);
	window.addEventListener("resize", () => close());
}
