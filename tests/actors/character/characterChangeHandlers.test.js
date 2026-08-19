// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { characterChangeHandlers } from "../../../src/actors/character/characterChangeHandlers.js";
import { InventoryOwner } from "../../../src/actors/character/InventoryOwner.js";

// The map is pure element→domain-method routing, so it needs no sheet to test — which is the point
// of it living outside one. The sheet-level tests still cover that the router reaches these.
function makeChar() {
	return new Proxy({}, {
		get(target, prop) {
			if (prop === "origin") return target.origin ??= { select: vi.fn() };
			return target[prop] ??= vi.fn(async () => {});
		},
	});
}

function el(html) {
	document.body.innerHTML = html;
	return document.body.firstElementChild;
}

let char, handlers;

beforeEach(() => {
	document.body.innerHTML = "";
	char = makeChar();
	handlers = characterChangeHandlers(char);
});

describe("characterChangeHandlers", () => {
	it("routes a scalar vitals field by value", () => {
		handlers.hp(el(`<input value="7">`));
		expect(char.setHP).toHaveBeenCalledWith("7");
	});

	it("routes a checkbox by its slug and checked state", () => {
		const input = el(`<input type="checkbox" data-slug="weak" checked>`);
		handlers.debility(input);
		expect(char.setDebility).toHaveBeenCalledWith("weak", true);
	});

	// The blank belongs to whichever arcanum card encloses it.
	it("routes an arcanum blank through its enclosing card", () => {
		const root = el(`
			<div class="stonetop-arcanum-card" data-slug="cloak">
				<input class="stonetop-arcanum-blank" data-blank-key="name" value="Bo">
			</div>`);
		handlers.arcanumBlank(root.querySelector("input"));
		expect(char.setArcanumBlank).toHaveBeenCalledWith("cloak", "name", "Bo");
	});

	it("does nothing for a blank with no card around it", () => {
		handlers.arcanumBlank(el(`<input class="stonetop-arcanum-blank" data-blank-key="name">`));
		expect(char.setArcanumBlank).not.toHaveBeenCalled();
	});

	it("routes an inventory check to the character by default", () => {
		handlers.inventoryItemCheck(el(`<input type="checkbox" data-slug="rope" checked>`));
		const [owner, slug, checked] = char.setInventoryItemCheckedFor.mock.calls[0];
		expect(owner).toEqual(InventoryOwner.character());
		expect([slug, checked]).toEqual(["rope", true]);
	});

	it("routes an inventory check to the follower whose catalog it sits in", () => {
		const root = el(`
			<div class="stonetop-follower-inventory" data-slug="enfys">
				<input type="checkbox" data-slug="rope">
			</div>`);
		handlers.inventoryItemCheck(root.querySelector("input"));
		expect(char.setInventoryItemCheckedFor.mock.calls[0][0]).toEqual(InventoryOwner.follower("enfys"));
	});

	// Max HP may have just been typed into the sibling field, so the live value wins over the
	// rendered one the current-HP input was drawn with.
	it("clamps follower HP against the live max field beside it", () => {
		const root = el(`
			<div class="stonetop-follower-card">
				<input class="stonetop-follower-hp" data-slug="enfys" value="9" max="4">
				<input class="stonetop-follower-hp-max" value="12">
			</div>`);
		handlers.followerHp(root.querySelector(".stonetop-follower-hp"));
		expect(char.setFollowerHp).toHaveBeenCalledWith("enfys", "9", "12");
	});

	it("falls back to the input's own max when there is no sibling max field", () => {
		handlers.followerHp(el(`<input data-slug="enfys" value="9" max="4">`));
		expect(char.setFollowerHp).toHaveBeenCalledWith("enfys", "9", "4");
	});

	it("routes a member field by slug and index", () => {
		handlers.memberName(el(`<input data-slug="crew" data-index="2" value="Bo">`));
		expect(char.setFollowerMemberName).toHaveBeenCalledWith("crew", 2, "Bo");
	});
});
