import { client } from "../../lib/client.js";
import { outputWithJq } from "../../lib/output.js";

async function createComment() {
	const issueId = process.argv[2];
	const body = process.argv[3];

	if (!issueId || !body) {
		console.error("Error: Please provide issue ID and comment body");
		console.error(
			"Usage: npx tsx scripts/comments/create.ts <issueId> <body>"
		);
		process.exit(1);
	}

	const commentPayload = await client.createComment({
		issueId,
		body,
	});

	const comment = await commentPayload.comment;

	if (!comment) {
		console.error("Failed to create comment");
		process.exit(1);
	}

	const user = await comment.user;

	outputWithJq({
		id: comment.id,
		body: comment.body,
		createdAt: comment.createdAt,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
				}
			: null,
	});
}

createComment().catch((error) => {
	console.error("Error creating comment:", error.message);
	process.exit(1);
});
