import { describe, expect, it } from "vitest";
import { ChoiceGroupController } from "../../../src/actors/character/ChoiceGroupController.js";
import { StonetopFlags } from "../../../src/actors/character/StonetopFlags.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { TestChoiceGroupBuilder } from "../../fakes/TestChoiceGroupBuilder.js";
import { TestChoiceRowBuilder } from "../../fakes/TestChoiceRowBuilder.js";

function makeFlags() {
	return new StonetopFlags(new FakeFlags(), "choices");
}

function makeController(followers = new FakeFollowers()) {
	return new ChoiceGroupController(makeFlags(), followers);
}

// ── Heading rows ──────────────────────────────────────────────────────────────
describe("ChoiceGroupController — heading rows", () => {
	it("heading without track has null track", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("no-track"))
			.build());

		const snap = ctrl.buildGroupSnapshot("ns");
		expect(snap.list[0].type).toBe("heading");
		expect(snap.list[0].slug).toBe("no-track");
		expect(snap.list[0].track).toBeNull();
	});

	it("heading with track starts with all checks false", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(2))
			.build());

		const snap = ctrl.buildGroupSnapshot("ns");
		expect(snap.list[0].slug).toBe("my-track");
		expect(snap.list[0].track.slug).toBe("my-track");
		expect(snap.list[0].track.checks).toEqual([false, false]);
	});

	it("setCount partially fills track checks", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(2))
			.build());

		await ctrl.setCount("ns", "my-track", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks).toEqual([true, false]);
	});

	it("setCount to max fills all checks", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(3))
			.build());

		await ctrl.setCount("ns", "my-track", 3);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks).toEqual([true, true, true]);
	});

	it("setCount to 0 clears all checks", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(2))
			.build());

		await ctrl.setCount("ns", "my-track", 2);
		await ctrl.setCount("ns", "my-track", 0);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks).toEqual([false, false]);
	});

	it("multiple headings in one group track their checks independently", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-a").withTrack(1))
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-b").withTrack(1))
			.build());

		await ctrl.setCount("ns", "track-a", 1);

		const snap = ctrl.buildGroupSnapshot("ns");
		expect(snap.list[0].track.checks[0]).toBe(true);
		expect(snap.list[1].track.checks[0]).toBe(false);
	});
});

// ── Pick rows ─────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — pick rows", () => {
	it("all options are unchecked before any selection", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "tall", text: "Tall" },
				{ slug: "short", text: "Short" },
			))
			.build());

		const row = ctrl.buildGroupSnapshot("ns").list[0];
		expect(row.options.every(o => !o.checked)).toBe(true);
	});

	it("selectOption marks the chosen option checked and clears siblings", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "tall",  text: "Tall" },
				{ slug: "short", text: "Short" },
			))
			.build());

		await ctrl.selectOption("ns", "tall", "tall,short");

		const row = ctrl.buildGroupSnapshot("ns").list[0];
		expect(row.options.find(o => o.slug === "tall").checked).toBe(true);
		expect(row.options.find(o => o.slug === "short").checked).toBe(false);
	});

	it("re-selecting a different option clears the previous one", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "tall",  text: "Tall" },
				{ slug: "short", text: "Short" },
			))
			.build());

		await ctrl.selectOption("ns", "tall", "tall,short");
		await ctrl.selectOption("ns", "short", "tall,short");

		const row = ctrl.buildGroupSnapshot("ns").list[0];
		expect(row.options.find(o => o.slug === "tall").checked).toBe(false);
		expect(row.options.find(o => o.slug === "short").checked).toBe(true);
	});
});

// ── Input rows ────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — input rows", () => {
	it("input.value is empty string before any mutation", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("note").withInput(null))
			.build());

		expect(ctrl.buildGroupSnapshot("ns").list[0].input.value).toBe("");
	});

	it("input.placeholder comes from group data", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("note").withInput("e.g. level 2"))
			.build());

		expect(ctrl.buildGroupSnapshot("ns").list[0].input.placeholder).toBe("e.g. level 2");
	});

	it("setText with input slug updates input.value in the snapshot", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("note").withInput(null))
			.build());

		await ctrl.setText("ns", "note-input", "hello world");

		expect(ctrl.buildGroupSnapshot("ns").list[0].input.value).toBe("hello world");
	});
});

