/**
 * Vercel Serverless Function: /api/chat
 * Reads GROQ_API_KEY from environment variables and forwards chat completions.
 */

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,OPTIONS,PATCH,DELETE,POST,PUT"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res
            .status(405)
            .json({ error: { message: "Method not allowed. Use POST." } });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: {
                message:
                    "GROQ_API_KEY is not set in environment variables. Please configure it in your Vercel Project Settings.",
            },
        });
    }

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const {
            model = "openai/gpt-oss-120b",
            messages = [],
            temperature = 0.7,
        } = body;

        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                }),
            }
        );

        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            return res.status(groqResponse.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Vercel API error:", error);
        return res.status(500).json({
            error: { message: error.message || "Internal server error" },
        });
    }
}
