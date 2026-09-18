/**
 * Selam AI (ሰላም AI) - Main Application Controller
 * Integrates Groq API, Ethiopian Calendar, Multilingual UI, Voice Input, and Session Persistence.
 */

import { api } from "./api_key.js";
import {
    toEthiopian,
    toGregorian,
    ETHIOPIAN_MONTHS,
    ETHIOPIAN_WEEKDAYS,
} from "./ethiopianCalendar.js";
import {
    SYSTEM_PROMPTS,
    PROMPT_CATEGORIES,
    UI_TRANSLATIONS,
} from "./ethiopianPrompts.js";

// ==========================================================================
// App State & Configuration
// ==========================================================================
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

let currentLang = localStorage.getItem("selam_ai_lang") || "am";
let currentTheme = localStorage.getItem("selam_ai_theme") || "dark";
let currentModel = localStorage.getItem("selam_ai_model") || "openai/gpt-oss-120b";
let currentPersona = localStorage.getItem("selam_ai_persona") || "general";
let customApiKey = localStorage.getItem("selam_ai_custom_key") || "";

// Chat Sessions State
let sessions = JSON.parse(localStorage.getItem("selam_ai_sessions") || "[]");
let currentSessionId = localStorage.getItem("selam_ai_current_session") || null;
let conversation = []; // Active conversation messages: [{ role, content }]

let isGenerating = false;
let speechRecognition = null;
let isRecording = false;

// ==========================================================================
// DOM Elements
// ==========================================================================
const chatScrollContainer = document.getElementById("chatScrollContainer");
const chatMessages = document.getElementById("chatMessages");
const emptyState = document.getElementById("emptyState");
const promptChipsGrid = document.getElementById("promptChipsGrid");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const charCountDisplay = document.getElementById("charCountDisplay");

// Sidebar & Header Elements
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const newChatBtn = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");
const langSelect = document.getElementById("langSelect");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIconSun = document.getElementById("themeIconSun");
const themeIconMoon = document.getElementById("themeIconMoon");
const ethDateBadge = document.getElementById("ethDateBadge");
const ethDateDisplay = document.getElementById("ethDateDisplay");

// Modal Elements
const dateConverterModal = document.getElementById("dateConverterModal");
const gregDateInput = document.getElementById("gregDateInput");
const ethDateResult = document.getElementById("ethDateResult");
const openCalendarModalBtn = document.getElementById("openCalendarModalBtn");
const closeDateModalBtn = document.getElementById("closeDateModalBtn");
const closeDateModalBtn2 = document.getElementById("closeDateModalBtn2");

const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");
const closeSettingsModalBtn2 = document.getElementById("closeSettingsModalBtn2");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const modelSelect = document.getElementById("modelSelect");
const personaSelect = document.getElementById("personaSelect");
const customApiKeyInput = document.getElementById("customApiKeyInput");

const clearConfirmModal = document.getElementById("clearConfirmModal");
const clearChatBtn = document.getElementById("clearChatBtn");
const cancelClearBtn = document.getElementById("cancelClearBtn");
const confirmClearBtn = document.getElementById("confirmClearBtn");
const closeClearModalBtn = document.getElementById("closeClearModalBtn");
const exportChatBtn = document.getElementById("exportChatBtn");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initLanguage();
    initEthiopianCalendarBadge();
    initSession();
    renderPromptChips();
    setupEventListeners();
    setupSpeechRecognition();
    setupMarkdown();
});

function getApiKey() {
    return customApiKey.trim() !== "" ? customApiKey.trim() : api;
}

// Setup Marked.js with syntax highlighting
function setupMarkdown() {
    if (window.marked) {
        window.marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function (code, lang) {
                if (window.hljs) {
                    const validLang = window.hljs.getLanguage(lang) ? lang : "plaintext";
                    return window.hljs.highlight(code, { language: validLang }).value;
                }
                return code;
            },
        });
    }
}

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
    document.documentElement.setAttribute("data-theme", currentTheme);
    updateThemeIcon();
}

