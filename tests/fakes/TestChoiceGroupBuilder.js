export class TestChoiceGroupBuilder {
	_slug;
	_choices = [];

	withSlug(slug) {
		this._slug = slug;
		return this;
	}

	addChoice(choiceBuilder) {
		this._choices.push(choiceBuilder.build());
		return this;
	}

	build() {
		return {
			slug: this._slug,
			list: this._choices
		}
	}
}
