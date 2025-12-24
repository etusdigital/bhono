import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { getTeamIdOrExit } from "../../lib/config.js";

async function createLabel() {
	const name = process.argv[2];

	if (!name) {
		console.error("Error: Please provide label name");
		console.error("");
		console.error("Usage: npx tsx scripts/labels/create.ts <name> [teamId] [color]");
		console.error("");
		console.error("If teamId is omitted, uses default from .claude/linear-config.json");
		process.exit(1);
	}

	const teamId = getTeamIdOrExit(3);

	const color = process.argv[4];

	const labelPayload = await client.createIssueLabel({
		name,
		teamId,
		...(color && { color }),
	});

	const label = await labelPayload.issueLabel;

	if (!label) {
		console.error("Failed to create label");
		process.exit(1);
	}

	outputWithJq({
		id: label.id,
		name: label.name,
		color: label.color,
		description: label.description,
	});
}

createLabel().catch((error) => {
	console.error("Error creating label:", error.message);
	process.exit(1);
});
