// Announces a published GitHub release to foundryvtt.com so the package page lists it.
// Run from the release workflow after the tagged assets are uploaded; system.json is read
// from the working tree, which by then carries the patched download URL.
//
//   FOUNDRY_PACKAGE_TOKEN=... npm run publish:foundry -- --dry-run --tag 1.0.1
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FoundryPackageApi } from "./FoundryPackageApi.js";
import { FoundryRelease } from "./FoundryRelease.js";
import { ManifestProbe } from "./ManifestProbe.js";
import { PublishOptions } from "./PublishOptions.js";

async function main() {
	const options = PublishOptions.from(process.argv.slice(2), process.env);
	const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "../..", "system.json");
	const release = FoundryRelease.fromManifest(JSON.parse(readFileSync(manifestPath, "utf8")), options);
	const api = new FoundryPackageApi({ token: options.token });

	console.log(`Waiting for ${release.manifestUrl}`);
	await new ManifestProbe().waitFor(release.manifestUrl);

	console.log(`Publishing ${release.id} ${release.version}${options.dryRun ? " (dry run)" : ""} to foundryvtt.com`);
	const result = await api.publish(release, { dryRun: options.dryRun });
	console.log(result.message ?? `Released. Package page: ${result.page}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
