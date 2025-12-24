import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { getTeamIdOrExit } from "../../lib/config.js";

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

interface CreateOptions {
	title: string;
	teamId: string;
	description?: string;
	stateId?: string;
	priority?: number;
	assigneeId?: string;
	labelIds?: string[];
	projectId?: string;
	estimate?: number;
	dueDate?: string;
	parentId?: string;
	cycleId?: string;
}

function printUsage() {
	console.error("Usage: npx tsx scripts/issues/create.ts --title <title> [options] --json");
	console.error("       npx tsx scripts/issues/create.ts <title> [teamId] [options] --json  (legacy)");
	console.error("");
	console.error("Options:");
	console.error("  --title <text>       Issue title (required)");
	console.error("  --teamId <id>        Team ID (optional if configured)");
	console.error("  --description <text> Issue description (markdown supported)");
	console.error("  --state <id>         Initial workflow state ID");
	console.error("  --priority <0-4>     Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low");
	console.error("  --assignee <id>      User ID to assign the issue to");
	console.error("  --labels <ids>       Comma-separated label IDs");
	console.error("  --project <id>       Project ID to associate with");
	console.error("  --estimate <points>  Point estimate");
	console.error("  --due <YYYY-MM-DD>   Due date");
	console.error("  --parent <id>        Parent issue ID or identifier (e.g., AA-123) for sub-issues");
	console.error("  --cycle <id>         Cycle/sprint ID");
	console.error("  --json               Output as JSON (recommended for scripting)");
	console.error("");
	console.error("Examples:");
	console.error("  npx tsx scripts/issues/create.ts --title \"Fix login bug\" --json");
	console.error("  npx tsx scripts/issues/create.ts --title \"New feature\" --priority 2 --assignee user-123 --json");
	console.error("  npx tsx scripts/issues/create.ts \"Fix login bug\" --json  (legacy positional)");
}

function getArgValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index !== -1 && args[index + 1] && !args[index + 1].startsWith("--")) {
		return args[index + 1];
	}
	return undefined;
}

function parseArgs(): CreateOptions | null {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error("Error: Please provide issue title");
		console.error("Use --title \"title\" or provide as first argument");
		console.error("");
		printUsage();
		return null;
	}

	let title: string | undefined;
	let teamIdArg: string | undefined;
	let optionsStartIndex = 0;

	// Check for --title flag (new named pattern - recommended)
	title = getArgValue(args, "--title");

	// Check for --teamId flag
	teamIdArg = getArgValue(args, "--teamId");

	// If no --title flag, check for positional title (legacy backwards compatibility)
	if (!title && args[0] && !args[0].startsWith("--")) {
		title = args[0];
		optionsStartIndex = 1;

		// Check for positional teamId (legacy)
		if (!teamIdArg && args[1] && !args[1].startsWith("--")) {
			teamIdArg = args[1];
			optionsStartIndex = 2;
		}
	}

	if (!title) {
		console.error("Error: Please provide issue title");
		console.error("Use --title \"title\" or provide as first argument");
		console.error("");
		printUsage();
		return null;
	}

	// Get teamId from arg or config
	const teamId = teamIdArg || getTeamIdOrExit(undefined);

	const options: CreateOptions = { title, teamId };

	// Parse named options
	for (let i = optionsStartIndex; i < args.length; i++) {
		const arg = args[i];
		const nextArg = args[i + 1];

		// Skip already-processed flags
		if (arg === "--title" || arg === "--teamId") {
			if (nextArg && !nextArg.startsWith("--")) {
				i++; // Skip the value too
			}
			continue;
		}

		switch (arg) {
			case "--description":
				if (nextArg && !nextArg.startsWith("--")) {
					options.description = nextArg;
					i++;
				}
				break;
			case "--state":
				if (nextArg && !nextArg.startsWith("--")) {
					options.stateId = nextArg;
					i++;
				}
				break;
			case "--priority":
				if (nextArg && !nextArg.startsWith("--")) {
					const priority = parseInt(nextArg);
					if (priority >= 0 && priority <= 4) {
						options.priority = priority;
					} else {
						console.error("Error: Priority must be 0-4");
						return null;
					}
					i++;
				}
				break;
			case "--assignee":
				if (nextArg && !nextArg.startsWith("--")) {
					options.assigneeId = nextArg;
					i++;
				}
				break;
			case "--labels":
				if (nextArg && !nextArg.startsWith("--")) {
					options.labelIds = nextArg.split(",").map(id => id.trim());
					i++;
				}
				break;
			case "--project":
				if (nextArg && !nextArg.startsWith("--")) {
					options.projectId = nextArg;
					i++;
				}
				break;
			case "--estimate":
				if (nextArg && !nextArg.startsWith("--")) {
					options.estimate = parseInt(nextArg);
					i++;
				}
				break;
			case "--due":
				if (nextArg && !nextArg.startsWith("--")) {
					options.dueDate = nextArg;
					i++;
				}
				break;
			case "--parent":
				if (nextArg && !nextArg.startsWith("--")) {
					options.parentId = nextArg;
					i++;
				}
				break;
			case "--cycle":
				if (nextArg && !nextArg.startsWith("--")) {
					options.cycleId = nextArg;
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

	return options;
}

async function createIssue() {
	const options = parseArgs();
	if (!options) {
		process.exit(1);
	}

	// Resolve parentId if it's an identifier (AA-123) to UUID
	let resolvedParentId: string | undefined;
	if (options.parentId) {
		resolvedParentId = await resolveIssueId(options.parentId);
	}

	// Build the input object with only defined fields
	const input = {
		title: options.title,
		teamId: options.teamId,
		...(options.description !== undefined && { description: options.description }),
		...(options.stateId !== undefined && { stateId: options.stateId }),
		...(options.priority !== undefined && { priority: options.priority }),
		...(options.assigneeId !== undefined && { assigneeId: options.assigneeId }),
		...(options.labelIds !== undefined && { labelIds: options.labelIds }),
		...(options.projectId !== undefined && { projectId: options.projectId }),
		...(options.estimate !== undefined && { estimate: options.estimate }),
		...(options.dueDate !== undefined && { dueDate: options.dueDate }),
		...(resolvedParentId !== undefined && { parentId: resolvedParentId }),
		...(options.cycleId !== undefined && { cycleId: options.cycleId }),
	};

	const issuePayload = await client.createIssue(input);
	const issue = await issuePayload.issue;

	if (!issue) {
		console.error("Failed to create issue");
		process.exit(1);
	}

	// Fetch additional details for output
	const state = await issue.state;
	const assignee = await issue.assignee;
	const project = await issue.project;
	const parent = await issue.parent;

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
		createdAt: issue.createdAt,
	});
}

createIssue().catch((error) => {
	console.error("Error creating issue:", error.message);
	process.exit(1);
});
