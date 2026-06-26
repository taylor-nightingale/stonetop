import { describe, it, expect } from "vitest";
import { pathAPassesFor } from "../../module/migration/gating.js";

describe("pathAPassesFor — per-pass Path A version gating", () => {
	it("a never-migrated world (dataVersion 0) runs every pass", () => {
		expect(pathAPassesFor(0)).toEqual({ consolidate: true, remapAssets: true });
	});

	it("treats unset/null/NaN dataVersion as 0", () => {
		for (const v of [undefined, null, NaN, "", "garbage"]) {
			expect(pathAPassesFor(v)).toEqual({ consolidate: true, remapAssets: true });
		}
	});

	it("a v1 world runs ONLY the new asset remap, never re-runs flag/settings consolidation", () => {
		// This is the invariant: A1 is non-destructive, so re-running it would deep-merge the still-
		// present legacy flags.stonetop_pwd scope back over the active one and resurrect deleted flags.
		expect(pathAPassesFor(1)).toEqual({ consolidate: false, remapAssets: true });
	});

	it("a world already at the latest version runs no pass", () => {
		expect(pathAPassesFor(2)).toEqual({ consolidate: false, remapAssets: false });
	});

	it("a future world ahead of this build runs no pass", () => {
		expect(pathAPassesFor(3)).toEqual({ consolidate: false, remapAssets: false });
	});

	it("accepts a numeric string dataVersion", () => {
		expect(pathAPassesFor("1")).toEqual({ consolidate: false, remapAssets: true });
	});
});
