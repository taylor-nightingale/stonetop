import { describe, it, expect } from "vitest";
import { InstalledArtReader } from "../../src/art/InstalledArtReader.js";

// Reads a world's installed artwork by store-relative path. Asks the folder before fetching, so art
// that was never installed (Book I is optional) costs a listing rather than a 404 per image.

const picker = folders => {
	const calls = [];
	return { calls, browse: async (source, dir) => {
		calls.push(dir);
		if (!(dir in folders)) throw new Error("does not exist");
		return { files: folders[dir].map(name => `${dir}/${name}`) };
	} };
};

const fetcher = (bodies) => {
	const calls = [];
	const fn = async (url, init) => {
		calls.push({ url, init });
		const body = bodies[url];
		return body ? { ok: true, arrayBuffer: async () => body.buffer } : { ok: false };
	};
	fn.calls = calls;
	return fn;
};

const url = path => `/data/${path}`;

describe("InstalledArtReader", () => {
	it("reads an installed file's bytes", async () => {
		const fetch = fetcher({ "/data/stonetop-art/arcana/mindgem.png": new Uint8Array([1, 2, 3]) });
		const reader = new InstalledArtReader({ picker: picker({ "stonetop-art/arcana": ["mindgem.png"] }), fetch, url });
		expect([...await reader.read("arcana/mindgem.png")]).toEqual([1, 2, 3]);
	});

	// The file is about to be rewritten in place; a cached copy would be judged instead of the real one.
	it("reads past the browser's cache", async () => {
		const fetch = fetcher({ "/data/stonetop-art/arcana/mindgem.png": new Uint8Array([1]) });
		await new InstalledArtReader({ picker: picker({ "stonetop-art/arcana": ["mindgem.png"] }), fetch, url }).read("arcana/mindgem.png");
		expect(fetch.calls[0].init).toEqual({ cache: "reload" });
	});

	it("is null for a file its folder does not hold, without fetching it", async () => {
		const fetch = fetcher({});
		const reader = new InstalledArtReader({ picker: picker({ "stonetop-art/arcana": ["ring-of-daagon.png"] }), fetch, url });
		expect(await reader.read("arcana/mindgem.png")).toBeNull();
		expect(fetch.calls).toEqual([]);
	});

	it("is null when the folder does not exist", async () => {
		const reader = new InstalledArtReader({ picker: picker({}), fetch: fetcher({}), url });
		expect(await reader.read("steading/seasons.png")).toBeNull();
	});

	it("is null when the fetch fails", async () => {
		const reader = new InstalledArtReader({ picker: picker({ "stonetop-art/arcana": ["mindgem.png"] }), fetch: fetcher({}), url });
		expect(await reader.read("arcana/mindgem.png")).toBeNull();
	});

	it("lists each folder once", async () => {
		const p = picker({ "stonetop-art/arcana": ["a.png", "b.png"] });
		const reader = new InstalledArtReader({ picker: p, fetch: fetcher({}), url });
		await reader.read("arcana/a.png");
		await reader.read("arcana/b.png");
		expect(p.calls).toEqual(["stonetop-art/arcana"]);
	});
});
