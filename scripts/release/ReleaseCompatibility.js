// The compatibility block of a release. Foundry's release API requires minimum and verified
// even though a manifest may omit them.
export class ReleaseCompatibility {
	constructor({ minimum, verified, maximum }) {
		this.minimum = minimum;
		this.verified = verified;
		this.maximum = maximum;
	}

	static fromManifest(compatibility) {
		if (!compatibility?.minimum) throw new Error("system.json is missing compatibility.minimum, which the release API requires.");
		if (!compatibility?.verified) throw new Error("system.json is missing compatibility.verified, which the release API requires.");
		return new ReleaseCompatibility(compatibility);
	}

	toRequestBody() {
		const body = { minimum: this.minimum, verified: this.verified };
		if (this.maximum) body.maximum = this.maximum;
		return body;
	}
}
