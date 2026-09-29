// Rewrites system.json in the working tree into the manifest this release ships: the download URL
// pointed at the tagged zip, and every stylesheet stamped with the version it belongs to.
//
// Run from the release workflow between the build and the zip, so the manifest inside the zip and
// the one uploaded beside it are the same file. The working tree is never committed from there.
//
//   GITHUB_REPOSITORY=owner/name GITHUB_REF_NAME=1.2.3 npm run release:stamp
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GitHubRelease } from "./GitHubRelease.js";
import { PublishOptions } from "./PublishOptions.js";
import { ReleaseManifest } from "./ReleaseManifest.js";

// The name the workflow's zip step writes, and so the asset the release serves.
const PACKAGE_ZIP = "stonetop.zip";

function main() {
	const release = GitHubRelease.from(PublishOptions.from(process.argv.slice(2), process.env));
	const path = join(dirname(fileURLToPath(import.meta.url)), "../..", "system.json");

	const manifest = ReleaseManifest.from(JSON.parse(readFileSync(path, "utf8")))
		.withDownloadUrl(release.assetUrl(PACKAGE_ZIP))
		.withVersionedStyles();

	writeFileSync(path, `${JSON.stringify(manifest.toJSON(), null, "\t")}\n`);
	console.log(`Stamped system.json for ${release.tag}: ${manifest.styles.length} stylesheets at v=${manifest.version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
