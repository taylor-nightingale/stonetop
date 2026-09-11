import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dropAuthoringKeys, packTransform, stampPackVersion } from "../../scripts/compendium-pack/pack.js";
import { PACK_VERSION_FLAG } from "../../src/migration/PackVersionCheck.js";

const root = join(import.meta.dirname, "../..");

// The stamp is what lets a running system notice it is reading a compendium built by a different
// release. It is applied at compile time only — `packs/src` is the committed source and must stay free
// of it, or every version bump would be a diff across every pack file.
describe("stampPackVersion", () => {
	it("stamps the building system's version onto a document", () => {
		const doc = { _id: "x", name: "Hec’tumel Codex" };
		stampPackVersion("1.0.3")(doc);
		expect(doc.flags.stonetop[PACK_VERSION_FLAG]).toBe("1.0.3");
	});

	it("keeps the flags a document already carries", () => {
		const doc = { _id: "x", flags: { stonetop: { grant: { source: "playbook:the-blessed" } }, core: { sourceId: "y" } } };
		stampPackVersion("1.0.3")(doc);
		expect(doc.flags.stonetop.grant).toEqual({ source: "playbook:the-blessed" });
		expect(doc.flags.core).toEqual({ sourceId: "y" });
	});

	it("overwrites a stamp left by an earlier build", () => {
		const doc = { flags: { stonetop: { [PACK_VERSION_FLAG]: "0.14.0" } } };
		stampPackVersion("1.0.3")(doc);
		expect(doc.flags.stonetop[PACK_VERSION_FLAG]).toBe("1.0.3");
	});

	// Returning false would make compilePack skip the entry entirely.
	it("never rejects the entry", () => {
		expect(stampPackVersion("1.0.3")({})).not.toBe(false);
	});

	it("stamps the version the manifest declares", () => {
		const doc = {};
		const version = JSON.parse(readFileSync(join(root, "system.json"), "utf8")).version;
		stampPackVersion(version)(doc);
		expect(doc.flags.stonetop[PACK_VERSION_FLAG]).toBe(version);
	});
});

// `_prose` is the book's own payoff sentence, kept beside the effects modelled from it so the review
// can check one against the other. It is for whoever edits the source; Foundry has no field for it.
describe("dropAuthoringKeys", () => {
	it("drops the authoring keys", () => {
		const doc = { name: "Market", _prose: ["When you meet the requirements…"], _review: "check the box" };
		dropAuthoringKeys(doc);
		expect(doc).toEqual({ name: "Market" });
	});

	it("leaves a document that carries none of them alone", () => {
		const doc = { name: "Market", system: { slug: "market" } };
		dropAuthoringKeys(doc);
		expect(doc).toEqual({ name: "Market", system: { slug: "market" } });
	});
});

describe("packTransform", () => {
	it("stamps the version and drops the authoring keys in one pass", () => {
		const doc = { name: "Market", _prose: ["…"] };
		packTransform("1.0.3")(doc);
		expect(doc.flags.stonetop[PACK_VERSION_FLAG]).toBe("1.0.3");
		expect(doc._prose).toBeUndefined();
	});

	it("never rejects the entry", () => {
		expect(packTransform("1.0.3")({})).not.toBe(false);
	});
});