function toggleTheme() {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("selam_ai_theme", currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    if (currentTheme === "light") {
        themeIconSun.style.display = "none";
        themeIconMoon.style.display = "block";
    } else {
        themeIconSun.style.display = "block";
        themeIconMoon.style.display = "none";
    }
}

// ==========================================================================
// Language & Localization Management
// ==========================================================================
function initLanguage() {
    langSelect.value = currentLang;
    applyLanguage(currentLang);
}

function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("selam_ai_lang", lang);
    document.documentElement.lang = lang;

    const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

    // Header & Sidebar
    document.getElementById("sidebarTitle").innerText = t.appTitle;
    document.getElementById("newChatText").innerText = t.newChat;
    document.getElementById("historyTitle").innerText = t.chatHistory;
    document.getElementById("exportChatText").innerText = t.exportChat;
    document.getElementById("clearChatText").innerText = t.clearChat;

    // Empty State Hero
    const heroTitle = document.getElementById("heroTitle");
    const heroSubtitle = document.getElementById("heroSubtitle");
    if (heroTitle) heroTitle.innerText = t.emptyHeroTitle;
    if (heroSubtitle) heroSubtitle.innerText = t.emptyHeroSubtitle;

    // Input Area
    promptInput.placeholder = t.placeholder;
    promptInput.setAttribute("aria-label", t.placeholder);
    updateCharCount();

    // Modals
    document.getElementById("modalDateTitle").innerText = `📅 ${t.dateConverterTitle}`;
    document.getElementById("modalClearTitle").innerText = `⚠️ ${t.clearChat}`;
    document.getElementById("clearModalMessage").innerText = t.confirmClear;
    document.getElementById("cancelClearBtn").innerText = t.cancel;
    document.getElementById("confirmClearBtn").innerText = t.confirm;

    // Re-render prompt suggestions in selected language
    renderPromptChips();
}

// ==========================================================================
// Ethiopian Calendar Live Badge & Converter
// ==========================================================================
function initEthiopianCalendarBadge() {
    const todayEth = toEthiopian(new Date());
    ethDateDisplay.innerText = todayEth.formattedAm;
    ethDateBadge.title = `${todayEth.formattedAm} (${todayEth.formattedEn})`;

    // Initialize date converter input with today's Gregorian date
    const todayStr = new Date().toISOString().split("T")[0];
    gregDateInput.value = todayStr;
    updateDateConversion(todayStr);
}

function updateDateConversion(gregDateStr) {
    if (!gregDateStr) return;
    const [y, m, d] = gregDateStr.split("-").map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const eth = toEthiopian(selectedDate);

    let html = `
        <div style="font-size: 1.15rem; font-weight: 700; margin-bottom: 6px;">
            🇪🇹 ${eth.formattedAm}
        </div>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;">
            ${eth.formattedEn}
        </div>
    `;

    if (eth.holidayAm) {
        html += `
            <div style="margin-top: 8px; color: var(--eth-gold); font-size: 0.9rem; font-weight: 600;">
                ✨ የዛሬ በዓል: ${eth.holidayAm} (${eth.holidayEn})
            </div>
        `;
    }

    ethDateResult.innerHTML = html;
}

// ==========================================================================
// Prompt Chips
// ==========================================================================
function renderPromptChips() {
    if (!promptChipsGrid) return;
    promptChipsGrid.innerHTML = "";

    PROMPT_CATEGORIES.forEach((cat) => {
        const title = currentLang === "am" ? cat.titleAm : cat.titleEn;
        const promptText = currentLang === "am" ? cat.promptAm : cat.promptEn;

        const chip = document.createElement("div");
        chip.className = "prompt-chip";
        chip.innerHTML = `
            <div class="chip-header">
                <span>${cat.icon}</span>
                <span>${title}</span>
            </div>
            <div class="chip-desc">${promptText}</div>
        `;

        chip.addEventListener("click", () => {
            promptInput.value = promptText;
            promptInput.focus();
            autoResizeTextarea();
            sendMessage();
        });

        promptChipsGrid.appendChild(chip);
    });
}

