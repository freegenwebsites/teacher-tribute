// netlify/functions/get-tributes.js
import { createClient } from '@libsql/client';

// LibSQL client configuration
const config = {
    url: process.env.TURSO_DB_URL,       // Get URL from environment variable
    authToken: process.env.TURSO_DB_AUTH_TOKEN // Get token from environment variable
};

// Default values for pagination
const DEFAULT_PAGE_SIZE = 50; // How many items per page
const MAX_PAGE_SIZE = 100;   // Set a maximum limit

export const handler = async (event, context) => {
    console.log("Function 'get-tributes' invoked");

    if (!config.url || !config.authToken) {
        console.error("Missing Turso URL or Auth Token environment variables.");
        return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
    }

    // --- Pagination Logic ---
    const queryParams = event.queryStringParameters || {};
    let page = parseInt(queryParams.page, 10);
    let pageSize = parseInt(queryParams.pageSize, 10);

    // Validate and set defaults
    if (isNaN(page) || page < 1) {
        page = 1; // Default to page 1 if invalid or missing
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
        pageSize = DEFAULT_PAGE_SIZE; // Default/max size if invalid or missing or too large
    }

    // Calculate OFFSET for SQL query
    const offset = (page - 1) * pageSize;
    // --- End Pagination Logic ---

    const client = createClient(config);

    try {
        // --- Modified Query with LIMIT and OFFSET ---
        const tributesResult = await client.execute({
            sql: "SELECT id, from_name, message, photos, created_at FROM tributes ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
            args: { limit: pageSize, offset: offset }
        });

        // --- Optional: Get total count for pagination metadata ---
        // This requires a separate query. Consider if needed for your UI.
        const countResult = await client.execute("SELECT COUNT(*) as totalCount FROM tributes");
        const totalCount = countResult.rows[0]?.totalCount ?? 0;
        const totalPages = Math.ceil(totalCount / pageSize);
        // --- End Optional Count ---


        // Map rows to a more standard JSON object format
        const tributes = tributesResult.rows.map(row => ({
            id: row.id,
            from: row.from_name,
            msg: row.message,
            photos: row.photos ? JSON.parse(row.photos) : [],
            date: row.created_at
        }));

        // --- Return paginated data AND metadata ---
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tributes: tributes, // The actual data for the current page
                pagination: {      // Metadata about the pagination
                    currentPage: page,
                    pageSize: pageSize,
                    totalCount: Number(totalCount), // Ensure it's a number
                    totalPages: totalPages
                }
            }),
        };
        // --- End Modified Return ---

    } catch (error) {
        console.error("Error fetching tributes from Turso:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch tributes' }),
        };
    } finally {
        // client.close(); // Close client if the library requires/recommends it
    }
};