// ── Follower rows ─────────────────────────────────────────────────────────────

describe("ChoiceGroupController — follower rows", () => {
	it("follower track starts unchecked", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(false);
	});

	it("setFollowerCount(1) marks the follower checked and adds them to followers", async () => {
		const followers = new FakeFollowers();
		const ctrl = makeController(followers);
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		await ctrl.setFollowerCount("ns", "enfys", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(true);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("setFollowerCount(0) marks the follower unchecked and removes them from followers", async () => {
		const followers = new FakeFollowers();
		const ctrl = makeController(followers);
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		await ctrl.setFollowerCount("ns", "enfys", 1);
		await ctrl.setFollowerCount("ns", "enfys", 0);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(false);
		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("setCount on a follower row persists count but does not add to followers", async () => {
		const followers = new FakeFollowers();
		const ctrl = makeController(followers);
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		await ctrl.setCount("ns", "enfys", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(true);
		expect(followers.isOwned("enfys")).toBe(false);
	});
});

// ── Namespace isolation ───────────────────────────────────────────────────────

describe("ChoiceGroupController — namespace isolation", () => {
	it("two namespaces with the same internal choice slug do not collide", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("initiate", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-a").withTrack(1))
			.build());
		await ctrl.addGroup("vessel", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-a").withTrack(1))
			.build());

		await ctrl.setCount("initiate", "track-a", 1);

		expect(ctrl.buildGroupSnapshot("initiate").list[0].track.checks[0]).toBe(true);
		expect(ctrl.buildGroupSnapshot("vessel").list[0].track.checks[0]).toBe(false);
	});

	it("setting counts in two namespaces independently tracks each correctly", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns-1", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(2))
			.build());
		await ctrl.addGroup("ns-2", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(2))
			.build());

		await ctrl.setCount("ns-1", "track", 1);
		await ctrl.setCount("ns-2", "track", 2);

		expect(ctrl.buildGroupSnapshot("ns-1").list[0].track.checks).toEqual([true, false]);
		expect(ctrl.buildGroupSnapshot("ns-2").list[0].track.checks).toEqual([true, true]);
	});

	it("mixed group types in the same controller have independent values", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("headings", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(1))
			.build());
		await ctrl.addGroup("picks", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions({ slug: "yes", text: "Yes" }))
			.build());

		await ctrl.setCount("headings", "my-track", 1);
		await ctrl.selectOption("picks", "yes", "yes");

		expect(ctrl.buildGroupSnapshot("headings").list[0].track.checks[0]).toBe(true);
		expect(ctrl.buildGroupSnapshot("picks").list[0].options[0].checked).toBe(true);
	});
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — validation", () => {
	it("addGroup throws when two rows share the same slug", async () => {
		const ctrl = makeController();
		await expect(ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("dup").withTrack(1))
			.addChoice(TestChoiceRowBuilder.heading().withSlug("dup").withTrack(1))
			.build())
		).rejects.toThrow();
	});
});

// ── clearValues ───────────────────────────────────────────────────────────────

describe("ChoiceGroupController — clearValues", () => {
	it("clearValues(namespace) resets only that namespace", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns-a", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(1))
			.build());
		await ctrl.addGroup("ns-b", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(1))
			.build());

		await ctrl.setCount("ns-a", "track", 1);
		await ctrl.setCount("ns-b", "track", 1);
		await ctrl.clearValues("ns-a");

		expect(ctrl.buildGroupSnapshot("ns-a").list[0].track.checks[0]).toBe(false);
		expect(ctrl.buildGroupSnapshot("ns-b").list[0].track.checks[0]).toBe(true);
	});
});
