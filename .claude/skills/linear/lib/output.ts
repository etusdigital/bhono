import { spawn } from "child_process";

/**
 * Check if --json flag is present in command line arguments
 */
export function hasJsonFlag(): boolean {
	return process.argv.includes("--json");
}

/**
 * Output data with jq formatting if available and --json flag is not set.
 * If --json flag is present, outputs clean JSON without jq or messages.
 */
export function outputWithJq(data: unknown): void {
	const jsonString = JSON.stringify(data, null, 2);

	// If --json flag is present, output clean JSON and exit
	if (hasJsonFlag()) {
		console.log(jsonString);
		return;
	}

	// Check if jq is available
	const jq = spawn("jq", ["."], { stdio: ["pipe", "inherit", "inherit"] });

	jq.on("error", () => {
		// jq not available, fallback to plain JSON
		console.log(jsonString);
		console.error("\nNote: Install jq for colorized output: brew install jq");
	});

	jq.stdin.write(jsonString);
	jq.stdin.end();
}
