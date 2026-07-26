// The vendored pdf.js calls Uint8Array#toHex / #toBase64 / Uint8Array.fromBase64,
// which some engines (older Electron/Chromium) haven't shipped. vendor-deps prepends
// the es-shims polyfill, bundled by build-uint8-array-polyfill.js. This runs that exact
// bundle with the four native methods removed (the broken client's world) and confirms
// the shimmed versions install and encode correctly.
import { describe, it, expect, beforeAll } from "vitest";
import vm from "node:vm";
import { buildUint8ArrayPolyfill } from "../../scripts/build-uint8-array-polyfill.js";

let bundle;
beforeAll(async () => { bundle = await buildUint8ArrayPolyfill(); });

const INSTANCE_METHODS = ["toHex", "toBase64"];
const STATIC_METHODS = ["fromHex", "fromBase64"];
const targetFor = (name) => (INSTANCE_METHODS.includes(name) ? Uint8Array.prototype : Uint8Array);

/** Run the bundle with the four native methods removed, restoring them afterwards. */
function withPolyfillOverStrippedNative(run) {
	const saved = {};
	for (const name of [...INSTANCE_METHODS, ...STATIC_METHODS]) {
		const target = targetFor(name);
		saved[name] = Object.getOwnPropertyDescriptor(target, name);
		delete target[name];
	}
	try {
		vm.runInThisContext(bundle);
		run();
	} finally {
		for (const name of [...INSTANCE_METHODS, ...STATIC_METHODS]) {
			const target = targetFor(name);
			delete target[name];
			if (saved[name]) Object.defineProperty(target, name, saved[name]);
		}
	}
}

describe("bundled Uint8Array hex/base64 polyfill", () => {
	it("installs every method pdf.js needs when they are absent", () => {
		withPolyfillOverStrippedNative(() => {
			expect(typeof Uint8Array.prototype.toHex).toBe("function");
			expect(typeof Uint8Array.prototype.toBase64).toBe("function");
			expect(typeof Uint8Array.fromHex).toBe("function");
			expect(typeof Uint8Array.fromBase64).toBe("function");
		});
	});

	it("toHex renders lowercase, zero-padded bytes — the fingerprint path that crashed", () => {
		withPolyfillOverStrippedNative(() => {
			expect(new Uint8Array([0, 15, 16, 171, 255]).toHex()).toBe("000f10abff");
			expect(new Uint8Array([]).toHex()).toBe("");
		});
	});

	it("toBase64 matches standard base64 with padding", () => {
		withPolyfillOverStrippedNative(() => {
			expect(new Uint8Array([104, 105]).toBase64()).toBe("aGk="); // "hi"
			expect(new Uint8Array([102, 111, 111]).toBase64()).toBe("Zm9v"); // "foo"
			expect(new Uint8Array([255, 255, 255]).toBase64({ alphabet: "base64url" })).toBe("____");
		});
	});

	it("fromHex and fromBase64 round-trip back to the original bytes", () => {
		withPolyfillOverStrippedNative(() => {
			expect(Array.from(Uint8Array.fromHex("000f10abff"))).toEqual([0, 15, 16, 171, 255]);
			expect(Array.from(Uint8Array.fromBase64("aGk="))).toEqual([104, 105]);
			const bytes = new Uint8Array([1, 2, 3, 250, 128, 0]);
			expect(Array.from(Uint8Array.fromBase64(bytes.toBase64()))).toEqual(Array.from(bytes));
		});
	});
});
