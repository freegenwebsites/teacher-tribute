// netlify/functions/delete-tribute.js
import { createClient } from '@libsql/client';

const config = {
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_AUTH_TOKEN
};

export const handler = async (event, context) => {
    console.log("Function 'delete-tribute' invoked");

    // Allow DELETE or POST (adjust frontend method accordingly)
    if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
     if (!config.url || !config.authToken) {
         console.error("Missing Turso URL or Auth Token environment variables.");
         return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
     }

    const client = createClient(config);

    try {
        // Extract ID from the body (adjust if sent differently, e.g., query param)
        const { id: idToDelete } = JSON.parse(event.body);

        if (!idToDelete) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field: id' }) };
        }

        // Delete using parameterized query
        const result = await client.execute({
            sql: "DELETE FROM tributes WHERE id = ?",
            args: [idToDelete]
        });

        // Check if a row was actually deleted
        if (result.rowsAffected === 0) {
             return { statusCode: 404, body: JSON.stringify({ error: 'Tribute not found' }) };
        }

        return {
            statusCode: 200, // OK (or 204 No Content)
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Tribute deleted successfully' }),
        };
    } catch (error) {
        console.error("Error deleting tribute from Turso:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Failed to delete tribute' }),
        };
    } finally {
        // Close client if needed
    }
};