// ==========================================================================
// Session & Conversation Management
// ==========================================================================
function initSession() {
    renderHistoryList();

    if (currentSessionId) {
        const found = sessions.find((s) => s.id === currentSessionId);
        if (found) {
            loadSession(currentSessionId);
            return;
        }
    }

    startNewChat();
}

function startNewChat() {
    currentSessionId = "session_" + Date.now();
    conversation = [];
    localStorage.setItem("selam_ai_current_session", currentSessionId);
    renderMessages();
    renderHistoryList();
    closeMobileSidebar();
}

function loadSession(id) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    currentSessionId = id;
    conversation = session.messages || [];
    localStorage.setItem("selam_ai_current_session", currentSessionId);
    renderMessages();
    renderHistoryList();
    closeMobileSidebar();
}

function saveCurrentSession() {
    if (!currentSessionId) return;

    let title = "ጭውውት";
    const firstUserMsg = conversation.find((m) => m.role === "user");
    if (firstUserMsg) {
        title = firstUserMsg.content.slice(0, 32);
        if (firstUserMsg.content.length > 32) title += "...";
    }

    const existingIndex = sessions.findIndex((s) => s.id === currentSessionId);
    const sessionData = {
        id: currentSessionId,
        title: title,
        messages: conversation,
        updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
        sessions[existingIndex] = sessionData;
    } else {
        sessions.unshift(sessionData);
    }

    // Keep top 30 sessions
    if (sessions.length > 30) sessions = sessions.slice(0, 30);

    localStorage.setItem("selam_ai_sessions", JSON.stringify(sessions));
    renderHistoryList();
}

function deleteSession(id, event) {
    if (event) event.stopPropagation();
    sessions = sessions.filter((s) => s.id !== id);
    localStorage.setItem("selam_ai_sessions", JSON.stringify(sessions));

    if (currentSessionId === id) {
        startNewChat();
    } else {
        renderHistoryList();
    }
}

function renderHistoryList() {
    historyList.innerHTML = "";

    if (sessions.length === 0) {
        const t = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
        historyList.innerHTML = `<li style="padding: 10px; color: var(--text-muted); font-size: 0.82rem; text-align: center;">${t.noHistory}</li>`;
        return;
    }

    sessions.forEach((s) => {
        const li = document.createElement("li");
        li.className = `history-item ${s.id === currentSessionId ? "active" : ""}`;
        li.innerHTML = `
            <span>💬 ${escapeHtml(s.title || "ውይይት")}</span>
            <button class="history-item-del" title="ሰርዝ" aria-label="Delete chat">✕</button>
        `;

        li.addEventListener("click", () => loadSession(s.id));
        const delBtn = li.querySelector(".history-item-del");
        delBtn.addEventListener("click", (e) => deleteSession(s.id, e));

        historyList.appendChild(li);
    });
}

// ==========================================================================
// Chat Rendering & Actions
// ==========================================================================
function renderMessages() {
    chatMessages.innerHTML = "";

    if (conversation.length === 0) {
        chatMessages.appendChild(emptyState);
        emptyState.style.display = "flex";
        return;
    }

    emptyState.style.display = "none";

    conversation.forEach((msg, idx) => {
        appendMessageElement(msg.role, msg.content, idx);
    });

    scrollToBottom();
}

