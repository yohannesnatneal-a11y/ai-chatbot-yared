import { api } from "./api_key.js";

const chat = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

// const API_URL =
//     "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = api;
let conversation = [];

sendBtn.addEventListener("click", sendMessage);

async function sendMessage() {
    // Get the user's message

    const prompt = promptInput.value.trim();

    // Don't send an empty message

    if (prompt === "") {
        return;
    }

    // Show the user's message

    chat.innerHTML += `
        <div class="message user">
            ${prompt}
        </div>
    `;

    // Add user message to conversation

    conversation.push({
        role: "user",
        content: prompt,
    });

    // Clear input

    promptInput.value = "";

    // Show loading

    chat.innerHTML += `
        <div id="loading" class="message ai">
            Thinking...
        </div>
    `;

    try {
        // Send request to AI
        const response = await fetch(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },

            body: JSON.stringify({
                model: "openai/gpt-oss-120b",
                messages: conversation,
            }),
        });

        const data = await response.json();

        const aiMessage = data.choices[0].message.content;

        // Remove loading

        document.getElementById("loading").remove();

        // Show AI response

        const formattedMessage = marked.parse(aiMessage);

        chat.innerHTML += `
            <div class="message ai">
                ${formattedMessage}
            </div>
        `;

        // Add AI response to conversation

        conversation.push({
            role: "assistant",
            content: aiMessage,
        });
    } catch (error) {
        console.log(error);

        // Remove loading

        const loading = document.getElementById("loading");

        if (loading) {
            loading.remove();
        }

        // Show error

        chat.innerHTML += `
            <div class="message ai">
                Sorry, something went wrong.
            </div>
        `;
    }
}
