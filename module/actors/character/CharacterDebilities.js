export class CharacterDebilities {
	constructor(actor) {
		this._actor = actor;
	}

	async setDebility(slug, value) {
		await this._actor.update({
			[`system.attributes.debilities.options.${slug}.value`]: value,
		});
	}
}