function appendMessageElement(role, content, index) {
    const isUser = role === "user";
    const row = document.createElement("div");
    row.className = `message-row ${isUser ? "user" : "ai"}`;

    const avatarHtml = isUser
        ? `<div class="msg-avatar user">👤</div>`
        : `<div class="msg-avatar ai">🦁</div>`;

    let formattedText = content;
    if (!isUser && window.marked) {
        try {
            formattedText = window.marked.parse(content);
        } catch (e) {
            console.error("Markdown parse error:", e);
            formattedText = escapeHtml(content);
        }
    } else if (isUser) {
        formattedText = escapeHtml(content).replace(/\n/g, "<br/>");
    }

    let actionToolbarHtml = "";
    if (!isUser) {
        const t = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
        actionToolbarHtml = `
            <div class="msg-action-bar">
                <button class="action-btn copy-btn" title="${t.copyMessage}" data-index="${index}">
                    📋 ${t.copyMessage}
                </button>
                <button class="action-btn speak-btn" title="${t.readAloud}" data-index="${index}">
                    🔊 ${t.readAloud}
                </button>
            </div>
        `;
    }

    row.innerHTML = `
        ${!isUser ? avatarHtml : ""}
        <div class="msg-content-wrapper">
            <div class="msg-bubble">
                ${formattedText}
            </div>
            ${actionToolbarHtml}
        </div>
        ${isUser ? avatarHtml : ""}
    `;

    // Attach copy & speak event listeners
    if (!isUser) {
        const copyBtn = row.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => copyToClipboard(content));
        }

        const speakBtn = row.querySelector(".speak-btn");
        if (speakBtn) {
            speakBtn.addEventListener("click", () => speakText(content, speakBtn));
        }

        // Add code block copy buttons
        row.querySelectorAll("pre").forEach((pre) => {
            if (!pre.querySelector(".code-header")) {
                const codeHeader = document.createElement("div");
                codeHeader.className = "code-header";
                codeHeader.innerHTML = `
                    <span>ኮድ (Code)</span>
                    <button class="copy-code-btn">📋 ቅዳ (Copy)</button>
                `;
                const copyCodeBtn = codeHeader.querySelector(".copy-code-btn");
                copyCodeBtn.addEventListener("click", () => {
                    const code = pre.querySelector("code")?.innerText || "";
                    copyToClipboard(code);
                });
                pre.prepend(codeHeader);
            }
        });
    }

    chatMessages.appendChild(row);
}

function showThinkingIndicator() {
    const t = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
    const row = document.createElement("div");
    row.id = "thinkingIndicator";
    row.className = "message-row ai";
    row.innerHTML = `
        <div class="msg-avatar ai">🦁</div>
        <div class="msg-content-wrapper">
            <div class="thinking-bubble">
                <div class="thinking-dots">
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                </div>
                <span>${t.thinking}</span>
            </div>
        </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
}

function removeThinkingIndicator() {
    const indicator = document.getElementById("thinkingIndicator");
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
}

// ==========================================================================
// Sending Messages & Groq API Call
// ==========================================================================
async function sendMessage() {
    if (isGenerating) return;

    const promptText = promptInput.value.trim();
    if (!promptText) return;

    // Reset prompt input and resize
    promptInput.value = "";
    autoResizeTextarea();
    updateCharCount();

    // If empty state is visible, hide it
    if (emptyState) emptyState.style.display = "none";

    // Append user message
    conversation.push({ role: "user", content: promptText });
    appendMessageElement("user", promptText, conversation.length - 1);
    scrollToBottom();
    saveCurrentSession();

    // Show loading thinking indicator
    isGenerating = true;
    sendBtn.disabled = true;
    showThinkingIndicator();

    try {
        const systemInstruction =
            SYSTEM_PROMPTS[currentPersona] || SYSTEM_PROMPTS.general;

        // Add dynamic current date context to the AI
        const todayEth = toEthiopian(new Date());
        const dateContext = `\n[Current Time Info: Gregorian: ${new Date().toDateString()}, Ethiopian Date: ${todayEth.formattedAm} (${todayEth.formattedEn})].`;

        const messagesPayload = [
            {
                role: "system",
                content: systemInstruction + dateContext,
            },
            ...conversation,
        ];

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getApiKey()}`,
            },
            body: JSON.stringify({
                model: currentModel,
                messages: messagesPayload,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
                errData.error?.message || `HTTP error! Status: ${response.status}`
            );
        }

        const data = await response.json();
        const aiResponse =
            data.choices?.[0]?.message?.content ||
            "ይቅርታ፣ ምንም መልስ አልተገኘም። እባክዎ እንደገና ይሞክሩ።";

        removeThinkingIndicator();

        // Append AI response
        conversation.push({ role: "assistant", content: aiResponse });
        appendMessageElement("assistant", aiResponse, conversation.length - 1);
        saveCurrentSession();
    } catch (error) {
        console.error("Chat Error:", error);
        removeThinkingIndicator();

        const errorMsg =
            currentLang === "am"
                ? `⚠️ ይቅርታ፣ ችግር አጋጥሟል: ${error.message}። እባክዎ የበይነመረብ ግንኙነትዎን ወይም የ API ቁልፍዎን ያረጋግጡ።`
                : `⚠️ Sorry, an error occurred: ${error.message}. Please check your connection or API key.`;

        appendMessageElement("assistant", errorMsg, conversation.length);
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
        scrollToBottom();
        promptInput.focus();
    }
}

