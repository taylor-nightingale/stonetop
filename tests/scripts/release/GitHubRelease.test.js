import { describe, expect, it } from "vitest";
import { GitHubRelease } from "../../../scripts/release/GitHubRelease.js";

const source = { repository: "taylor-nightingale/stonetop", tag: "1.7.0" };

describe("GitHubRelease.from", () => {
	it("names what is missing rather than building a URL with a hole in it", () => {
		expect(() => GitHubRelease.from({ tag: "1.7.0" })).toThrow(/GITHUB_REPOSITORY/);
		expect(() => GitHubRelease.from({ repository: "a/b" })).toThrow(/GITHUB_REF_NAME/);
		expect(() => GitHubRelease.from()).toThrow(/GITHUB_REPOSITORY/);
	});
});

describe("the URLs a tagged release serves", () => {
	it("addresses an asset by the tag it was uploaded under", () => {
		expect(GitHubRelease.from(source).assetUrl("stonetop.zip"))
			.toBe("https://github.com/taylor-nightingale/stonetop/releases/download/1.7.0/stonetop.zip");
	});

	it("points the notes at the release page", () => {
		expect(GitHubRelease.from(source).notesUrl)
			.toBe("https://github.com/taylor-nightingale/stonetop/releases/tag/1.7.0");
	});

	// The tag is written both ways in the wild; the version inside the manifest never wears the v.
	it("reads the version out of a tag with or without its v", () => {
		expect(GitHubRelease.from(source).version).toBe("1.7.0");
		expect(GitHubRelease.from({ ...source, tag: "v1.7.0" }).version).toBe("1.7.0");
	});

	// The v belongs to the tag, so the URLs keep it even though the version does not.
	it("keeps the tag as written in the URLs", () => {
		const release = GitHubRelease.from({ ...source, tag: "v1.7.0" });

		expect(release.assetUrl("system.json")).toContain("/download/v1.7.0/");
		expect(release.notesUrl).toContain("/tag/v1.7.0");
	});
});
