export interface OmniTokenUsage {
	input: number;
	output: number;
	total: number;
}

export interface OmniUsage {
	totalCostUsd?: number;
	durationMs?: number;
	tokens?: OmniTokenUsage;
	numTurns?: number;
}
