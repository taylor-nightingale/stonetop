import { FoundryReleaseResult } from "./FoundryReleaseResult.js";

export const RELEASE_ENDPOINT = "https://foundryvtt.com/_api/packages/release_version/";

// Client for foundryvtt.com's package release API.
// https://foundryvtt.com/article/package-release-api/
export class FoundryPackageApi {
	#token;

	constructor({ token, fetch = globalThis.fetch } = {}) {
		if (!token) throw new Error("No package token: set FOUNDRY_PACKAGE_TOKEN to the token on the package's foundryvtt.com edit page.");
		this.#token = token;
		this.fetch = fetch;
	}

	async publish(release, { dryRun = false } = {}) {
		const response = await this.fetch(RELEASE_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: this.#token },
			body: JSON.stringify(release.toRequestBody({ dryRun })),
		});
		const body = await this.#readBody(response);
		if (!response.ok) throw new Error(this.#failureMessage(response, body));
		return FoundryReleaseResult.fromResponseBody(body);
	}

	async #readBody(response) {
		const text = await response.text();
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	#failureMessage(response, body) {
		const parts = [`Foundry rejected the release (HTTP ${response.status}).`];
		const retryAfter = response.headers?.get?.("retry-after");
		if (retryAfter) parts.push(`Only one release per package per minute is allowed; retry after ${retryAfter}s.`);
		const details = this.#details(body);
		if (details) parts.push(details);
		return parts.join(" ");
	}

	#details(body) {
		if (typeof body === "string") return body.trim().slice(0, 500);
		if (!body?.errors) return body ? JSON.stringify(body) : "";
		return Object.entries(body.errors)
			.map(([field, errors]) => {
				const messages = [errors].flat().map((error) => (typeof error === "string" ? error : error.message ?? error.code)).join("; ");
				return field === "__all__" ? messages : `${field}: ${messages}`;
			})
			.join(" | ");
	}
}
