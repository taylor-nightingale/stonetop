import { describe, it, expect, afterEach, vi } from "vitest";
import { moveIcon, buildMoveSnapshot } from "../../src/actors/embeddedMoves.js";

// A move's icon is its item image, so any move — pack-authored or homebrew — can have one, through
// the picker every move sheet already offers. Foundry gives every item a default image though, and
// rendering that would put the same placeholder on all ~93 moves.

const DEFAULT = "icons/svg/item-bag.svg";
const item = img => ({ name: "Trade", img, system: { slug: "trade" } });

afterEach(() => vi.unstubAllGlobals());

describe("moveIcon", () => {
	it("is the item's image when one was chosen", () => {
		expect(moveIcon(item("systems/stonetop/assets/content/seasons/season-spring.png")))
			.toBe("systems/stonetop/assets/content/seasons/season-spring.png");
	});

	it("is null for Foundry's default item image", () => {
		expect(moveIcon(item(DEFAULT))).toBeNull();
	});

	it("is null when the item has no image at all", () => {
		expect(moveIcon(item(null))).toBeNull();
		expect(moveIcon(item(""))).toBeNull();
		expect(moveIcon(undefined)).toBeNull();
	});

	// The default is read off the Item class when Foundry is present, so a system that changes it
	// doesn't start showing that placeholder on every move.
	it("reads the default off the Item document class when there is one", () => {
		vi.stubGlobal("Item", { implementation: { DEFAULT_ICON: "icons/svg/custom.svg" } });
		expect(moveIcon(item("icons/svg/custom.svg"))).toBeNull();
		expect(moveIcon(item(DEFAULT))).toBe(DEFAULT);
	});
});

describe("buildMoveSnapshot icon", () => {
	const snapshotFor = img =>
		buildMoveSnapshot({ name: "Trade", img, system: { slug: "trade" } }, "homefront", true, null);

	it("carries the chosen icon onto the snapshot every surface renders", () => {
		expect(snapshotFor("systems/stonetop/assets/content/seasons/season-winter.png").icon)
			.toBe("systems/stonetop/assets/content/seasons/season-winter.png");
	});

	it("carries null for a move nobody gave an image", () => {
		expect(snapshotFor(DEFAULT).icon).toBeNull();
	});
});
