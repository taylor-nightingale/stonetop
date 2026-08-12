import { describe, expect, it } from "vitest";
import { PublishOptions } from "../../../scripts/release/PublishOptions.js";

const env = {
	GITHUB_REPOSITORY: "taylor-nightingale/stonetop",
	GITHUB_REF_NAME: "1.0.1",
	FOUNDRY_PACKAGE_TOKEN: "fvttp_token",
};

describe("PublishOptions.from", () => {
	it("reads the release from the workflow environment", () => {
		const options = PublishOptions.from([], env);

		expect(options.repository).toBe("taylor-nightingale/stonetop");
		expect(options.tag).toBe("1.0.1");
		expect(options.token).toBe("fvttp_token");
		expect(options.dryRun).toBe(false);
	});

	it("takes --dry-run", () => {
		expect(PublishOptions.from(["--dry-run"], env).dryRun).toBe(true);
	});

	it.each([
		["--tag=2.0.0", "2.0.0"],
		["--tag 2.0.0", "2.0.0"],
	])("lets %s override the environment", (argv, expected) => {
		expect(PublishOptions.from(argv.split(" "), env).tag).toBe(expected);
	});

	it("lets --repository override the environment", () => {
		expect(PublishOptions.from(["--repository", "fork/stonetop"], env).repository).toBe("fork/stonetop");
	});

	it("rejects an unknown flag rather than silently ignoring it", () => {
		expect(() => PublishOptions.from(["--dryrun"], env)).toThrow(/--dryrun/);
	});
});
