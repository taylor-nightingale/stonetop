// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../../fakes/renderTemplate.js";
import { PlaybookSnapshotBuilder } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { rich } from "../../../src/model/snapshot/RichText.js";

// The real snapshot class, so the test breaks if the field the masthead reads is renamed or dropped.
function playbook({ name = "The Would-Be Hero", title = name } = {}) {
	return new PlaybookSnapshotBuilder()
		.withSlug("the-would-be-hero").withName(name).withTitle(title)
		.withDescription(rich("<p>A path to adventure.</p>"))
		.withBackground(null).withOrigin([])
		.build();
}

function render(stonetop) {
	const root = document.createElement("div");
	root.innerHTML = renderPartial("stonetop.actor-header", {
		editable: true, actor: { name: "Anwen", img: "anwen.webp" }, stonetop,
	});
	return root;
}

describe("the character masthead", () => {
	it("writes the playbook's title beside the name, inside the heading", () => {
		const root  = render({ playbook: playbook() });
		const title = root.querySelector(".charname .stonetop-charname-playbook");
		expect(title?.textContent.trim()).toBe("The Would-Be Hero");
		expect(root.querySelector(".charname input[name='name']").value).toBe("Anwen");
	});

	// The title the snapshot computed, not the playbook item's name: taking Big Damn Hero crosses off
	// "Would-be" on the front page, and the front page is this line.
	it("writes the renamed title when the snapshot carries one", () => {
		const root = render({ playbook: playbook({ title: "The Hero" }) });
		expect(root.querySelector(".stonetop-charname-playbook").textContent.trim()).toBe("The Hero");
	});

	// This masthead is the NPC card's too, and an NPC has no playbook.
	it("writes nothing beside the name when there is no playbook", () => {
		const root = render({});
		expect(root.querySelector(".stonetop-charname-playbook")).toBeNull();
		expect(root.querySelector(".charname input[name='name']")).not.toBeNull();
	});
});

describe("the playbook tab", () => {
	// The title art moved off the tab: the playbook's title is the masthead's now, and the tab does not
	// say it twice.
	it("renders no title image", () => {
		const root = document.createElement("div");
		root.innerHTML = renderPartial("stonetop.tab-playbook", {
			editable: true, viewFlags: {}, tabs: { playbook: {} },
			availablePlaybooks: [], stonetop: { playbook: playbook() },
		});
		expect(root.querySelector("img")).toBeNull();
		expect(root.querySelector(".stonetop-playbook-description")).not.toBeNull();
	});
});
