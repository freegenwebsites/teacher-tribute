// netlify/functions/add-tribute.js
import { createClient } from '@libsql/client';

const config = {
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_AUTH_TOKEN
};

export const handler = async (event, context) => {
    console.log("Function 'add-tribute' invoked");

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
     if (!config.url || !config.authToken) {
         console.error("Missing Turso URL or Auth Token environment variables.");
         return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
     }

    const client = createClient(config);

    try {
        const tributeData = JSON.parse(event.body);

        // Basic validation
        if (!tributeData.msg || !tributeData.from) {
            return { statusCode: 400, body: JSON.stringify({error: 'Missing required fields (from, msg)'}) };
        }

        // Prepare data for DB (ensure photos is a JSON string)
        const from_name = tributeData.from;
        const message = tributeData.msg;
        // **Image Limitation:** Storing actual images requires a separate upload service.
        // We store the passed array (likely blob URLs or empty) as a JSON string.
        const photosJson = JSON.stringify(tributeData.photos || []);

        // Insert data using parameterized query to prevent SQL injection
        // Using RETURNING to get the newly inserted row back
        const result = await client.execute({
            sql: "INSERT INTO tributes (from_name, message, photos) VALUES (?, ?, ?) RETURNING id, from_name, message, photos, created_at",
            args: [from_name, message, photosJson]
        });

        if (!result.rows || result.rows.length === 0) {
            throw new Error("Failed to insert tribute or retrieve inserted row.");
        }

        // Format the newly added tribute for the response
        const addedRow = result.rows[0];
        const newTribute = {
             id: addedRow.id,
             from: addedRow.from_name,
             msg: addedRow.message,
             photos: addedRow.photos ? JSON.parse(addedRow.photos) : [],
             date: addedRow.created_at
        };


        return {
            statusCode: 201, // 201 Created
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTribute), // Send back the created tribute
        };
    } catch (error) {
        console.error("Error adding tribute to Turso:", error);
        // Provide more specific error if possible (e.g., validation error vs. DB error)
        return {
            statusCode: error.message.includes("NOT NULL constraint failed") ? 400 : 500,
            body: JSON.stringify({ error: error.message || 'Failed to add tribute' }),
        };
    } finally {
         // Close client if needed
        // if (client && typeof client.close === 'function') {
        //     client.close();
        // }
    }
};
