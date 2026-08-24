// What the bulk "create missing actors" pass would do to one person, so the GM sees it before any
// document is written.
export class PersonActorPlan {
	static CREATE   = "create";
	static LINK     = "link";
	static LINKED   = "linked";
	static UNNAMED  = "unnamed";

	constructor(name, location, action) {
		this.name     = name;
		this.location = location;
		this.action   = action;
	}

	get willCreate() { return this.action === PersonActorPlan.CREATE; }
	get willLink()   { return this.action === PersonActorPlan.LINK; }
}
