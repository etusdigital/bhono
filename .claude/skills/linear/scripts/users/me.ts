import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function getCurrentUser() {
	const viewer = await client.viewer;

	outputWithJq({
		id: viewer.id,
		name: viewer.name,
		email: viewer.email,
		displayName: viewer.displayName,
		admin: viewer.admin,
		createdAt: viewer.createdAt,
	});
}

getCurrentUser().catch((error) => {
	console.error("Error fetching current user:", error.message);
	process.exit(1);
});
