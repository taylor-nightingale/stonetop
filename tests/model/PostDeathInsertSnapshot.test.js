import { describe, it, expect } from "vitest";
import { PostDeathInsertSnapshot, PostDeathInsertSnapshotBuilder } from "../../module/model/snapshot/character/PostDeathInsertSnapshot.js";
import { InstinctSection, InstinctOptionSnapshotBuilder } from "../../module/model/snapshot/character/PlaybookSnapshot.js";
import {
	LoreEntrySnapshotBuilder,
	OptionSnapshotBuilder,
	LoreSection
} from "../../module/model/snapshot/character/LoreSnapshot.js";

// -- Fixtures -----------------------------------------------------------------

const INSTINCT_SECTION = new InstinctSection(
	"denial",
	[
		new InstinctOptionSnapshotBuilder().withWord("Denial").withDescription("To refuse to accept that you are dead.").withValue("denial").withSelected(true).build(),
		new InstinctOptionSnapshotBuilder().withWord("Obsession").withDescription("To pursue your Terrible Purpose no matter what.").withValue("obsession").withSelected(false).build(),
	]
);

const CONSEQUENCE_OPTION_BREAKDOWN = new OptionSnapshotBuilder()
	.withSlug("breakdown")
	.withDescription("<p>You lash out...</p>")
	.withMax(1)
	.withCount(1)
	.withRequires(null)
	.build();

const CONSEQUENCE_OPTION_UNSTABLE = new OptionSnapshotBuilder()
	.withSlug("unstable")
	.withDescription("<p>You are prone...</p>")
	.withMax(1)
	.withCount(0)
	.withRequires("breakdown")
	.build();

const CONSEQUENCES_ENTRY = new LoreEntrySnapshotBuilder()
	.withSlug("consequences")
	.withTitle("Consequences")
	.withDescription("<p>Choose 1...</p>")
	.withOptions([CONSEQUENCE_OPTION_BREAKDOWN, CONSEQUENCE_OPTION_UNSTABLE])
	.build();

const LORE_SECTION = new LoreSection([CONSEQUENCES_ENTRY]);

const buildSnapshot = () =>
	new PostDeathInsertSnapshotBuilder()
		.withSlug("revenant")
		.withName("Revenant")
		.withImg("icons/svg/skull.png")
		.withDescription("<p>When you die...</p>")
		.withInstinct(INSTINCT_SECTION)
		.withMoves([])
		.withLore(LORE_SECTION)
		.build();

// -- Tests --------------------------------------------------------------------

describe("PostDeathInsertSnapshot", () => {
	it("stores slug, name, img, description", () => {
		const snap = buildSnapshot();
		expect(snap.slug).toBe("revenant");
		expect(snap.name).toBe("Revenant");
		expect(snap.img).toBe("icons/svg/skull.png");
		expect(snap.description).toBe("<p>When you die...</p>");
	});

	it("stores instinct section", () => {
		expect(buildSnapshot().instinct).toBe(INSTINCT_SECTION);
	});

	it("stores moves array", () => {
		expect(buildSnapshot().moves).toEqual([]);
	});

	it("stores lore section", () => {
		expect(buildSnapshot().lore).toBe(LORE_SECTION);
	});
});

describe("LoreOptionSnapshot.requires", () => {
	it("stores requires when set", () => {
		expect(CONSEQUENCE_OPTION_UNSTABLE.requires).toBe("breakdown");
	});

	it("defaults requires to null when not set", () => {
		expect(CONSEQUENCE_OPTION_BREAKDOWN.requires).toBeNull();
	});

	it("defaults requires to null when builder omits withRequires", () => {
		const opt = new OptionSnapshotBuilder()
			.withSlug("quarry")
			.withDescription("<p>The Pale Hunter...</p>")
			.withMax(1)
			.withCount(0)
			.build();
		expect(opt.requires).toBeNull();
	});
});
