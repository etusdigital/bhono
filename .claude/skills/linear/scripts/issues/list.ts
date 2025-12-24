import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { getTeamIdOrExit } from "../../lib/config.js";

interface ListOptions {
	mine: boolean;
	unassigned: boolean;
	status: string | null;
}

function parseArgs(): ListOptions {
	const args = process.argv.slice(2);
	return {
		mine: args.includes("--mine"),
		unassigned: args.includes("--unassigned"),
		status: args.find((a) => a.startsWith("--status="))?.split("=")[1] || null,
	};
}

async function listIssues() {
	const teamId = getTeamIdOrExit(2);
	const options = parseArgs();

	const viewer = await client.viewer;

	// Build filter based on options
	const filter: Record<string, unknown> = {
		team: { id: { eq: teamId } },
	};

	// Only filter by assignee if --mine flag is passed
	if (options.mine) {
		filter.assignee = { id: { eq: viewer.id } };
	} else if (options.unassigned) {
		filter.assignee = { null: true };
	}

	// Filter by status name if provided
	if (options.status) {
		filter.state = { name: { eqIgnoreCase: options.status } };
	}

	const issuesResponse = await client.issues({
		filter,
		first: 50,
	});

	const issues = await Promise.all(
		issuesResponse.nodes.map(async (issue) => ({
			id: issue.id,
			identifier: issue.identifier,
			title: issue.title,
			status: (await issue.state)?.name || "Unknown",
			priority: issue.priority,
			priorityLabel: issue.priorityLabel,
			assignee: (await issue.assignee)?.name || null,
			url: issue.url,
		}))
	);

	outputWithJq({ issues });
}

listIssues().catch((error) => {
	console.error("Error listing issues:", error.message);
	process.exit(1);
});
