import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

/**
 * Check if a string looks like an issue identifier (e.g., AA-123, ENG-456)
 */
function isIssueIdentifier(str: string): boolean {
	return /^[A-Z]+-\d+$/i.test(str);
}

/**
 * Resolve an issue identifier (AA-123) to its UUID.
 * If already a UUID, returns as-is.
 */
async function resolveIssueId(idOrIdentifier: string): Promise<string> {
	if (!isIssueIdentifier(idOrIdentifier)) {
		// Assume it's already a UUID
		return idOrIdentifier;
	}

	// Look up the issue by identifier
	const issue = await client.issue(idOrIdentifier);
	if (!issue) {
		throw new Error(`Issue not found: ${idOrIdentifier}`);
	}
	return issue.id;
}

interface UpdateOptions {
	title?: string;
	description?: string;
	stateId?: string;
	priority?: number;
	assigneeId?: string | null;
	labelIds?: string[];
	projectId?: string | null;
	estimate?: number | null;
	dueDate?: string | null;
	parentId?: string | null;
	cycleId?: string | null;
}

function printUsage() {
	console.error("Usage: npx tsx scripts/issues/update.ts --issue <issueId> [options] --json");
	console.error("       npx tsx scripts/issues/update.ts <issueId> [options] --json  (legacy)");
	console.error("");
	console.error("Options:");
	console.error("  --issue <id>         Issue ID or identifier (e.g., ABC-123) (required)");
	console.error("  --title <text>       New title");
	console.error("  --description <text> New description (markdown supported)");
	console.error("  --state <id>         Workflow state ID");
	console.error("  --priority <0-4>     Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low");
	console.error("  --assignee <id>      User ID (use 'none' to unassign)");
	console.error("  --labels <ids>       Comma-separated label IDs (replaces existing)");
	console.error("  --project <id>       Project ID (use 'none' to remove)");
	console.error("  --estimate <points>  Point estimate (use 'none' to clear)");
	console.error("  --due <YYYY-MM-DD>   Due date (use 'none' to clear)");
	console.error("  --parent <id>        Parent issue ID or identifier (e.g., AA-123) (use 'none' to remove)");
	console.error("  --cycle <id>         Cycle/sprint ID (use 'none' to remove)");
	console.error("  --json               Output as JSON (recommended for scripting)");
	console.error("");
	console.error("Examples:");
	console.error("  npx tsx scripts/issues/update.ts --issue ABC-123 --priority 1 --json");
	console.error("  npx tsx scripts/issues/update.ts --issue ABC-123 --state state-id --assignee user-id --json");
	console.error("  npx tsx scripts/issues/update.ts ABC-123 --assignee none --json  (legacy positional)");
}

function getArgValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index !== -1 && args[index + 1] && !args[index + 1].startsWith("--")) {
		return args[index + 1];
	}
	return undefined;
}

