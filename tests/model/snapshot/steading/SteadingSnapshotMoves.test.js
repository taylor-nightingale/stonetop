import { describe, it, expect } from "vitest";
import { SteadingSnapshot, SeasonsSnapshot } from "../../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { MoveCategorySnapshotBuilder } from "../../../../src/model/snapshot/character/MoveSnapshot.js";

/**
 * Which category the rail's two move groups are is a fact about the steading, asked of the snapshot.
 * A `{{#if (eq key "homefront")}}` in the template would put that fact in the markup, where nothing
 * tests it — and the seasonal group would have to reach through the Seasons snapshot to find its
 * moves.
 */
const category = (key, label) => new MoveCategorySnapshotBuilder()
	.withKey(key).withLabel(label).withRenderStyle("standard")
	.withAllowAdditional(false).withNote(null).withMoves([]).build();

const snapshot = ({ moves = [], seasons = null } = {}) => new SteadingSnapshot({ moves, seasons });

describe("SteadingSnapshot's move groups", () => {
	it("names the homefront category for the rail's first group", () => {
		const homefront = category("homefront", "Homefront Moves");
		expect(snapshot({ moves: [homefront] }).homefrontMoves).toBe(homefront);
	});

	it("is null when the steading carries no homefront move at all", () => {
		expect(snapshot().homefrontMoves).toBeNull();
	});

	// Off the Seasons snapshot, not `moves`: a category that owns a tab is built by that tab and
	// never joins the Moves list, so the rail would find nothing there.
	it("takes the seasonal group off the season snapshot the tab built", () => {
		const seasonal = category("seasons", "Seasonal Moves");
		expect(snapshot({ seasons: new SeasonsSnapshot({ moves: seasonal }) }).seasonalMoves).toBe(seasonal);
	});

	it("is null before the season snapshot exists, so the rail draws no empty group", () => {
		expect(snapshot().seasonalMoves).toBeNull();
		expect(snapshot({ seasons: new SeasonsSnapshot({}) }).seasonalMoves).toBeNull();
	});
});
