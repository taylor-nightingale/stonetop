import { InventoryOwner } from "./InventoryOwner.js";
import { OutfitItemDraft } from "./OutfitItemDraft.js";
import { revealInScroller } from "../../utils/revealInScroller.js";

/** Which "+ add item" the adder hangs from: the character's regular or small column, or a follower's
 *  inventory (always regular). `key` is what the template matches to draw the adder at its button. */
export class AdderPlace {
	constructor(owner, isRegular) {
		this.owner     = owner;
		this.isRegular = isRegular;
		this.key       = owner.isFollower ? `follower:${owner.followerSlug}` : `character:${isRegular ? "regular" : "small"}`;
	}

	static fromButton(button) {
		const owner = InventoryOwner.fromElement(button);
		return new AdderPlace(owner, owner.isFollower || button.dataset.column !== "small");
	}
}

/** What the adder's template draws — fields, not getters: templates cannot read a prototype's. */
export class OutfitAdderView {
	constructor(place, draft, tagField) {
		this.key       = place.key;
		this.square    = !draft.isRegular;
		this.draft     = draft;
		this.preview   = draft.preview;
		this.tagPicker = draft.tagPicker;
		this.tagField  = tagField;
	}
}

const DRAFT_SETTERS = {
	name:     (d, v) => d.withName(v),
	weight:   (d, v) => d.withWeight(v),
	uses:     (d, v) => d.withUses(v),
	usesWord: (d, v) => d.withUsesWord(v),
	note:     (d, v) => d.withNote(v),
};

/**
 * The outfit adder's view state: which "+ add item" it is open at, the item being written, and where
 * the focus goes when it next draws.
 *
 * On the sheet instance, like the wound editor's (AilmentEditor): nothing reaches the actor until
 * Add, and a render from elsewhere draws the adder again with what was typed. Typing and the − / +
 * change the draft and redraw only the preview row, so the field being typed in keeps the focus;
 * a tag chip re-renders the sheet, since the chips are the picker's own markup.
 *
 * It shuts on Escape inside it and on a click elsewhere on the sheet — not on a "+ add item", which
 * opens it where that button is.
 */
export class OutfitItemAdder {
	static ADDER     = ".stonetop-outfit-adder";
	static PREVIEW   = ".stonetop-outfit-adder-preview";
	static OPENER    = '[data-action="addInventoryItem"]';
	static NAME      = '[data-draft-field="name"]';
	static TAG_FIELD = "outfitDraftTags";

	#place  = null;
	#draft  = null;
	#focus  = null;
	#reveal = false;

	get isOpen() { return this.#place !== null; }
	get place()  { return this.#place; }
	get draft()  { return this.#draft; }

	open(place) {
		this.#place  = place;
		this.#draft  = OutfitItemDraft.for(place.isRegular);
		this.#focus  = OutfitItemAdder.NAME;
		this.#reveal = true;
	}

	/** Bring the adder into view the first time it draws after opening; never on later renders. */
	applyReveal(root, reveal = revealInScroller) {
		if (!this.isOpen || !this.#reveal) return;
		const adder = root.querySelector(OutfitItemAdder.ADDER);
		if (!adder) return;
		this.#reveal = false;
		reveal(adder);
	}

	close() {
		this.#place = null;
		this.#draft = null;
		this.#focus = null;
	}

	/** @param {(draft: OutfitItemDraft) => OutfitItemDraft} change */
	update(change) {
		if (this.isOpen) this.#draft = change(this.#draft);
	}

	/** @returns {OutfitAdderView|null} */
	view() {
		return this.isOpen ? new OutfitAdderView(this.#place, this.#draft, OutfitItemAdder.TAG_FIELD) : null;
	}

	/** When the adder next draws, put the focus on `selector` inside it. */
	focusOn(selector) {
		this.#focus = selector;
	}

	/** Put the focus where the last open or change asked for it, once. */
	applyFocus(root) {
		if (!this.isOpen || this.#focus === null) return;
		const target = root.querySelector(OutfitItemAdder.ADDER)?.querySelector(this.#focus);
		this.#focus = null;
		target?.focus({ preventScroll: true });
	}

	/**
	 * Bound once, on first render.
	 * @param {HTMLElement} root
	 * @param {{ onClose: () => void, onAdd: () => void, renderPreview: (view: OutfitAdderView) => Promise<string> }} hooks
	 */
	attach(root, { onClose, onAdd, renderPreview }) {
		const inside = el => el?.closest?.(OutfitItemAdder.ADDER);
		const redraw = async adder => {
			const html = await renderPreview(this.view());
			const slot = adder?.querySelector(OutfitItemAdder.PREVIEW);
			if (slot && this.isOpen) slot.innerHTML = html;
		};

		root.addEventListener("input", event => {
			const field = event.target.dataset?.draftField;
			const setter = DRAFT_SETTERS[field];
			if (!this.isOpen || !setter || !inside(event.target)) return;
			this.update(d => setter(d, event.target.value));
			return redraw(inside(event.target));
		});

		root.addEventListener("keydown", event => {
			if (!this.isOpen || !inside(event.target)) return;
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			} else if (event.key === "Enter" && event.target.dataset?.draftField) {
				event.preventDefault();
				onAdd();
			}
		});

		root.addEventListener("click", event => {
			if (!this.isOpen) return;
			const step = event.target.closest?.("[data-draft-step]");
			if (step && inside(step)) return this.#step(step, redraw);
			if (inside(event.target) || event.target.closest?.(OutfitItemAdder.OPENER)) return;
			onClose();
		});
	}

	#step(button, redraw) {
		const field = button.dataset.draftStep;
		const setter = DRAFT_SETTERS[field];
		if (!setter) return;
		this.update(d => setter(d, d[field] + Number(button.dataset.step)));
		const adder = button.closest(OutfitItemAdder.ADDER);
		const input = adder.querySelector(`[data-draft-field="${field}"]`);
		if (input) input.value = String(this.#draft[field]);
		return redraw(adder);
	}
}
