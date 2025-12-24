import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function listComments() {
	const issueId = process.argv[2];

	if (!issueId) {
		console.error("Error: Please provide issue ID");
		console.error("Usage: npx tsx scripts/comments/list.ts <issueId>");
		process.exit(1);
	}

	const issue = await client.issue(issueId);

	if (!issue) {
		console.error("Issue not found");
		process.exit(1);
	}

	const commentsResponse = await issue.comments();

	const comments = await Promise.all(
		commentsResponse.nodes.map(async (comment) => {
			const user = await comment.user;
			return {
				id: comment.id,
				body: comment.body,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt,
				user: user
					? {
							id: user.id,
							name: user.name,
							email: user.email,
						}
					: null,
			};
		})
	);

	outputWithJq({ comments });
}

listComments().catch((error) => {
	console.error("Error listing comments:", error.message);
	process.exit(1);
});
