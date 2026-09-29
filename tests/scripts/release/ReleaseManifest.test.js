import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { GitHubRelease } from "../../../scripts/release/GitHubRelease.js";
import { ReleaseManifest } from "../../../scripts/release/ReleaseManifest.js";

const shipped = JSON.parse(readFileSync(new URL("../../../system.json", import.meta.url), "utf8"));

const manifest = {
	id: "stonetop",
	version: "1.7.0",
	download: "https://github.com/taylor-nightingale/stonetop/archive/refs/heads/main.zip",
	styles: ["styles/tokens.css", "styles/stonetop.css"],
};

describe("ReleaseManifest.from", () => {
	it("refuses a manifest with no version to stamp with", () => {
		expect(() => ReleaseManifest.from({ id: "stonetop" })).toThrow(/version/);
		expect(() => ReleaseManifest.from()).toThrow(/version/);
	});
});

describe("the manifest a release ships", () => {
	it("points the download at this tag's asset", () => {
		const release = GitHubRelease.from({ repository: "taylor-nightingale/stonetop", tag: "1.7.0" });

		expect(ReleaseManifest.from(manifest).withDownloadUrl(release.assetUrl("stonetop.zip")).toJSON().download)
			.toBe("https://github.com/taylor-nightingale/stonetop/releases/download/1.7.0/stonetop.zip");
	});

	it("stamps every stylesheet with the manifest's own version", () => {
		expect(ReleaseManifest.from(manifest).withVersionedStyles().toJSON().styles)
			.toEqual(["styles/tokens.css?v=1.7.0", "styles/stonetop.css?v=1.7.0"]);
	});

	// The version is read off the manifest rather than the tag, because the manifest is what Foundry
	// serves and what the bundle was built against; FoundryRelease is what makes the two agree.
	it("takes the version from the manifest", () => {
		expect(ReleaseManifest.from({ ...manifest, version: "2.0.0" }).withVersionedStyles().toJSON().styles)
			.toEqual(["styles/tokens.css?v=2.0.0", "styles/stonetop.css?v=2.0.0"]);
	});

	it("leaves everything it was not asked about alone", () => {
		const stamped = ReleaseManifest.from(manifest).withVersionedStyles().toJSON();

		expect(stamped.id).toBe("stonetop");
		expect(stamped.version).toBe("1.7.0");
		expect(stamped.download).toBe(manifest.download);
	});

	it("does not write the manifest it was handed", () => {
		ReleaseManifest.from(manifest).withDownloadUrl("https://example.invalid/x.zip").withVersionedStyles();

		expect(manifest.styles).toEqual(["styles/tokens.css", "styles/stonetop.css"]);
		expect(manifest.download).toContain("heads/main.zip");
	});

	it("has nothing to say about a manifest that declares no styles", () => {
		const { styles, ...styleless } = manifest;

		expect(ReleaseManifest.from(styleless).withVersionedStyles().toJSON()).not.toHaveProperty("styles");
	});
});

// The stamp is only worth anything if it lands on the sheets this system actually serves.
describe("the stamp against the shipped manifest", () => {
	it("versions every stylesheet system.json declares", () => {
		const stamped = ReleaseManifest.from(shipped).withVersionedStyles().toJSON();

		expect(stamped.styles).toHaveLength(shipped.styles.length);
		for (const entry of stamped.styles) {
			expect(typeof entry === "string" ? entry : entry.src).toContain(`?v=${shipped.version}`);
		}
	});

	it("stamps paths that exist on disk", () => {
		for (const entry of ReleaseManifest.from(shipped).withVersionedStyles().styles) {
			const [path] = entry.src.split("?");
			expect(existsSync(new URL(`../../../${path}`, import.meta.url)), `${path} is not a file`).toBe(true);
		}
	});

	// Committed, the manifest has to stay unstamped. A dev install serves the working tree, where the
	// version sits still for weeks while the CSS changes daily — a frozen `?v=` there would pin every
	// client to whatever it cached first, and it is a second place to remember on every bump. The
	// release workflow stamps between `npm test` and the zip, so nothing here can catch that copy.
	it("is not already applied to the committed manifest", () => {
		for (const entry of ReleaseManifest.from(shipped).styles) {
			expect(entry.src, "a release stamp was committed").not.toContain("?");
		}
	});
});