// ==========================================================================
// Voice Input (Web Speech Recognition)
// ==========================================================================
function setupSpeechRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceBtn.style.display = "none";
        return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;

    speechRecognition.onstart = () => {
        isRecording = true;
        voiceBtn.classList.add("voice-active");
        showToast(UI_TRANSLATIONS[currentLang]?.voiceListening || "Listening...", "🎙️");
    };

    speechRecognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        promptInput.value = transcript;
        autoResizeTextarea();
        updateCharCount();
    };

    speechRecognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        stopRecording();
    };

    speechRecognition.onend = () => {
        stopRecording();
        if (promptInput.value.trim() !== "") {
            sendMessage();
        }
    };
}

function toggleVoiceInput() {
    if (!speechRecognition) {
        showToast("Voice input not supported in this browser", "⚠️");
        return;
    }

    if (isRecording) {
        speechRecognition.stop();
        stopRecording();
    } else {
        // Set speech recognition language
        speechRecognition.lang = currentLang === "am" ? "am-ET" : "en-US";
        try {
            speechRecognition.start();
        } catch (e) {
            console.error("Speech start error:", e);
        }
    }
}

function stopRecording() {
    isRecording = false;
    voiceBtn.classList.remove("voice-active");
}

// ==========================================================================
// Text to Speech (Speech Synthesis)
// ==========================================================================
function speakText(text, btnElement) {
    if (!("speechSynthesis" in window)) {
        showToast("Speech synthesis is not supported in this browser", "⚠️");
        return;
    }

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (btnElement) btnElement.innerText = `🔊 ${UI_TRANSLATIONS[currentLang]?.readAloud || "Read aloud"}`;
        return;
    }

    // Clean markdown before speaking
    const cleanText = text.replace(/[*#`_\[\]()]/g, "").slice(0, 400);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = currentLang === "am" ? "am-ET" : "en-US";
    utterance.rate = 0.95;

    if (btnElement) {
        btnElement.innerText = `⏹️ ${UI_TRANSLATIONS[currentLang]?.speaking || "Reading..."}`;
        utterance.onend = () => {
            btnElement.innerText = `🔊 ${UI_TRANSLATIONS[currentLang]?.readAloud || "Read aloud"}`;
        };
        utterance.onerror = () => {
            btnElement.innerText = `🔊 ${UI_TRANSLATIONS[currentLang]?.readAloud || "Read aloud"}`;
        };
    }

    window.speechSynthesis.speak(utterance);
}

// ==========================================================================
// Utilities (Toast, Copy, Export, Resize)
// ==========================================================================
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const t = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
        showToast(t.copied || "Copied to clipboard!", "✓");
    });
}

