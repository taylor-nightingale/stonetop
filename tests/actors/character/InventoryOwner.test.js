// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { InventoryOwner } from "../../../src/actors/character/InventoryOwner.js";

function mount(html) {
	document.body.innerHTML = html;
	return document.body;
}

describe("InventoryOwner", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("names the character's own inventory", () => {
		const owner = InventoryOwner.character();
		expect(owner.isFollower).toBe(false);
		expect(owner.followerSlug).toBeNull();
	});

	it("names a follower's inventory by slug", () => {
		const owner = InventoryOwner.follower("enfys");
		expect(owner.isFollower).toBe(true);
		expect(owner.followerSlug).toBe("enfys");
	});

	// The same outfit-items partial renders both places, so the wrapper is what distinguishes them.
	it("reads a follower owner off the wrapper around the row", () => {
		const root = mount(`
			<div class="stonetop-follower-inventory" data-slug="enfys">
				<button class="stonetop-outfit-item" data-slug="rations"></button>
			</div>`);

		const owner = InventoryOwner.fromElement(root.querySelector(".stonetop-outfit-item"));

		expect(owner.isFollower).toBe(true);
		expect(owner.followerSlug).toBe("enfys");
	});

	it("falls back to the character when the row is not inside a follower card", () => {
		const root = mount(`
			<div class="tab inventory">
				<button class="stonetop-outfit-item" data-slug="rations"></button>
			</div>`);

		expect(InventoryOwner.fromElement(root.querySelector(".stonetop-outfit-item")).isFollower).toBe(false);
	});

	it("picks the nearest follower wrapper when inventories are nested", () => {
		const root = mount(`
			<div class="stonetop-follower-inventory" data-slug="outer">
				<div class="stonetop-follower-inventory" data-slug="inner">
					<button class="stonetop-outfit-item"></button>
				</div>
			</div>`);

		expect(InventoryOwner.fromElement(root.querySelector("button")).followerSlug).toBe("inner");
	});

	it("answers the character for a detached or missing element", () => {
		expect(InventoryOwner.fromElement(null).isFollower).toBe(false);
		expect(InventoryOwner.fromElement(document.createElement("div")).isFollower).toBe(false);
		expect(InventoryOwner.fromElement({}).isFollower).toBe(false);
	});
});
