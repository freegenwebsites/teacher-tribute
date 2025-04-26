// netlify/functions/get-tributes.js
import { createClient } from '@libsql/client';

// LibSQL client configuration
const config = {
    url: process.env.TURSO_DB_URL,       // Get URL from environment variable
    authToken: process.env.TURSO_DB_AUTH_TOKEN // Get token from environment variable
};

export const handler = async (event, context) => {
    console.log("Function 'get-tributes' invoked");

    if (!config.url || !config.authToken) {
         console.error("Missing Turso URL or Auth Token environment variables.");
         return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
    }

    const client = createClient(config);

    try {
        // Fetch all tributes, newest first
        const result = await client.execute(
            "SELECT id, from_name, message, photos, created_at FROM tributes ORDER BY created_at DESC"
        );

        // Map rows to a more standard JSON object format
        const tributes = result.rows.map(row => ({
            id: row.id,
            from: row.from_name, // Map db column to frontend property
            msg: row.message,   // Map db column to frontend property
            photos: row.photos ? JSON.parse(row.photos) : [], // Parse JSON string back to array
            date: row.created_at // Pass the date string
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tributes),
        };
    } catch (error) {
        console.error("Error fetching tributes from Turso:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch tributes' }),
        };
    } finally {
        // Ensure the client connection is closed (important in serverless)
        // Note: Check @libsql/client docs for best practices on connection closing if needed.
        // As of recent versions, explicit close might not always be necessary per request.
        // if (client && typeof client.close === 'function') {
        //     client.close();
        // }
    }
};
