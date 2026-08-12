import { describe, expect, it } from "vitest";
import { FakeFetch } from "../../fakes/FakeFetch.js";
import { FoundryPackageApi, RELEASE_ENDPOINT } from "../../../scripts/release/FoundryPackageApi.js";
import { FoundryRelease } from "../../../scripts/release/FoundryRelease.js";

const TOKEN = "fvttp_secrettoken";

function aRelease() {
	return FoundryRelease.fromManifest(
		{ id: "stonetop", version: "1.0.1", compatibility: { minimum: "13", verified: "14" } },
		{ repository: "taylor-nightingale/stonetop", tag: "1.0.1" },
	);
}

function anApi(fetch) {
	return new FoundryPackageApi({ token: TOKEN, fetch: fetch.handler });
}

describe("FoundryPackageApi", () => {
	it("refuses to build without a token", () => {
		expect(() => new FoundryPackageApi({ token: "" })).toThrow(/FOUNDRY_PACKAGE_TOKEN/);
	});

	it("posts the release to the documented endpoint with the token as Authorization", async () => {
		const fetch = new FakeFetch().respondJson({ status: "success", page: "https://foundryvtt.com/packages/stonetop/edit/" });

		await anApi(fetch).publish(aRelease());

		const call = fetch.lastCall;
		expect(call.url).toBe(RELEASE_ENDPOINT);
		expect(call.method).toBe("POST");
		expect(call.header("Authorization")).toBe(TOKEN);
		expect(call.header("Content-Type")).toBe("application/json");
		expect(call.json()).toMatchObject({ id: "stonetop", release: { version: "1.0.1" } });
	});

	it("returns the package page from a successful response", async () => {
		const fetch = new FakeFetch().respondJson({ status: "success", page: "https://foundryvtt.com/packages/stonetop/edit/" });

		const result = await anApi(fetch).publish(aRelease());

		expect(result.page).toBe("https://foundryvtt.com/packages/stonetop/edit/");
	});

	it("passes the dry-run flag through and reports the dry-run message", async () => {
		const fetch = new FakeFetch().respondJson({ status: "success", page: "p", message: "Dry run completed successfully." });

		const result = await anApi(fetch).publish(aRelease(), { dryRun: true });

		expect(fetch.lastCall.json()["dry-run"]).toBe(true);
		expect(result.message).toBe("Dry run completed successfully.");
	});

	it("surfaces field-level validation errors from a 400", async () => {
		const fetch = new FakeFetch().respondJson({
			status: "error",
			errors: { __all__: [{ code: "unique_together", message: "Package version already exists." }] },
		}, { status: 400 });

		await expect(anApi(fetch).publish(aRelease()))
			.rejects.toThrow(/Package version already exists\./);
	});

	it("names the offending field when the error is not package-wide", async () => {
		const fetch = new FakeFetch().respondJson({
			errors: { manifest: [{ code: "invalid", message: "Manifest URL could not be fetched." }] },
		}, { status: 400 });

		await expect(anApi(fetch).publish(aRelease()))
			.rejects.toThrow(/manifest.*Manifest URL could not be fetched\./);
	});

	it("reports how long to wait when rate limited", async () => {
		const fetch = new FakeFetch().respondJson({ status: "error" }, { status: 429, headers: { "retry-after": "60" } });

		await expect(anApi(fetch).publish(aRelease())).rejects.toThrow(/429.*60/s);
	});

	it("still fails clearly when the error body is not JSON", async () => {
		const fetch = new FakeFetch().respondText("<html>502 Bad Gateway</html>", { status: 502 });

		await expect(anApi(fetch).publish(aRelease())).rejects.toThrow(/502/);
	});

	it("keeps the token out of failure messages", async () => {
		const fetch = new FakeFetch().respondJson({ errors: { __all__: [{ message: "nope" }] } }, { status: 400 });

		await expect(anApi(fetch).publish(aRelease())).rejects.toThrow(
			expect.not.stringContaining(TOKEN),
		);
	});
});
