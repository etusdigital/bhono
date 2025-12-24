import { client } from "../lib/client.js";
import { outputWithJq } from "../lib/output.js";

interface TeamOutput {
	id: string;
	name: string;
	key: string;
}

interface ProjectOutput {
	id: string;
	name: string;
	teamId: string | null;
}

interface Output {
	teams: TeamOutput[];
	projects: ProjectOutput[];
}

async function listTeamsAndProjects(): Promise<Output> {
	// Fetch teams
	const teamsResponse = await client.teams();
	const teams: TeamOutput[] = teamsResponse.nodes.map((team) => ({
		id: team.id,
		name: team.name,
		key: team.key,
	}));

	// Fetch projects
	const projectsResponse = await client.projects();
	const projects: ProjectOutput[] = await Promise.all(
		projectsResponse.nodes.map(async (project) => {
			const teams = await project.teams();
			return {
				id: project.id,
				name: project.name,
				teamId: teams.nodes[0]?.id || null,
			};
		})
	);

	return { teams, projects };
}

// Main execution
listTeamsAndProjects()
	.then(outputWithJq)
	.catch((error) => {
		console.error("Error fetching teams and projects:", error.message);
		process.exit(1);
	});