function parseArgs(): { issueId: string; updates: UpdateOptions } | null {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error("Error: Please provide issue ID");
		console.error("Use --issue ABC-123 or provide as first argument");
		console.error("");
		printUsage();
		return null;
	}

	let issueId: string | undefined;
	let optionsStartIndex = 0;

	// Check for --issue flag (new named pattern - recommended)
	issueId = getArgValue(args, "--issue");

	// If no --issue flag, check for positional issueId (legacy backwards compatibility)
	if (!issueId && args[0] && !args[0].startsWith("--")) {
		issueId = args[0];
		optionsStartIndex = 1;
	}

	if (!issueId) {
		console.error("Error: Please provide issue ID");
		console.error("Use --issue ABC-123 or provide as first argument");
		console.error("");
		printUsage();
		return null;
	}

	const updates: UpdateOptions = {};

	// Parse named options
	for (let i = optionsStartIndex; i < args.length; i++) {
		const arg = args[i];
		const nextArg = args[i + 1];

		// Skip already-processed --issue flag
		if (arg === "--issue") {
			if (nextArg && !nextArg.startsWith("--")) {
				i++; // Skip the value too
			}
			continue;
		}

		switch (arg) {
			case "--title":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.title = nextArg;
					i++;
				}
				break;
			case "--description":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.description = nextArg;
					i++;
				}
				break;
			case "--state":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.stateId = nextArg;
					i++;
				}
				break;
			case "--priority":
				if (nextArg && !nextArg.startsWith("--")) {
					const priority = parseInt(nextArg);
					if (priority >= 0 && priority <= 4) {
						updates.priority = priority;
					} else {
						console.error("Error: Priority must be 0-4");
						return null;
					}
					i++;
				}
				break;
			case "--assignee":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.assigneeId = nextArg === "none" || nextArg === "null" ? null : nextArg;
					i++;
				}
				break;
			case "--labels":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.labelIds = nextArg.split(",").map(id => id.trim());
					i++;
				}
				break;
			case "--project":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.projectId = nextArg === "none" || nextArg === "null" ? null : nextArg;
					i++;
				}
				break;
			case "--estimate":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.estimate = nextArg === "none" || nextArg === "null" ? null : parseInt(nextArg);
					i++;
				}
				break;
			case "--due":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.dueDate = nextArg === "none" || nextArg === "null" ? null : nextArg;
					i++;
				}
				break;
			case "--parent":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.parentId = nextArg === "none" || nextArg === "null" ? null : nextArg;
					i++;
				}
				break;
			case "--cycle":
				if (nextArg && !nextArg.startsWith("--")) {
					updates.cycleId = nextArg === "none" || nextArg === "null" ? null : nextArg;
					i++;
				}
				break;
			case "--json":
				// Handled by outputWithJq
				break;
			default:
				// Ignore unknown flags
				break;
		}
	}

	if (Object.keys(updates).length === 0) {
		console.error("Error: No updates provided");
		console.error("");
		printUsage();
		return null;
	}

	return { issueId, updates };
}

async function updateIssue() {
	const parsed = parseArgs();
	if (!parsed) {
		process.exit(1);
	}

	const { issueId, updates } = parsed;

	// Resolve parentId if it's an identifier (AA-123) to UUID
	// Skip resolution if null (removing parent)
	let resolvedParentId: string | null | undefined = updates.parentId;
	if (updates.parentId !== undefined && updates.parentId !== null) {
		resolvedParentId = await resolveIssueId(updates.parentId);
	}

	// Build the input object with only defined fields
	const input = {
		...(updates.title !== undefined && { title: updates.title }),
		...(updates.description !== undefined && { description: updates.description }),
		...(updates.stateId !== undefined && { stateId: updates.stateId }),
		...(updates.priority !== undefined && { priority: updates.priority }),
		...(updates.assigneeId !== undefined && { assigneeId: updates.assigneeId }),
		...(updates.labelIds !== undefined && { labelIds: updates.labelIds }),
		...(updates.projectId !== undefined && { projectId: updates.projectId }),
		...(updates.estimate !== undefined && { estimate: updates.estimate }),
		...(updates.dueDate !== undefined && { dueDate: updates.dueDate }),
		...(resolvedParentId !== undefined && { parentId: resolvedParentId }),
		...(updates.cycleId !== undefined && { cycleId: updates.cycleId }),
	};

	const issuePayload = await client.updateIssue(issueId, input);
	const issue = await issuePayload.issue;

	if (!issue) {
		console.error("Failed to update issue");
		process.exit(1);
	}

	// Fetch additional details for output
	const state = await issue.state;
	const assignee = await issue.assignee;
	const project = await issue.project;
	const parent = await issue.parent;
	const labels = await issue.labels();

	outputWithJq({
		id: issue.id,
		identifier: issue.identifier,
		title: issue.title,
		description: issue.description,
		url: issue.url,
		priority: issue.priority,
		priorityLabel: issue.priorityLabel,
		estimate: issue.estimate,
		dueDate: issue.dueDate,
		state: state ? { id: state.id, name: state.name } : null,
		assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
		project: project ? { id: project.id, name: project.name } : null,
		parent: parent ? { id: parent.id, identifier: parent.identifier } : null,
		labels: labels.nodes.map(l => ({ id: l.id, name: l.name })),
		updatedAt: issue.updatedAt,
	});
}

updateIssue().catch((error) => {
	console.error("Error updating issue:", error.message);
	process.exit(1);
});
