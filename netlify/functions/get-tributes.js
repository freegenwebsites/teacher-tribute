// netlify/functions/get-tributes.js
import { createClient } from '@libsql/client';

// LibSQL client configuration
const config = {
    url: process.env.TURSO_DB_URL,       // Get URL from environment variable
    authToken: process.env.TURSO_DB_AUTH_TOKEN // Get token from environment variable
};

// Default values for pagination
const DEFAULT_PAGE_SIZE = 50; // How many items per page - You can adjust this default
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
        console.log(`Invalid or missing 'page' parameter. Defaulting to 1.`);
        page = 1;
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
        console.log(`Invalid or missing 'pageSize' parameter (or > ${MAX_PAGE_SIZE}). Defaulting to ${DEFAULT_PAGE_SIZE}.`);
        pageSize = DEFAULT_PAGE_SIZE;
    }

    // Calculate OFFSET for SQL query
    const offset = (page - 1) * pageSize;
    console.log(`Pagination calculated: page=${page}, pageSize=${pageSize}, offset=${offset}`);
    // --- End Pagination Logic ---

    const client = createClient(config);

    try {
        // --- Prepare the SQL query and arguments ---
        const sqlQuery = "SELECT id, from_name, message, photos, created_at FROM tributes ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
        const queryArgs = { limit: pageSize, offset: offset };

        // --->>> ADD DEBUG LOG HERE <<<---
        console.log("Executing SQL:", sqlQuery, "with Args:", queryArgs);
        // --->>> END DEBUG LOG <<<---

        // --- Execute the paginated query ---
        const tributesResult = await client.execute({
            sql: sqlQuery,
            args: queryArgs
        });
        console.log(`Fetched ${tributesResult.rows.length} tributes.`); // Log how many rows were actually returned

        // --- Optional: Get total count for pagination metadata ---
        console.log("Executing SQL: SELECT COUNT(*) as totalCount FROM tributes");
        const countResult = await client.execute("SELECT COUNT(*) as totalCount FROM tributes");
        const totalCount = countResult.rows[0]?.totalCount ?? 0;
        const totalPages = Math.ceil(totalCount / pageSize);
        console.log(`Total count: ${totalCount}, Total pages: ${totalPages}`);
        // --- End Optional Count ---

        // Map rows to a more standard JSON object format
        const tributes = tributesResult.rows.map(row => ({
            id: row.id,
            from: row.from_name,
            msg: row.message,
            // Safely parse photos JSON
            photos: (() => {
                try {
                    return row.photos ? JSON.parse(row.photos) : [];
                } catch (parseError) {
                    console.error(`Error parsing photos JSON for tribute ID ${row.id}:`, parseError);
                    return []; // Return empty array on parse error
                }
            })(),
            date: row.created_at // Pass raw date string
        }));

        const responsePayload = {
            tributes: tributes,
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalCount: Number(totalCount),
                totalPages: totalPages
            }
        };

        // Log the size of the response *before* returning (approximate)
        const responseBodyString = JSON.stringify(responsePayload);
        console.log(`Approximate response body size: ${responseBodyString.length} bytes.`);

        // --- Return paginated data AND metadata ---
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: responseBodyString, // Use the stringified body
        };
        // --- End Modified Return ---

    } catch (error) {
        console.error("Error during database operation or processing:", error);
        // Ensure error details are logged, especially the message
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        return {
            statusCode: 500,
            // Provide a more generic error message to the client for security
            body: JSON.stringify({ error: 'Failed to fetch tributes due to a server error.' }),
        };
    } finally {
        // Close client connection if needed (check @libsql/client docs for best practice)
        // client.close(); might be necessary depending on how connections are managed
        console.log("Function execution finished.");
    }
};
