import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function updateIssueStatus() {
	const issueId = process.argv[2];
	const stateId = process.argv[3];

	if (!issueId || !stateId) {
		console.error("Error: Please provide issue ID and state ID");
		console.error(
			"Usage: npx tsx scripts/status/update.ts <issueId> <stateId>"
		);
		console.error(
			"Tip: Use scripts/status/list.ts to see available states"
		);
		process.exit(1);
	}

	const issuePayload = await client.updateIssue(issueId, {
		stateId,
	});

	const issue = await issuePayload.issue;

	if (!issue) {
		console.error("Failed to update issue status");
		process.exit(1);
	}

	const state = await issue.state;

	outputWithJq({
		id: issue.id,
		identifier: issue.identifier,
		title: issue.title,
		status: state?.name || "Unknown",
		updatedAt: issue.updatedAt,
	});
}

updateIssueStatus().catch((error) => {
	console.error("Error updating issue status:", error.message);
	process.exit(1);
});
