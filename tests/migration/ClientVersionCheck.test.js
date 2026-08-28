import { describe, it, expect } from "vitest";
import { ClientVersionCheck } from "../../src/migration/ClientVersionCheck.js";

// Foundry gives a system's esmodules an unversioned URL, so a browser can hold the previous release's
// JavaScript in cache indefinitely — while templates, which are never cached, arrive fresh over the
// socket. The mismatch is invisible from inside the running code: it is perfectly valid code, just the
// previous release's, which is why it has to be detected against the version the server reports.

const check = (loaded, installed) => new ClientVersionCheck(loaded, installed);

describe("ClientVersionCheck.isStale", () => {
	it("is not stale when the cached code matches the install", () => {
		expect(check("1.4.0", "1.4.0").isStale).toBe(false);
	});

	it("is stale when the server has been updated past the cached code", () => {
		expect(check("1.3.2", "1.4.0").isStale).toBe(true);
	});

	// A downgrade breaks a client exactly as badly as an upgrade: the code and the templates on disk
	// disagree, and which one is newer makes no difference to the sheet that fails to render.
	it("is stale when the cached code is newer than the install", () => {
		expect(check("1.4.0", "1.3.2").isStale).toBe(true);
	});

	// Locking every user out of a world that is probably fine is worse than missing a stale client.
	it("says nothing when the world reports no version to compare against", () => {
		expect(check("1.4.0", undefined).isStale).toBe(false);
		expect(check("1.4.0", "").isStale).toBe(false);
	});
});
