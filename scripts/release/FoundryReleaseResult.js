// What foundryvtt.com reports back about an accepted release.
export class FoundryReleaseResult {
	constructor({ page, message }) {
		this.page = page;
		this.message = message;
	}

	static fromResponseBody(body) {
		return new FoundryReleaseResult({ page: body?.page, message: body?.message });
	}
}
