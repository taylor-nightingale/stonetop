const VALUE_FLAGS = { "--repository": "repository", "--tag": "tag" };

// How a publish run was asked for: workflow environment by default, overridable on the
// command line for local dry runs.
export class PublishOptions {
	constructor({ repository, tag, token, dryRun }) {
		this.repository = repository;
		this.tag = tag;
		this.token = token;
		this.dryRun = dryRun;
	}

	static from(argv = [], env = {}) {
		const overrides = {};
		let dryRun = false;
		for (let i = 0; i < argv.length; i++) {
			const [flag, inlineValue] = argv[i].split(/=(.*)/s);
			if (flag === "--dry-run") {
				dryRun = true;
			} else if (VALUE_FLAGS[flag]) {
				overrides[VALUE_FLAGS[flag]] = inlineValue ?? argv[++i];
			} else {
				throw new Error(`Unknown argument ${argv[i]}. Usage: publish-to-foundry.js [--dry-run] [--repository owner/name] [--tag 1.2.3]`);
			}
		}
		return new PublishOptions({
			repository: overrides.repository ?? env.GITHUB_REPOSITORY,
			tag: overrides.tag ?? env.GITHUB_REF_NAME,
			token: env.FOUNDRY_PACKAGE_TOKEN,
			dryRun,
		});
	}
}
