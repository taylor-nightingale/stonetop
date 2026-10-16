// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AilmentEditor } from "../../../src/actors/character/AilmentEditor.js";

// Whether this sheet's reader has the wound editor open, and where the focus goes when it draws.
// Sheet-instance state: every save re-renders the sheet, and the editor has to survive that.

const markup = (...ids) => `
<div class="stonetop-ailments"><button type="button" data-action="openAilments">+</button></div>
<div class="stonetop-ailment-editor">
	<ul>${ids.map(id => `<li data-wound-id="${id}"><input class="stonetop-ailment-edit-name" data-wound-id="${id}"></li>`).join("")}</ul>
	<button type="button" class="stonetop-ailment-add">add</button>
	<p class="stonetop-ailment-editor-note">note</p>
</div>
<div class="stonetop-elsewhere">tab</div>`;

const mount = (...ids) => {
	document.body.innerHTML = `<form id="root">${markup(...ids)}</form>`;
	return document.getElementById("root");
};
const nameOf = (root, id) => root.querySelector(`[data-wound-id="${id}"] .stonetop-ailment-edit-name`);

beforeEach(() => { document.body.innerHTML = ""; });

describe("AilmentEditor", () => {
	// It hangs where it was opened; at the foot of a long tab that can be below what the window shows.
	it("brings itself into view once, when it opens — never on the re-renders after", () => {
		const editor = new AilmentEditor();
		const reveal = vi.fn();
		editor.open();
		const root = mount("w1");
		editor.applyReveal(root, reveal);
		editor.applyReveal(root, reveal);
		expect(reveal).toHaveBeenCalledOnce();
		expect(reveal.mock.calls[0][0]).toBe(root.querySelector(".stonetop-ailment-editor"));
	});

	it("starts shut, opens and shuts", () => {
		const editor = new AilmentEditor();
		expect(editor.isOpen).toBe(false);
		editor.open();
		expect(editor.isOpen).toBe(true);
		editor.close();
		expect(editor.isOpen).toBe(false);
	});

	it("puts the focus on the wound it was opened on, once", () => {
		const editor = new AilmentEditor();
		editor.open("w2");
		const root = mount("w1", "w2");
		editor.applyFocus(root);
		expect(document.activeElement).toBe(nameOf(root, "w2"));
		root.querySelector(".stonetop-ailment-add").focus();
		editor.applyFocus(root);
		expect(document.activeElement).toBe(root.querySelector(".stonetop-ailment-add"));
	});

	it("puts the focus on the first control when opened on nothing in particular", () => {
		const editor = new AilmentEditor();
		editor.open();
		const root = mount("w1");
		editor.applyFocus(root);
		expect(document.activeElement).toBe(nameOf(root, "w1"));
	});

	it("puts the focus on the add button when there is nothing to name yet", () => {
		const editor = new AilmentEditor();
		editor.open();
		const root = mount();
		editor.applyFocus(root);
		expect(document.activeElement).toBe(root.querySelector(".stonetop-ailment-add"));
	});

	it("puts the focus on the newest wound after one is added", () => {
		const editor = new AilmentEditor();
		editor.open();
		editor.focusNewest();
		const root = mount("w1", "w2");
		editor.applyFocus(root);
		expect(document.activeElement).toBe(nameOf(root, "w2"));
	});

	it("moves no focus while shut", () => {
		const editor = new AilmentEditor();
		const root = mount("w1");
		editor.applyFocus(root);
		expect(document.activeElement).toBe(document.body);
	});

	describe("dismissal", () => {
		const attached = () => {
			const editor = new AilmentEditor();
			const onClose = vi.fn();
			const root = mount("w1");
			editor.attach(root, onClose);
			editor.open();
			return { editor, onClose, root };
		};

		it("asks to close on Escape inside the editor", () => {
			const { onClose, root } = attached();
			nameOf(root, "w1").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("asks to close on a click elsewhere on the sheet", () => {
			const { onClose, root } = attached();
			root.querySelector(".stonetop-elsewhere").click();
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("does not close for a click inside it, or on what opens it", () => {
			const { onClose, root } = attached();
			root.querySelector(".stonetop-ailment-editor-note").click();
			root.querySelector('[data-action="openAilments"]').click();
			expect(onClose).not.toHaveBeenCalled();
		});

		it("does nothing while shut", () => {
			const { editor, onClose, root } = attached();
			editor.close();
			root.querySelector(".stonetop-elsewhere").click();
			nameOf(root, "w1").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			expect(onClose).not.toHaveBeenCalled();
		});
	});
});
