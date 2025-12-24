import { LinearClient } from "@linear/sdk";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Load Linear API key from multiple sources in order of priority:
 * 1. Environment variable LINEAR_API_KEY (system-wide)
 * 2. ~/.linear/credentials file
 * 3. .env file in project root
 */
function loadLinearApiKey(): string {
	// Priority 1: System environment variable
	if (process.env.LINEAR_API_KEY) {
		return process.env.LINEAR_API_KEY;
	}

	// Priority 2: ~/.linear/credentials file
	const credentialsPath = join(homedir(), ".linear", "credentials");
	if (existsSync(credentialsPath)) {
		try {
			const credentials = readFileSync(credentialsPath, "utf-8").trim();
			if (credentials) {
				return credentials;
			}
		} catch (error) {
			// Ignore read errors and continue to next source
		}
	}

	// Priority 3: .env file in project root
	dotenv.config();
	if (process.env.LINEAR_API_KEY) {
		return process.env.LINEAR_API_KEY;
	}

	// No API key found in any source
	throw new Error(
		"LINEAR_API_KEY not found. Please set it via:\n" +
			"  1. Environment variable: export LINEAR_API_KEY=your_key\n" +
			"  2. Credentials file: ~/.linear/credentials\n" +
			"  3. Project .env file\n\n" +
			"Run 'npx tsx scripts/setup-credentials.ts' to configure."
	);
}

const LINEAR_API_KEY = loadLinearApiKey();

// Create and export a shared Linear client instance
export const client = new LinearClient({ apiKey: LINEAR_API_KEY });
