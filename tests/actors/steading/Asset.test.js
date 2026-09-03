import { describe, it, expect } from "vitest";
import { Asset } from "../../../src/actors/steading/Asset.js";

describe("Asset", () => {
	it("is at home to begin with", () => {
		expect(Asset.blank().requisitioned).toBe(false);
		expect(Asset.blank().text).toBe("");
	});

	it("withText replaces the sentence and keeps the state", () => {
		const out = new Asset("A wagon", true).withText("A cart");
		expect(out.text).toBe("A cart");
		expect(out.requisitioned).toBe(true);
	});

	it("withRequisitioned flips the state and keeps the sentence", () => {
		const out = new Asset("A wagon").withRequisitioned(true);
		expect(out.text).toBe("A wagon");
		expect(out.requisitioned).toBe(true);
	});

	it("does not mutate the asset it was asked about", () => {
		const asset = new Asset("A wagon");
		asset.withRequisitioned(true);
		expect(asset.requisitioned).toBe(false);
	});

	it("fromRaw round-trips a stored asset", () => {
		const asset = Asset.fromRaw({ text: "A wagon", requisitioned: true });
		expect(asset).toBeInstanceOf(Asset);
		expect(asset.text).toBe("A wagon");
		expect(asset.requisitioned).toBe(true);
	});

	it("fromRaw defaults a missing state to at home", () => {
		expect(Asset.fromRaw({ text: "A wagon" }).requisitioned).toBe(false);
	});
});
