import { describe, expect, it, vi } from "vitest";
import { FakeFetch } from "../../fakes/FakeFetch.js";
import { ManifestProbe } from "../../../scripts/release/ManifestProbe.js";

const URL = "https://github.com/owner/name/releases/download/1.0.1/system.json";

function aProbe(fetch, sleep, attempts = 3) {
	return new ManifestProbe({ fetch: fetch.handler, sleep, attempts, delayMs: 5000 });
}

describe("ManifestProbe", () => {
	it("returns without sleeping when the manifest is already published", async () => {
		const fetch = new FakeFetch().respondJson({ id: "stonetop" });
		const sleep = vi.fn();

		await aProbe(fetch, sleep).waitFor(URL);

		expect(fetch.calls).toHaveLength(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it("retries until the release asset appears", async () => {
		const fetch = new FakeFetch().respondStatus(404).respondStatus(404).respondJson({ id: "stonetop" });
		const sleep = vi.fn();

		await aProbe(fetch, sleep).waitFor(URL);

		expect(fetch.calls).toHaveLength(3);
		expect(sleep).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(5000);
	});

	it("gives up after the configured attempts, naming the URL", async () => {
		const fetch = new FakeFetch().respondStatus(404).respondStatus(404).respondStatus(404);
		const sleep = vi.fn();

		await expect(aProbe(fetch, sleep).waitFor(URL)).rejects.toThrow(URL);
		expect(fetch.calls).toHaveLength(3);
	});

	it("treats a network failure as another failed attempt", async () => {
		const fetch = new FakeFetch().respondJson({ id: "stonetop" });
		const sleep = vi.fn();

		// FakeFetch throws when its queue runs dry, standing in for a connection error.
		const probe = new ManifestProbe({
			fetch: async (url, init) => {
				if (fetch.calls.length === 0) {
					fetch.calls.push(url);
					throw new Error("ECONNRESET");
				}
				return fetch.handler(url, init);
			},
			sleep,
			attempts: 3,
			delayMs: 1,
		});

		await probe.waitFor(URL);

		expect(sleep).toHaveBeenCalledTimes(1);
	});
});
