import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

export interface LinearConfig {
	user: {
		id: string;
		name: string;
		email: string;
	};
	defaults: {
		teamId: string;
		teamName: string;
		teamKey: string;
		projectId: string | null;
		projectName: string | null;
		autoAssign: boolean;
	};
	setupDate: string;
}

/**
 * Load Linear configuration from .claude/linear-config.json
 * Returns null if file doesn't exist or is invalid
 */
export function loadConfigIfExists(): LinearConfig | null {
	try {
		// Get the project root by going up from .claude/skills/linear/lib/
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up: lib/ -> linear/ -> skills/ -> .claude/ -> project root
		const projectRoot = resolve(__dirname, "../../../..");
		const configPath = resolve(projectRoot, ".claude/linear-config.json");

		if (!existsSync(configPath)) {
			return null;
		}

		const configContent = readFileSync(configPath, "utf-8");
		const config = JSON.parse(configContent) as LinearConfig;

		// Validate required fields
		if (!config.defaults?.teamId) {
			console.warn(
				"Warning: Invalid config file - missing defaults.teamId"
			);
			return null;
		}

		return config;
	} catch (error) {
		// Silently return null on any error (file doesn't exist, invalid JSON, etc.)
		return null;
	}
}

/**
 * Load Linear configuration or exit with error
 * Use this when config is required
 */
export function loadConfigOrExit(): LinearConfig {
	const config = loadConfigIfExists();

	if (!config) {
		console.error("Error: Linear configuration not found");
		console.error("");
		console.error("Please run the setup first:");
		console.error("  /linear:setup");
		console.error("");
		console.error("Or use explicit parameters (see --help)");
		process.exit(1);
	}

	return config;
}

/**
 * Get team ID from arguments or config
 * @param argIndex - The process.argv index where teamId should be
 * @returns teamId or exits with error
 */
export function getTeamIdOrExit(argIndex: number): string {
	let teamId = process.argv[argIndex];

	// If argument is a flag (starts with --) or undefined, try to use config
	if (!teamId || teamId.startsWith("--")) {
		const config = loadConfigIfExists();
		teamId = config?.defaults?.teamId;

		if (!teamId) {
			console.error("Error: No team ID provided");
			console.error("");
			console.error("Option 1: Provide team ID explicitly");
			console.error("  Example: npx tsx script.ts <teamId>");
			console.error("");
			console.error("Option 2: Run setup to configure defaults");
			console.error("  /linear:setup");
			process.exit(1);
		}

		console.error(`ℹ️  Using team from config: ${config.defaults.teamName}`);
	}

	return teamId;
}
