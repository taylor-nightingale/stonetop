import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { GitHubRelease } from "../../../scripts/release/GitHubRelease.js";
import { ReleaseManifest } from "../../../scripts/release/ReleaseManifest.js";

const shipped = JSON.parse(readFileSync(new URL("../../../system.json", import.meta.url), "utf8"));

const manifest = {
	id: "stonetop",
	version: "1.7.0",
	download: "https://github.com/taylor-nightingale/stonetop/archive/refs/heads/main.zip",
	esmodules: ["dist/stonetop.js"],
	styles: ["styles/tokens.css", { src: "styles/stonetop.css", layer: "system" }],
	languages: [{ lang: "en", name: "English", path: "languages/en.json" }],
};

describe("ReleaseManifest.from", () => {
	it("refuses a manifest with no version", () => {
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

	it("leaves everything it was not asked about alone", () => {
		const stamped = ReleaseManifest.from(manifest).withDownloadUrl("https://example.invalid/x.zip").toJSON();

		expect(stamped).toEqual({ ...manifest, download: "https://example.invalid/x.zip" });
	});

	it("does not write the manifest it was handed", () => {
		ReleaseManifest.from(manifest).withDownloadUrl("https://example.invalid/x.zip");

		expect(manifest.download).toContain("heads/main.zip");
	});
});

describe("ReleaseManifest.includedFiles", () => {
	it("lists modules, stylesheets in either shape, and language files", () => {
		expect(ReleaseManifest.from(manifest).includedFiles).toEqual([
			"dist/stonetop.js",
			"styles/tokens.css",
			"styles/stonetop.css",
			"languages/en.json",
		]);
	});

	it("includes plain scripts", () => {
		expect(ReleaseManifest.from({ version: "1.0.0", scripts: ["lib/a.js"] }).includedFiles).toEqual(["lib/a.js"]);
	});

	it("leaves out files served from elsewhere", () => {
		const remote = { version: "1.0.0", styles: ["https://cdn.example/a.css", "//cdn.example/b.css", "c.css"] };

		expect(ReleaseManifest.from(remote).includedFiles).toEqual(["c.css"]);
	});

	it("is empty for a manifest that includes nothing", () => {
		expect(ReleaseManifest.from({ version: "1.0.0" }).includedFiles).toEqual([]);
	});
});

// Foundry checks every included path on install and looks it up literally, so a query string or a
// missing file makes the package uninstallable — 1.8.0 first shipped with `?v=` on its styles.
describe("the shipped manifest's included files", () => {
	const included = ReleaseManifest.from(shipped).includedFiles;

	it("are plain paths", () => {
		for (const path of included) expect(path, `${path} is not a plain path`).not.toMatch(/[?#]/);
	});

	// dist/ is built after `npm test` in the release workflow; stamp-manifest checks it there.
	it("exist on disk", () => {
		for (const path of included.filter(path => !path.startsWith("dist/"))) {
			expect(existsSync(new URL(`../../../${path}`, import.meta.url)), `${path} is not a file`).toBe(true);
		}
	});
});
