import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { getTeamIdOrExit } from "../../lib/config.js";

async function listLabels() {
	const teamId = getTeamIdOrExit(2);

	const team = await client.team(teamId);

	if (!team) {
		console.error("Team not found");
		process.exit(1);
	}

	const labelsResponse = await team.labels();

	const labels = labelsResponse.nodes.map((label) => ({
		id: label.id,
		name: label.name,
		color: label.color,
		description: label.description,
	}));

	outputWithJq({ labels });
}

listLabels().catch((error) => {
	console.error("Error listing labels:", error.message);
	process.exit(1);
});
