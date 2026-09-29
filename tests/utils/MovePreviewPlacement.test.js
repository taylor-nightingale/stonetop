// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
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

	it("puts it on the left when there is no room on the right", () => {
		expect(place(rect(1100, 300, 200, 40))).toEqual({ x: 1100 - 8 - 320, y: 300 });
	});

	// A tab's row runs the tab's width; sent left, its card landed on top of the rail.
	it("puts a row too wide for either side's card under it, at its own left edge", () => {
		expect(place(rect(300, 300, 900, 40))).toEqual({ x: 300, y: 346 });
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
	function sheet() {
		document.body.innerHTML = `<div class="root"><ol>
			<li class="stonetop-mrow"><button class="stonetop-mrow-roll">Defend</button>
				<div class="stonetop-move-preview">text</div></li>
		</ol></div>`;
		const row = document.querySelector(".stonetop-mrow");
		row.getBoundingClientRect = () => rect(20, 300, 200, 40);
		const card = row.querySelector(".stonetop-move-preview");
		Object.defineProperty(card, "scrollHeight", { value: 200 });
		const root = document.querySelector(".root");
		new MovePreviews({ width: () => 320, viewport: () => VIEW }).attach(root);
		return { row, card, root };
	}

	it("places a row's card when a pointer comes onto the row", () => {
		const { row, card } = sheet();
		row.dispatchEvent(new Event("pointerover", { bubbles: true }));
		expect(card.style.getPropertyValue("--move-preview-x")).toBe("228px");
		expect(card.style.getPropertyValue("--move-preview-y")).toBe("300px");
	});

	it("places it when the keyboard reaches the row", () => {
		const { row, card } = sheet();
		row.querySelector("button").dispatchEvent(new Event("focusin", { bubbles: true }));
		expect(card.style.getPropertyValue("--move-preview-x")).toBe("228px");
	});

	// Dismissible: the keyboard route shows the card on the focused name, so Escape takes the focus off.
	it("lets Escape put the card away from a focused row", () => {
		const { row } = sheet();
		const button = row.querySelector("button");
		button.focus();
		button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(document.activeElement).not.toBe(button);
	});
});
