// Foundry-side wiring for the artwork installer: loads the vendored pdf.js and
// the shipped art manifest, and composes the extractor/writer/installer stack.
// All logic lives in the composed classes — this module only knows the URLs and
// which Foundry APIs to hand them.
import { ArtManifest } from "./ArtManifest.js";
import { BookArtExtractor } from "./BookArtExtractor.js";
import { ArtInstaller } from "./ArtInstaller.js";
import { FoundryArtWriter } from "./FoundryArtWriter.js";

/** The active FilePicker implementation (v13 namespace, with a legacy fallback). */
function filePicker() {
	return foundry.applications?.apps?.FilePicker?.implementation
		?? foundry.applications?.apps?.FilePicker
		?? globalThis.FilePicker;
}

const route = (path) => foundry.utils.getRoute(path);

let pdfjsPromise = null;
function loadPdfjs() {
	pdfjsPromise ??= (async () => {
		const pdfjs = await import("../../lib/pdfjs/pdf.mjs");
		pdfjs.GlobalWorkerOptions.workerSrc = route("systems/stonetop/lib/pdfjs/pdf.worker.mjs");
		return pdfjs;
	})();
	return pdfjsPromise;
}

let manifestPromise = null;
function loadArtManifest() {
	manifestPromise ??= foundry.utils
		.fetchJsonWithTimeout(route("systems/stonetop/art-manifest.json"))
		.then(ArtManifest.fromJson);
	return manifestPromise;
}

/** Build a ready-to-run installer for the current world. */
export async function createArtInstaller() {
	const [pdfjs, manifest] = await Promise.all([loadPdfjs(), loadArtManifest()]);
	const extractor = new BookArtExtractor(pdfjs, manifest, {
		// getRoute strips trailing slashes; pdf.js requires one on factory URLs.
		wasmUrl: route("systems/stonetop/lib/pdfjs/wasm") + "/",
	});
	return new ArtInstaller(extractor, new FoundryArtWriter(filePicker()), manifest);
}

/**
 * Whether book artwork is already present in this world's data. The wonders
 * folder is the proxy: every install path populates it (Book II is the required
 * book), and it never exists otherwise.
 */
export async function isArtInstalled(picker = filePicker()) {
	try {
		const result = await picker.browse("data", "stonetop-art/wonders");
		return (result?.files?.length ?? 0) > 0;
	} catch {
		return false; // browse throws when the directory doesn't exist
	}
}
