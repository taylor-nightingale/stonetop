export class Resource {
	constructor(data) {
		this.max     = data.max     ?? null;
		this.maxStat = data.maxStat ?? null;
		this.title   = data.title   ?? null;
		this.labels  = data.labels  ?? [];
	}
}
