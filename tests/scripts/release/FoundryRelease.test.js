import { describe, expect, it } from "vitest";
import { FoundryRelease } from "../../../scripts/release/FoundryRelease.js";

const manifest = {
	id: "stonetop",
	version: "1.0.1",
	compatibility: { minimum: "13", verified: "14" },
};

const source = { repository: "taylor-nightingale/stonetop", tag: "1.0.1" };

describe("FoundryRelease.fromManifest", () => {
	it("builds the release payload the API documents", () => {
		const body = FoundryRelease.fromManifest(manifest, source).toRequestBody();

		expect(body).toEqual({
			id: "stonetop",
			release: {
				version: "1.0.1",
				manifest: "https://github.com/taylor-nightingale/stonetop/releases/download/1.0.1/system.json",
				notes: "https://github.com/taylor-nightingale/stonetop/releases/tag/1.0.1",
				compatibility: { minimum: "13", verified: "14" },
			},
		});
	});

	it("points the manifest at the tagged asset rather than the latest release", () => {
		const release = FoundryRelease.fromManifest(manifest, source);

		expect(release.manifestUrl).not.toContain("latest");
		expect(release.manifestUrl).toContain("/download/1.0.1/");
	});

	it("carries compatibility.maximum only when the manifest sets one", () => {
		const capped = { ...manifest, compatibility: { minimum: "13", verified: "14", maximum: "15" } };

		expect(FoundryRelease.fromManifest(capped, source).toRequestBody().release.compatibility)
			.toEqual({ minimum: "13", verified: "14", maximum: "15" });
	});

	it("omits dry-run by default and sets it when asked", () => {
		const release = FoundryRelease.fromManifest(manifest, source);

		expect(release.toRequestBody()).not.toHaveProperty("dry-run");
		expect(release.toRequestBody({ dryRun: true })["dry-run"]).toBe(true);
	});

	it("accepts a v-prefixed tag, keeping the tag itself in the URLs", () => {
		const release = FoundryRelease.fromManifest(manifest, { ...source, tag: "v1.0.1" });

		expect(release.version).toBe("1.0.1");
		expect(release.manifestUrl).toBe("https://github.com/taylor-nightingale/stonetop/releases/download/v1.0.1/system.json");
		expect(release.notesUrl).toBe("https://github.com/taylor-nightingale/stonetop/releases/tag/v1.0.1");
	});

	it("refuses a tag that disagrees with the manifest version", () => {
		expect(() => FoundryRelease.fromManifest(manifest, { ...source, tag: "1.0.2" }))
			.toThrow(/1\.0\.1.*1\.0\.2/);
	});

	it.each([
		["repository", { repository: undefined, tag: "1.0.1" }, /repository/i],
		["tag", { repository: "owner/name", tag: undefined }, /tag/i],
	])("refuses a missing %s", (_label, incomplete, expected) => {
		expect(() => FoundryRelease.fromManifest(manifest, incomplete)).toThrow(expected);
	});

	it.each([
		["id", { ...manifest, id: undefined }, /id/],
		["version", { ...manifest, version: undefined }, /version/],
		["compatibility.minimum", { ...manifest, compatibility: { verified: "14" } }, /minimum/],
		["compatibility.verified", { ...manifest, compatibility: { minimum: "13" } }, /verified/],
	])("refuses a manifest missing %s", (_label, broken, expected) => {
		expect(() => FoundryRelease.fromManifest(broken, source)).toThrow(expected);
	});
});
