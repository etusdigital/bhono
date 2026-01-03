import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function archiveIssue() {
	const issueId = process.argv[2];

	if (!issueId) {
		console.error("Error: Please provide issue ID");
		console.error("Usage: npx tsx scripts/issues/archive.ts <issueId>");
		process.exit(1);
	}

	const issuePayload = await client.archiveIssue(issueId);
	const success = issuePayload.success;

	if (!success) {
		console.error("Failed to archive issue");
		process.exit(1);
	}

	outputWithJq({
		success: true,
		message: "Issue archived successfully",
	});
}

archiveIssue().catch((error) => {
	console.error("Error archiving issue:", error.message);
	process.exit(1);
});