function showToast(message, icon = "✓") {
    toastMessage.innerText = message;
    document.getElementById("toastIcon").innerText = icon;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

function exportConversation() {
    if (conversation.length === 0) {
        showToast("ምንም የሚወርድ ውይይት የለም", "ℹ️");
        return;
    }

    let markdown = `# Selam AI - ውይይት\n\n`;
    markdown += `*የወረደበት ቀን: ${new Date().toLocaleString()}*\n\n---\n\n`;

    conversation.forEach((msg) => {
        const sender = msg.role === "user" ? "👤 ተጠቃሚ (User)" : "🦁 ሰላም AI";
        markdown += `### ${sender}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selam_ai_chat_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("ውይይቱ በተሳካ ሁኔታ ወርዷል!", "📥");
}

function autoResizeTextarea() {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + "px";
}

function updateCharCount() {
    const len = promptInput.value.length;
    const t = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
    charCountDisplay.innerText = `${len} ${t.charCount || "characters"}`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

function closeMobileSidebar() {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove("open");
    }
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
    // Input and Send
    sendBtn.addEventListener("click", sendMessage);

    promptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    promptInput.addEventListener("input", () => {
        autoResizeTextarea();
        updateCharCount();
    });

    voiceBtn.addEventListener("click", toggleVoiceInput);

    // Sidebar
    sidebarToggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
    });

    newChatBtn.addEventListener("click", startNewChat);
    exportChatBtn.addEventListener("click", exportConversation);

    // Header Controls
    themeToggleBtn.addEventListener("click", toggleTheme);

    langSelect.addEventListener("change", (e) => {
        applyLanguage(e.target.value);
    });

    ethDateBadge.addEventListener("click", () => {
        dateConverterModal.classList.add("active");
    });

    // Calendar Modal
    openCalendarModalBtn.addEventListener("click", () => {
        dateConverterModal.classList.add("active");
        closeMobileSidebar();
    });

    closeDateModalBtn.addEventListener("click", () => {
        dateConverterModal.classList.remove("active");
    });

    closeDateModalBtn2.addEventListener("click", () => {
        dateConverterModal.classList.remove("active");
    });

    gregDateInput.addEventListener("change", (e) => {
        updateDateConversion(e.target.value);
    });

    // Settings Modal
    settingsBtn.addEventListener("click", () => {
        modelSelect.value = currentModel;
        personaSelect.value = currentPersona;
        customApiKeyInput.value = customApiKey;
        settingsModal.classList.add("active");
    });

    closeSettingsModalBtn.addEventListener("click", () => {
        settingsModal.classList.remove("active");
    });

    closeSettingsModalBtn2.addEventListener("click", () => {
        settingsModal.classList.remove("active");
    });

    saveSettingsBtn.addEventListener("click", () => {
        currentModel = modelSelect.value;
        currentPersona = personaSelect.value;
        customApiKey = customApiKeyInput.value.trim();

        localStorage.setItem("selam_ai_model", currentModel);
        localStorage.setItem("selam_ai_persona", currentPersona);
        localStorage.setItem("selam_ai_custom_key", customApiKey);

        settingsModal.classList.remove("active");
        showToast("ቅንብሮች ተቀምጠዋል! (Settings Saved)", "⚙️");
    });

    // Clear Chat Modal
    clearChatBtn.addEventListener("click", () => {
        clearConfirmModal.classList.add("active");
        closeMobileSidebar();
    });

    cancelClearBtn.addEventListener("click", () => {
        clearConfirmModal.classList.remove("active");
    });

    closeClearModalBtn.addEventListener("click", () => {
        clearConfirmModal.classList.remove("active");
    });

    confirmClearBtn.addEventListener("click", () => {
        clearConfirmModal.classList.remove("active");
        startNewChat();
        showToast("ውይይቱ ጸድቷል", "🗑️");
    });

    // Close modals when clicking outside modal-card
    [dateConverterModal, settingsModal, clearConfirmModal].forEach((modal) => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("active");
            }
        });
    });
}
