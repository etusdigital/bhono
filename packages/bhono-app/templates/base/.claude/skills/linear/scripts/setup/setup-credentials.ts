#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import * as readline from "readline";

async function promptForApiKey(): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(
			"Enter your Linear API key (get it from https://linear.app/settings/api): ",
			(answer) => {
				rl.close();
				resolve(answer.trim());
			}
		);
	});
}

async function main() {
	console.log("🔧 Linear Credentials Setup\n");

	// Check if credentials already exist
	const credentialsDir = join(homedir(), ".linear");
	const credentialsPath = join(credentialsDir, "credentials");

	if (existsSync(credentialsPath)) {
		console.log("⚠️  Credentials file already exists at:");
		console.log(`   ${credentialsPath}\n`);

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		const overwrite = await new Promise<string>((resolve) => {
			rl.question("Do you want to overwrite it? (yes/no): ", (answer) => {
				rl.close();
				resolve(answer.trim().toLowerCase());
			});
		});

		if (overwrite !== "yes" && overwrite !== "y") {
			console.log("\n✅ Setup cancelled. Existing credentials preserved.");
			return;
		}
	}

	// Get API key from user
	const apiKey = await promptForApiKey();

	if (!apiKey) {
		console.error("\n❌ Error: API key cannot be empty");
		process.exit(1);
	}

	// Validate API key format (Linear keys start with lin_api_)
	if (!apiKey.startsWith("lin_api_")) {
		console.warn(
			"\n⚠️  Warning: Linear API keys typically start with 'lin_api_'"
		);
		console.warn("   Make sure you copied the correct key.\n");
	}

	// Create .linear directory if it doesn't exist
	if (!existsSync(credentialsDir)) {
		mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });
	}

	// Write credentials file
	try {
		writeFileSync(credentialsPath, apiKey, { mode: 0o600 });
		console.log("\n✅ Credentials saved successfully!");
		console.log(`   Location: ${credentialsPath}`);
		console.log(`   Permissions: 600 (read/write for owner only)\n`);
		console.log("🎉 You can now use the Linear scripts!\n");
		console.log("Try:");
		console.log("  npx tsx list-teams.ts");
		console.log("  npx tsx scripts/issues/list.ts <teamId>");
	} catch (error) {
		console.error(
			`\n❌ Error writing credentials: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(`\n❌ Setup failed: ${error.message}`);
	process.exit(1);
});
