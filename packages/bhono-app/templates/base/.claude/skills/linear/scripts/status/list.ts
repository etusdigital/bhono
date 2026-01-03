import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { getTeamIdOrExit } from "../../lib/config.js";

async function listStatuses() {
	const teamId = getTeamIdOrExit(2);

	const team = await client.team(teamId);

	if (!team) {
		console.error("Team not found");
		process.exit(1);
	}

	const statesResponse = await team.states();

	const statuses = statesResponse.nodes.map((state) => ({
		id: state.id,
		name: state.name,
		type: state.type,
		color: state.color,
		position: state.position,
	}));

	outputWithJq({ statuses });
}

listStatuses().catch((error) => {
	console.error("Error listing statuses:", error.message);
	process.exit(1);
});
