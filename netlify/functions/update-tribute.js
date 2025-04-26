// netlify/functions/update-tribute.js
import { createClient } from '@libsql/client';

const config = {
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_AUTH_TOKEN
};

export const handler = async (event, context) => {
    console.log("Function 'update-tribute' invoked");

    // Allow PUT or POST (adjust frontend method accordingly if needed)
    if (event.httpMethod !== 'PUT' && event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
     if (!config.url || !config.authToken) {
         console.error("Missing Turso URL or Auth Token environment variables.");
         return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
     }

    const client = createClient(config);

    try {
        const tributeData = JSON.parse(event.body);

        // **Crucially, get the ID from the payload**
        const idToUpdate = tributeData.id;

        // Basic validation
        if (!idToUpdate || !tributeData.msg || !tributeData.from) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields (id, from, msg)' }) };
        }

        // Prepare data for DB (ensure photos is a JSON string)
        const from_name = tributeData.from;
        const message = tributeData.msg;
        // **Image Limitation:** Still applies.
        const photosJson = JSON.stringify(tributeData.photos || []);

        // Update data using parameterized query
        const result = await client.execute({
            sql: "UPDATE tributes SET from_name = ?, message = ?, photos = ? WHERE id = ?",
            args: [from_name, message, photosJson, idToUpdate]
        });

        // Check if any row was actually updated
        if (result.rowsAffected === 0) {
             return { statusCode: 404, body: JSON.stringify({ error: 'Tribute not found or no changes made' }) };
        }

        // Optionally, fetch the updated row to return it (more complex)
        // For simplicity, just return success status

        return {
            statusCode: 200, // OK
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Tribute updated successfully' }),
        };
    } catch (error) {
        console.error("Error updating tribute in Turso:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Failed to update tribute' }),
        };
    } finally {
        // Close client if needed
    }
};
