import { revealInScroller } from "../utils/revealInScroller.js";

/**
 * The improvement sheet's one open editor: a section heading's, a saved result's, or the adder for a
 * new result — and that result as drafted so far.
 *
 * On the sheet instance, like the wound editor's (AilmentEditor) and the outfit adder's: every save
 * re-renders the sheet, and the editor has to come back open with the reader still in it. Editing a
 * heading or a result writes as it goes, as the wound editor does; the adder writes nothing until Add,
 * as the outfit adder does. Either shuts on Escape inside it and on a click elsewhere on the sheet.
 */
export class ImprovementEditing {
	static PANEL  = ".stonetop-improvement-panel";
	static OPENER = "[data-improvement-opener]";

	#part   = null;   // { kind: "heading", lead } | { kind: "result", index } | { kind: "adder", half }
	#draft  = null;
	#reveal = false;

	get draft() { return this.#draft; }

	openHeading(lead)        { this.#open({ kind: "heading", lead }, null); }
	openResult(index)        { this.#open({ kind: "result", index }, null); }
	openAdder(half, draft)   { this.#open({ kind: "adder", half }, draft); }

	#open(part, draft) {
		this.#part   = part;
		this.#draft  = draft;
		this.#reveal = true;
	}

	close() {
		this.#part  = null;
		this.#draft = null;
	}

	isHeadingOpen(lead)  { return this.#part?.kind === "heading" && this.#part.lead === lead; }
	isResultOpen(index)  { return this.#part?.kind === "result" && this.#part.index === index; }
	isAdderOpen(half)    { return this.#part?.kind === "adder" && this.#part.half === half; }

	/** Bring the editor into view the first time it draws after opening; never on later renders. */
	applyReveal(root, reveal = revealInScroller) {
		if (!this.#reveal || !this.#part) return;
		const panel = root.querySelector(ImprovementEditing.PANEL);
		if (!panel) return;
		this.#reveal = false;
		reveal(panel);
	}

	/** @param {(draft: ImprovementResult) => ImprovementResult} change */
	updateDraft(change) {
		if (this.#part?.kind === "adder") this.#draft = change(this.#draft);
	}

	/** Shut on Escape inside the editor, or a click elsewhere on `root`. Bound once, on first render. */
	attach(root, onClose) {
		const inside = el => el?.closest?.(ImprovementEditing.PANEL);
		root.addEventListener("keydown", event => {
			if (!this.#part || event.key !== "Escape" || !inside(event.target)) return;
			event.stopPropagation();
			onClose();
		});
		// A click, not a pointerdown: a word being typed is saved on `change`, which fires as its field
		// loses focus, and a pointerdown would re-render the editor away before that.
		root.addEventListener("click", event => {
			if (!this.#part || inside(event.target) || event.target.closest?.(ImprovementEditing.OPENER)) return;
			onClose();
		});
	}
}
