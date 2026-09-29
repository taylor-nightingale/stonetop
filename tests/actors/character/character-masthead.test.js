// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../../fakes/renderTemplate.js";
import { PlaybookSnapshotBuilder } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { rich } from "../../../src/model/snapshot/RichText.js";
import { InstinctReadout } from "../../../src/model/snapshot/character/InstinctReadout.js";
import { AppearanceLine } from "../../../src/model/snapshot/character/AppearanceLine.js";

// The real snapshot class, so the test breaks if the field the masthead reads is renamed or dropped.
function playbook({ name = "The Would-Be Hero", title = name } = {}) {
	return new PlaybookSnapshotBuilder()
		.withSlug("the-would-be-hero").withName(name).withTitle(title)
		.withDescription(rich("<p>A path to adventure.</p>"))
		.withBackground(null).withOrigin([])
		.build();
}

function render({ playbook = null, instinct = null, appearance = "" } = {}) {
	const root = document.createElement("div");
	root.innerHTML = renderPartial("stonetop.character-masthead", {
		editable: true, actor: { name: "Anwen", img: "anwen.webp" },
		stonetop: {
			playbook,
			instinct: instinct ?? InstinctReadout.from(playbook, []),
			appearance: new AppearanceLine(appearance),
		},
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

	it("writes nothing beside the name when there is no playbook", () => {
		const root = render({});
		expect(root.querySelector(".stonetop-charname-playbook")).toBeNull();
		expect(root.querySelector(".charname input[name='name']")).not.toBeNull();
	});
});

describe("who this is, beside the name (D7)", () => {
	it("says nothing at all while there is neither an instinct nor an appearance", () => {
		expect(render({ playbook: playbook() }).querySelector(".stonetop-who")).toBeNull();
	});

	// The words cut to "…" on a narrow sheet, so the name the control is known by carries all of it,
	// and where to change it.
	it("reads the instinct as a route to where it is changed, named in full", () => {
		const root = render({ playbook: playbook(), instinct: new InstinctReadout("Longing — to be free", "The Ghost", "insert-ghost") });
		const route = root.querySelector(".stonetop-instinct button");
		expect(route.textContent).toBe("Longing — to be free");
		expect([route.dataset.action, route.dataset.tab]).toEqual(["goToTab", "insert-ghost"]);
		expect(route.getAttribute("aria-label")).toBe("Longing — to be free — change it on The Ghost");
		expect(route.hasAttribute("data-view-state")).toBe(true);
	});

	it("reads the appearance under it, its plain words on the hover", () => {
		const root = render({ playbook: playbook(), appearance: "grizzled · *clear* voice" });
		const line = root.querySelector(".stonetop-appearance");
		expect(line.querySelector("em").textContent).toBe("clear");
		expect(line.dataset.tooltip).toBe("grizzled · clear voice");
	});

	it("draws no crest without a playbook, since the portrait is the rail's", () => {
		expect(render({}).querySelector("img")).toBeNull();
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
