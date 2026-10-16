/**
 * The wound editor's view state: whether this sheet's reader has it open, and where the focus goes
 * when it next draws.
 *
 * On the sheet instance, like the rail's and the band's: every save re-renders the sheet, and the
 * editor has to come back open with the reader still in it. Opening it is not an actor write, so
 * nobody else's sheet opens with it.
 *
 * The editor is ONE panel reached three ways — the + on the Ailments bar, the count of the rows past
 * the third, or a wound's own row — because the panel shows three rows and may be hiding the one
 * you want. It shuts on Escape and on a click elsewhere on the sheet. A click, not a pointerdown:
 * a name being typed is saved on `change`, which fires as its field loses focus, and a pointerdown
 * would re-render the editor away before that.
 */
import { revealInScroller } from "../../utils/revealInScroller.js";

export class AilmentEditor {
	static EDITOR = ".stonetop-ailment-editor";
	static OPENER = '[data-action="openAilments"]';
	static NAME   = ".stonetop-ailment-edit-name";
	static ADD    = ".stonetop-ailment-add";

	#open   = false;
	#focus  = null;   // a wound id, NEWEST, FIRST, or null once applied
	#reveal = false;

	static #NEWEST = Symbol("newest");
	static #FIRST  = Symbol("first");

	get isOpen() {
		return this.#open;
	}

	/** Open, with the focus to land on `woundId`'s name, or on the first control. */
	open(woundId = null) {
		this.#open   = true;
		this.#focus  = woundId ?? AilmentEditor.#FIRST;
		this.#reveal = true;
	}

	/** Bring the editor into view the first time it draws after opening; never on later renders. */
	applyReveal(root, reveal = revealInScroller) {
		if (!this.#open || !this.#reveal) return;
		const editor = root.querySelector(AilmentEditor.EDITOR);
		if (!editor) return;
		this.#reveal = false;
		reveal(editor);
	}

	close() {
		this.#open  = false;
		this.#focus = null;
	}

	/** A wound is being added: when it draws, its name is the next thing to type. */
	focusNewest() {
		this.#focus = AilmentEditor.#NEWEST;
	}

	/** Put the focus where the last open or add asked for it, once. */
	applyFocus(root) {
		if (!this.#open || this.#focus === null) return;
		const editor = root.querySelector(AilmentEditor.EDITOR);
		if (!editor) return;
		const target = this.#targetIn(editor);
		this.#focus = null;
		target?.focus({ preventScroll: true });
	}

	#targetIn(editor) {
		const names = [...editor.querySelectorAll(AilmentEditor.NAME)];
		if (this.#focus === AilmentEditor.#NEWEST) return names.at(-1);
		if (this.#focus === AilmentEditor.#FIRST) return names[0] ?? editor.querySelector(AilmentEditor.ADD);
		return names.find(input => input.dataset.woundId === this.#focus) ?? names[0];
	}

	/** Shut on Escape inside the editor, or a click elsewhere on `root`. Bound once, on first render. */
	attach(root, onClose) {
		root.addEventListener("keydown", event => {
			if (!this.#open || event.key !== "Escape" || !event.target.closest?.(AilmentEditor.EDITOR)) return;
			event.stopPropagation();
			onClose();
		});
		root.addEventListener("click", event => {
			if (!this.#open) return;
			if (event.target.closest?.(AilmentEditor.EDITOR) || event.target.closest?.(AilmentEditor.OPENER)) return;
			onClose();
		});
	}
}
