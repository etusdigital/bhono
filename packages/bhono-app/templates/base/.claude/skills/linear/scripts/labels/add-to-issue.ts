import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function addLabelToIssue() {
	const issueId = process.argv[2];
	const labelId = process.argv[3];

	if (!issueId || !labelId) {
		console.error("Error: Please provide issue ID and label ID");
		console.error(
			"Usage: npx tsx scripts/labels/add-to-issue.ts <issueId> <labelId>"
		);
		console.error("Tip: Use scripts/labels/list.ts to see available labels");
		process.exit(1);
	}

	// Get current labels
	const issue = await client.issue(issueId);
	if (!issue) {
		console.error("Issue not found");
		process.exit(1);
	}

	const currentLabels = await issue.labels();
	const currentLabelIds = currentLabels.nodes.map((label) => label.id);

	// Add new label if not already present
	if (currentLabelIds.includes(labelId)) {
		console.error("Label already attached to issue");
		process.exit(1);
	}

	const updatedLabelIds = [...currentLabelIds, labelId];

	const issuePayload = await client.updateIssue(issueId, {
		labelIds: updatedLabelIds,
	});

	const updatedIssue = await issuePayload.issue;

	if (!updatedIssue) {
		console.error("Failed to add label to issue");
		process.exit(1);
	}

	const labels = await updatedIssue.labels();

	outputWithJq({
		id: updatedIssue.id,
		identifier: updatedIssue.identifier,
		title: updatedIssue.title,
		labels: labels.nodes.map((label) => ({
			id: label.id,
			name: label.name,
			color: label.color,
		})),
	});
}

addLabelToIssue().catch((error) => {
	console.error("Error adding label to issue:", error.message);
	process.exit(1);
});
