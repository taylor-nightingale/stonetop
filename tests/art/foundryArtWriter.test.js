import { describe, it, expect } from "vitest";
import { FoundryArtWriter } from "../../src/art/FoundryArtWriter.js";
import { FoundArt } from "../../src/art/BookArtExtractor.js";

const stubFilePicker = ({ failCreate } = {}) => {
	const calls = { createDirectory: [], upload: [] };
	return {
		calls,
		createDirectory: async (source, path) => {
			calls.createDirectory.push({ source, path });
			if (failCreate) throw new Error(failCreate);
		},
		upload: async (source, dir, file, body, options) => {
			calls.upload.push({ source, dir, name: file.name, type: file.type, options });
		},
	};
};

const arts = [
	new FoundArt("wonders/aa.png", new Uint8Array([1])),
	new FoundArt("wonders/bb.png", new Uint8Array([2])),
	new FoundArt("arcana/mindgem.png", new Uint8Array([3])),
];

describe("FoundryArtWriter", () => {
	it("creates the store directories once and uploads each file to its folder", async () => {
		const fp = stubFilePicker();
		await new FoundryArtWriter(fp).write(arts);

		expect(fp.calls.createDirectory.map((c) => c.path)).toEqual([
			"stonetop-art",
			"stonetop-art/arcana",
			"stonetop-art/wonders",
		]);
		expect(fp.calls.upload).toEqual([
			{ source: "data", dir: "stonetop-art/wonders", name: "aa.png", type: "image/png", options: { notify: false } },
			{ source: "data", dir: "stonetop-art/wonders", name: "bb.png", type: "image/png", options: { notify: false } },
			{ source: "data", dir: "stonetop-art/arcana", name: "mindgem.png", type: "image/png", options: { notify: false } },
		]);
	});

	it("ignores already-existing directories but surfaces other failures", async () => {
		await expect(
			new FoundryArtWriter(stubFilePicker({ failCreate: "EEXIST: file already exists" })).write(arts),
		).resolves.toBeUndefined();
		await expect(
			new FoundryArtWriter(stubFilePicker({ failCreate: "You lack permission to create directories" })).write(arts),
		).rejects.toThrow(/permission/);
	});
});
