// Wires the choice-group editor markup (templates/item/partials/choice-group-editor.hbs) for an
// item sheet. Every editable group container carries `data-cg-path` (e.g. "system.choices.0" or
// "system.instinct"); each handler resolves that path, mutates the group via the pure helpers in
// choiceGroupEdit.js, and saves `item.update({ [path]: group })`. Shared by the item sheets with
// choice-group editors (insert, arcanum, possession, follower, improvement).
//
// Takes a native root element and binds directly to the current editor controls, so it must re-run
// after every render — which both sheet generations do naturally: V1 replaces the whole DOM,
// V2 replaces the part content (the bound elements themselves). Safe on either base.

import * as CG from "../utils/choiceGroupEdit.js";

export function activateChoiceGroupEditors(sheet, root) {
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

	const onClick = (sel, fn) => {
		for (const el of root.querySelectorAll(sel)) {
			el.addEventListener("click", () => {
				const path = pathOf(el);
				if (!path) return;
				return save(path, fn(group(path), el.dataset));
			});
		}
	};

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

	// Field changes (text/number/checkbox/select inputs AND the content.text <prose-mirror> editor,
	// which fires `change` on blur with its HTML in `.value`) → coerce, then whole-group atomic write.
	for (const el of root.querySelectorAll("[data-choices-field]")) el.addEventListener("change", () => {
		const path = pathOf(el);
		if (!path) return;
		let value;
		if      (el.type === "checkbox") value = el.checked;
		else if (el.type === "number")   value = el.value ? Number(el.value) : null;
		else if (el.dataset.choicesField === "followers.slugs")
			value = el.value ? el.value.split(",").map(s => s.trim()).filter(Boolean) : [];
		else value = el.value || null; // text inputs, selects, and <prose-mirror> (el.value = HTML)
		save(path, CG.setField(group(path), {
			target:      el.dataset.choicesTarget,
			rowIndex:    el.dataset.choicesRowIndex    !== undefined ? Number(el.dataset.choicesRowIndex)    : null,
			optionIndex: el.dataset.choicesOptionIndex !== undefined ? Number(el.dataset.choicesOptionIndex) : null,
			field:       el.dataset.choicesField,
			value,
		}));
	});
}
