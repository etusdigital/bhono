import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function getIssue() {
	const issueId = process.argv[2];

	if (!issueId) {
		console.error("Error: Please provide issue ID or identifier");
		console.error(
			"Usage: npx tsx scripts/issues/get.ts <issueId or identifier>"
		);
		process.exit(1);
	}

	// Check if it's an identifier (e.g., AA-123) or UUID
	let issue;

	if (issueId.includes("-") && issueId.split("-")[0].match(/^[A-Z]+$/)) {
		// It's an identifier like AA-123
		const issueResult = await client.issue(issueId);
		issue = issueResult;
	} else {
		// It's a UUID
		const issueResult = await client.issue(issueId);
		issue = issueResult;
	}

	if (!issue) {
		console.error("Issue not found");
		process.exit(1);
	}

	const state = await issue.state;
	const assignee = await issue.assignee;
	const creator = await issue.creator;

	outputWithJq({
		id: issue.id,
		identifier: issue.identifier,
		title: issue.title,
		description: issue.description,
		status: state?.name || "Unknown",
		priority: issue.priority,
		priorityLabel: issue.priorityLabel,
		assignee: assignee
			? {
					id: assignee.id,
					name: assignee.name,
					email: assignee.email,
				}
			: null,
		creator: creator
			? {
					id: creator.id,
					name: creator.name,
					email: creator.email,
				}
			: null,
		url: issue.url,
		createdAt: issue.createdAt,
		updatedAt: issue.updatedAt,
	});
}

getIssue().catch((error) => {
	console.error("Error fetching issue:", error.message);
	process.exit(1);
});
