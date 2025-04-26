// netlify/functions/get-tributes.js
import { createClient } from '@libsql/client';

// LibSQL client configuration
const config = {
    url: process.env.TURSO_DB_URL,       // Get URL from environment variable
    authToken: process.env.TURSO_DB_AUTH_TOKEN // Get token from environment variable
};

export const handler = async (event, context) => {
    console.log("Function 'get-tributes' invoked"); // Existing log

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

        // --->>> TEMPORARY DEBUG LOGS - START <<<---
        if (result.rows && result.rows.length > 0) {
            // Log the 'created_at' value and type from the first row found
            console.log("DEBUG: Raw 'created_at' value from DB (first row):", result.rows[0].created_at);
            console.log("DEBUG: Type of 'created_at' value:", typeof result.rows[0].created_at);
        } else {
            console.log("DEBUG: No tribute rows found in the database.");
        }
        // --->>> TEMPORARY DEBUG LOGS - END <<<---

        // Map rows to a more standard JSON object format
        const tributes = result.rows.map(row => ({
            id: row.id,
            from: row.from_name, // Map db column to frontend property
            msg: row.message,   // Map db column to frontend property
            photos: row.photos ? JSON.parse(row.photos) : [], // Parse JSON string back to array
            date: row.created_at // Pass the date string (raw value)
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
        // Close client if needed (optional based on library version)
    }
};
