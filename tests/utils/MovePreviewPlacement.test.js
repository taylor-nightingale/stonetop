// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { MovePreviewPlacement, MovePreviews } from "../../src/utils/MovePreviewPlacement.js";

const VIEW = { width: 1400, height: 900 };
const CARD = { width: 320, height: 260 };
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });

const place = row => MovePreviewPlacement.place(row, CARD, VIEW);

describe("MovePreviewPlacement", () => {
	// Beside the row is the better read: the row stays visible and nothing it sits in is covered.
	it("puts the card beside a narrow row, level with it", () => {
		expect(place(rect(20, 300, 200, 40))).toEqual({ x: 228, y: 300 });
	});

	// A tab's row runs the tab's width; sent left, its card landed on top of the rail.
	it("puts a row with no room on its right under it, at its own left edge — never on its left", () => {
		expect(place(rect(500, 300, 750, 40))).toEqual({ x: 500, y: 346 });
		expect(place(rect(1100, 300, 200, 40))).toEqual({ x: VIEW.width - CARD.width - 8, y: 346 });
	});

	it("flips a card above a wide row near the bottom of the window", () => {
		expect(place(rect(300, 800, 900, 40))).toEqual({ x: 300, y: 800 - 6 - 260 });
	});

	it("keeps the card inside the window", () => {
		const { x, y } = place(rect(20, 880, 200, 40));
		expect(y).toBe(VIEW.height - CARD.height - 8);
		expect(x).toBeGreaterThanOrEqual(8);
	});
});

describe("MovePreviews", () => {
	// happy-dom has no popover API; the card answers for itself as Chrome's would.
	function popover(card) {
		let open = false;
		card.showPopover = vi.fn(() => { open = true; });
		card.hidePopover = vi.fn(() => { open = false; });
		Object.defineProperty(card, "isShown", { get: () => open });
		card.getBoundingClientRect = () => rect(0, 0, 320, 200);
	}

	function sheet() {
		document.body.innerHTML = `<div class="root"><ol>
			<li class="stonetop-mrow"><button class="stonetop-mrow-roll">Defend</button>
				<div class="stonetop-move-preview" popover="manual">text</div></li>
		</ol><span class="elsewhere"></span></div>`;
		const row = document.querySelector(".stonetop-mrow");
		row.getBoundingClientRect = () => rect(20, 300, 200, 40);
		const card = row.querySelector(".stonetop-move-preview");
		popover(card);
		const root = document.querySelector(".root");
		new MovePreviews({ viewport: () => VIEW }).attach(root);
		return { row, card, root, button: row.querySelector("button"), elsewhere: root.querySelector(".elsewhere") };
	}
	const pointer = (type, target, relatedTarget = null) =>
		target.dispatchEvent(new PointerEvent(type, { bubbles: true, relatedTarget }));

	it("shows a row's card beside it when a pointer comes onto the row", () => {
		const { row, card } = sheet();
		pointer("pointerover", row);
		expect(card.isShown).toBe(true);
		expect(card.style.getPropertyValue("--move-preview-x")).toBe("228px");
		expect(card.style.getPropertyValue("--move-preview-y")).toBe("300px");
	});

	// The card's own size, measured as it shows: its height follows the move's text.
	it("places the card by the size it shows at", () => {
		const { row, card } = sheet();
		row.getBoundingClientRect = () => rect(300, 700, 1000, 40);
		card.getBoundingClientRect = () => rect(0, 0, 320, 180);
		pointer("pointerover", row);
		expect(card.style.getPropertyValue("--move-preview-y")).toBe(`${700 - 6 - 180}px`);
	});

	it("keeps it up while the pointer moves within the row, and puts it away as it leaves", () => {
		const { row, card, button, elsewhere } = sheet();
		pointer("pointerover", row);
		pointer("pointerout", row, button);
		expect(card.isShown).toBe(true);
		pointer("pointerout", button, elsewhere);
		expect(card.isShown).toBe(false);
	});

	it("shows nothing for a row whose text is already open", () => {
		const { row, card } = sheet();
		row.classList.add("is-open");
		pointer("pointerover", row);
		expect(card.showPopover).not.toHaveBeenCalled();
	});

	it("puts it away when the row is clicked — rolled, or its text opened", () => {
		const { row, card, button } = sheet();
		pointer("pointerover", row);
		button.click();
		expect(card.isShown).toBe(false);
	});

	it("shows it when the keyboard reaches the roll button, and puts it away as focus leaves", () => {
		const { card, button, elsewhere } = sheet();
		button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		expect(card.isShown).toBe(false);
		button.focus();
		button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		expect(card.isShown).toBe(true);
		button.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: elsewhere }));
		expect(card.isShown).toBe(false);
	});

	it("lets Escape put the card away", () => {
		const { card, button } = sheet();
		button.focus();
		button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(card.isShown).toBe(false);
	});
});
