import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { getTeamIdOrExit } from "../../lib/config.js";

/**
 * Update issue status by status name (e.g., "Done", "In Progress")
 *
 * Usage:
 *   npx tsx scripts/status/set-by-name.ts ABC-123 "Done" --json
 *   npx tsx scripts/status/set-by-name.ts ABC-123 "In Progress" --json
 *
 * This avoids the need for jq chaining to find status IDs.
 */
async function setStatusByName() {
	const issueId = process.argv[2];
	const statusName = process.argv[3];

	if (!issueId || !statusName) {
		console.error("Error: Please provide issue ID and status name");
		console.error(
			"Usage: npx tsx scripts/status/set-by-name.ts <issueId> <statusName> [--json]"
		);
		console.error("Example: npx tsx scripts/status/set-by-name.ts ABC-123 \"Done\" --json");
		console.error("\nCommon status names: Backlog, Todo, In Progress, In Review, Done, Canceled");
		process.exit(1);
	}

	// Get team states
	const teamId = getTeamIdOrExit(4); // Skip 4 args: node, script, issueId, statusName
	const team = await client.team(teamId);

	if (!team) {
		console.error("Team not found");
		process.exit(1);
	}

	const statesResponse = await team.states();

	// Find status by name (case-insensitive)
	const targetState = statesResponse.nodes.find(
		(state) => state.name.toLowerCase() === statusName.toLowerCase()
	);

	if (!targetState) {
		const availableStates = statesResponse.nodes.map((s) => s.name).join(", ");
		console.error(`Error: Status "${statusName}" not found`);
		console.error(`Available statuses: ${availableStates}`);
		process.exit(1);
	}

	// Update the issue
	const issuePayload = await client.updateIssue(issueId, {
		stateId: targetState.id,
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
		statusId: state?.id,
		updatedAt: issue.updatedAt,
	});
}

setStatusByName().catch((error) => {
	console.error("Error updating issue status:", error.message);
	process.exit(1);
});
