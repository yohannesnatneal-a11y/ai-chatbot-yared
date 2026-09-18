/**
 * Selam AI - Local Node.js Development Server
 * Serves static web assets and proxies /api/chat using .env environment variables.
 * Uses only built-in Node.js modules (zero npm dependencies required).
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
function loadEnv() {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
                const [key, ...values] = trimmed.split("=");
                if (key) {
                    const cleanKey = key.trim();
                    const cleanVal = values
                        .join("=")
                        .trim()
                        .replace(/^["']|["']$/g, "");
                    if (!process.env[cleanKey]) {
                        process.env[cleanKey] = cleanVal;
                    }
                }
            }
        });
    }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
    // Enable CORS for development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Handle /api/chat endpoint
    if (pathname === "/api/chat" && req.method === "POST") {
        if (!GROQ_API_KEY) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    error: {
                        message:
                            "GROQ_API_KEY is not defined in .env! Please set it in your .env file.",
                    },
                })
            );
            return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
            try {
                const parsedBody = JSON.parse(body || "{}");
                const {
                    model = "openai/gpt-oss-120b",
                    messages = [],
                    temperature = 0.7,
                } = parsedBody;

                const groqRes = await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${GROQ_API_KEY}`,
                        },
                        body: JSON.stringify({ model, messages, temperature }),
                    }
                );

                const data = await groqRes.json();
                res.writeHead(groqRes.status, {
                    "Content-Type": "application/json",
                });
                res.end(JSON.stringify(data));
            } catch (err) {
                console.error("API error:", err);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: { message: err.message } }));
            }
        });
        return;
    }

    // Serve Static Files
    let safePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.join(__dirname, safePath);

    // Prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 Not Found");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`🦁 Selam AI Server running on http://localhost:${PORT}`);
    console.log(`🔑 GROQ_API_KEY loaded: ${GROQ_API_KEY ? "Yes (Protected)" : "No (Missing in .env)"}`);
    console.log(`🌐 Ready for local testing and Vercel deployment`);
    console.log(`==============================================\n`);
});
