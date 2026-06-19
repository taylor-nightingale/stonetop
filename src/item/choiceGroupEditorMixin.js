// Wires the choice-group editor markup (templates/item/partials/choice-group-editor.hbs) for an
// item sheet. Every editable group container carries `data-cg-path` (e.g. "system.choices.0" or
// "system.instinct"); each handler resolves that path, mutates the group via the pure helpers in
// choiceGroupEdit.js, and saves `item.update({ [path]: group })`. Shared by the move + insert sheets.

import * as CG from "../utils/choiceGroupEdit.js";

export function activateChoiceGroupEditors(sheet, html) {
	const pathOf = el => el.closest("[data-cg-path]")?.dataset.cgPath ?? null;
	const group  = path => foundry.utils.getProperty(sheet.item, path) ?? CG.newGroup();
	// Foundry ArrayFields are atomic — a dotted `system.choices.0` update won't set one element.
	// For an indexed path, rewrite the whole parent array; otherwise update the field directly.
	const save = (path, g) => {
		const m = path.match(/^(.*)\.(\d+)$/);
		if (m) {
			const arr = foundry.utils.deepClone(foundry.utils.getProperty(sheet.item, m[1]) ?? []);
			arr[Number(m[2])] = g;
			return sheet.item.update({ [m[1]]: arr });
		}
		return sheet.item.update({ [path]: g });
	};

	const onClick = (sel, fn) => html.find(sel).on("click", ev => {
		const path = pathOf(ev.currentTarget);
		if (!path) return;
		return save(path, fn(group(path), ev.currentTarget.dataset));
	});

	const ri  = d => Number(d.rowIndex);
	const oiOf = d => (d.optionIndex != null ? Number(d.optionIndex) : null);

	onClick(".choices-add-row",          (g, d) => CG.addRow(g, d.type));
	onClick(".choices-row-delete",       (g, d) => CG.removeRow(g, ri(d)));
	onClick(".choices-row-up",           (g, d) => CG.moveRow(g, ri(d), -1));
	onClick(".choices-row-down",         (g, d) => CG.moveRow(g, ri(d), 1));
	onClick(".choices-row-toggle-track", (g, d) => CG.toggleTrack(g, ri(d)));
	onClick(".choices-row-toggle-input", (g, d) => CG.toggleInput(g, ri(d)));
	onClick(".choices-add-option",       (g, d) => CG.addOption(g, ri(d)));
	onClick(".choices-option-delete",    (g, d) => CG.removeOption(g, ri(d), Number(d.optionIndex)));
	onClick(".choices-add-outfit-item",  (g, d) => CG.addOutfitItem(g, ri(d), oiOf(d)));
	onClick(".choices-outfit-item-delete", (g, d) => CG.removeOutfitItem(g, ri(d), Number(d.outfitItemIndex), oiOf(d)));

	html.find("[data-choices-field]").on("change", ev => {
		const el   = ev.currentTarget;
		const path = pathOf(el);
		if (!path) return;
		let value;
		if      (el.type === "checkbox") value = el.checked;
		else if (el.type === "number")   value = el.value ? Number(el.value) : null;
		else if (el.dataset.choicesField === "followers")
			value = el.value ? el.value.split(",").map(s => s.trim()).filter(Boolean) : [];
		else value = el.value || null;
		save(path, CG.setField(group(path), {
			target:      el.dataset.choicesTarget,
			rowIndex:    el.dataset.choicesRowIndex    !== undefined ? Number(el.dataset.choicesRowIndex)    : null,
			optionIndex: el.dataset.choicesOptionIndex !== undefined ? Number(el.dataset.choicesOptionIndex) : null,
			field:       el.dataset.choicesField,
			value,
		}));
	});
}
