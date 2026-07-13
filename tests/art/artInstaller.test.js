import { describe, it, expect } from "vitest";
import { ArtInstaller, InstallReport } from "../../src/art/ArtInstaller.js";
import { FoundArt } from "../../src/art/BookArtExtractor.js";
import { ArtManifest } from "../../src/art/ArtManifest.js";

const manifest = ArtManifest.fromJson({
	entries: [
		{ path: "wonders/a.png", key: "ka" },
		{ path: "arcana/b.png", key: "kb" },
		{ path: "steading/c.png", key: "kc" },
	],
});

// Extractor stub: yields a scripted result per extract() call and emits one progress tick.
const stubExtractor = (resultsPerCall) => {
	let call = 0;
	return {
		extract: async (_data, { onProgress } = {}) => {
			onProgress?.({ page: 1, pages: 2, found: 0 });
			return { found: resultsPerCall[call++], pages: 2, imagesSeen: 5 };
		},
	};
};
const recordingWriter = () => {
	const written = [];
	return { written, write: async (arts) => written.push(...arts) };
};

describe("ArtInstaller", () => {
	it("merges finds across books, writes once, and reports the remainder", async () => {
		const writer = recordingWriter();
		const installer = new ArtInstaller(
			stubExtractor([
				[new FoundArt("wonders/a.png", new Uint8Array([1])), new FoundArt("arcana/b.png", new Uint8Array([2]))],
				[new FoundArt("arcana/b.png", new Uint8Array([9]))], // duplicate from book two — first wins
			]),
			writer,
			manifest,
		);
		const report = await installer.install([new Uint8Array(), new Uint8Array()]);

		expect(writer.written.map((a) => a.path).sort()).toEqual(["arcana/b.png", "wonders/a.png"]);
		expect(writer.written.find((a) => a.path === "arcana/b.png").bytes).toEqual(new Uint8Array([2]));
		expect(report.installed).toEqual(["arcana/b.png", "wonders/a.png"]);
		expect(report.missing).toEqual(["steading/c.png"]);
		expect(report.complete).toBe(false);
	});

	it("is complete when every manifest path was found", async () => {
		const installer = new ArtInstaller(
			stubExtractor([[
				new FoundArt("wonders/a.png", new Uint8Array()),
				new FoundArt("arcana/b.png", new Uint8Array()),
				new FoundArt("steading/c.png", new Uint8Array()),
			]]),
			recordingWriter(),
			manifest,
		);
		const report = await installer.install([new Uint8Array()]);
		expect(report.complete).toBe(true);
		expect(report.missing).toEqual([]);
	});

	it("forwards progress with file counts", async () => {
		const seen = [];
		const installer = new ArtInstaller(stubExtractor([[], []]), recordingWriter(), manifest);
		await installer.install([new Uint8Array(), new Uint8Array()], { onProgress: (p) => seen.push(p) });
		expect(seen).toEqual([
			{ file: 1, files: 2, page: 1, pages: 2, found: 0 },
			{ file: 2, files: 2, page: 1, pages: 2, found: 0 },
		]);
	});
});

describe("InstallReport", () => {
	it("exposes completeness", () => {
		expect(new InstallReport(["x"], []).complete).toBe(true);
		expect(new InstallReport([], ["y"]).complete).toBe(false);
	});
});
