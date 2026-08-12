// Foundry fetches the submitted manifest URL while validating a release, so the tagged
// release asset has to be readable before we post. GitHub can take a moment to serve a
// freshly uploaded asset, hence the retries.
export class ManifestProbe {
	constructor({ fetch = globalThis.fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), attempts = 6, delayMs = 5000 } = {}) {
		this.fetch = fetch;
		this.sleep = sleep;
		this.attempts = attempts;
		this.delayMs = delayMs;
	}

	async waitFor(url) {
		for (let attempt = 1; attempt <= this.attempts; attempt++) {
			if (await this.#isPublished(url)) return;
			if (attempt < this.attempts) await this.sleep(this.delayMs);
		}
		throw new Error(`${url} was still unreachable after ${this.attempts} attempts; Foundry could not have fetched it either.`);
	}

	async #isPublished(url) {
		try {
			return (await this.fetch(url)).ok;
		} catch {
			return false;
		}
	}
}
