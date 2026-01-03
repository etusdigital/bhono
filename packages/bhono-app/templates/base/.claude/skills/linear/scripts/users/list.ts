import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";
import { loadConfigIfExists } from "../../lib/config.js";

async function listUsers() {
	let teamId = process.argv[2];

	// If no teamId provided, try to use default from config
	if (!teamId) {
		const config = loadConfigIfExists();
		teamId = config?.defaults?.teamId;

		if (teamId) {
			console.error(`ℹ️  Using team from config: ${config.defaults.teamName}`);
		}
	}

	if (teamId) {
		// List users for a specific team
		const team = await client.team(teamId);

		if (!team) {
			console.error("Team not found");
			process.exit(1);
		}

		const membersResponse = await team.members();

		const users = membersResponse.nodes.map((user) => ({
			id: user.id,
			name: user.name,
			email: user.email,
			displayName: user.displayName,
			admin: user.admin,
			active: user.active,
		}));

		outputWithJq({ users });
	} else {
		// List all users in the organization
		const usersResponse = await client.users();

		const users = usersResponse.nodes.map((user) => ({
			id: user.id,
			name: user.name,
			email: user.email,
			displayName: user.displayName,
			admin: user.admin,
			active: user.active,
		}));

		outputWithJq({ users });
	}
}

listUsers().catch((error) => {
	console.error("Error listing users:", error.message);
	process.exit(1);
});
