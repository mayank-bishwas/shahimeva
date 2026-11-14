/**
 * Shahi Meva Customer Assistant Chat Widget
 * Connects to Website Agent's /api/customer/ask endpoint (SSE streaming)
 */

(function () {
  "use strict";

  // Configuration
  const API_BASE = window.SHAHI_MEVA_CUSTOMER_API || "http://localhost:3001";
  const API_ENDPOINT = API_BASE + "/api/customer/ask";

  // State
  let history = [];
  let isStreaming = false;
  let currentAssistantMessage = null;
  let currentAssistantBlocks = [];
  let currentRawText = "";
  let abortController = null;

  // DOM elements
  let launcher = null;
  let panel = null;
  let messagesContainer = null;
  let input = null;
  let sendBtn = null;
  let reloadBtn = null;
  let closeBtn = null;
  let typingIndicator = null;

  // Initialize widget
  function init() {
    buildDOM();
    bindEvents();
    showWelcome();
  }

  // Build widget DOM
  function buildDOM() {
    // Launcher
    launcher = document.createElement("button");
    launcher.className = "chat-launcher";
    launcher.setAttribute("aria-label", "Open Customer Assistant");
    launcher.innerHTML = `
      <img class="chat-launcher-art" src="assets/chatbot_outline.png" alt="" width="112" height="112">
      <img class="chat-launcher-logo" src="assets/logo.png" alt="Shahi Meva" width="57" height="57">
    `;
    document.body.appendChild(launcher);

    // Panel
    panel = document.createElement("div");
    panel.className = "chat-panel hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Customer Assistant");
    panel.innerHTML = `
      <header class="chat-header">
        <div class="chat-brand">
          <img src="assets/logo.png" alt="Shahi Meva" width="32" height="32">
          <span class="chat-title">Customer Assistant</span>
        </div>
        <div class="chat-actions">
          <button class="chat-action-btn" id="chat-reload" aria-label="Start new conversation" title="New conversation">
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path></svg>
          </button>
          <button class="chat-action-btn" id="chat-close" aria-label="Close chat" title="Close">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
          </button>
        </div>
      </header>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-composer">
        <div class="chat-composer-inner">
          <textarea class="chat-input" id="chat-input" placeholder="Type your question..." rows="1" aria-label="Your question"></textarea>
          <button class="chat-send" id="chat-send" aria-label="Send" disabled>
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Cache elements
    messagesContainer = panel.querySelector("#chat-messages");
    input = panel.querySelector("#chat-input");
    sendBtn = panel.querySelector("#chat-send");
    reloadBtn = panel.querySelector("#chat-reload");
    closeBtn = panel.querySelector("#chat-close");

    // Auto-resize textarea and toggle send button
    input.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
      sendBtn.disabled = !this.value.trim() || isStreaming;
    });
  }

  // Bind events
  function bindEvents() {
    launcher.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", hidePanel);
    reloadBtn.addEventListener("click", reloadConversation);

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.classList.contains("hidden")) {
        hidePanel();
      }
    });
  }

  // Toggle panel
  function togglePanel() {
    if (panel.classList.contains("hidden")) {
      showPanel();
    } else {
      hidePanel();
    }
  }

  function showPanel() {
    panel.classList.remove("hidden");
    launcher.style.display = "none";
    input.focus();
  }

  function hidePanel() {
    panel.classList.add("hidden");
    launcher.style.display = "flex";
  }

  // Reload conversation
  function reloadConversation() {
    history = [];
    messagesContainer.innerHTML = "";
    showWelcome();
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
  }

  // Show welcome message
  function showWelcome() {
    const welcome = document.createElement("div");
    welcome.className = "chat-welcome";
    welcome.textContent = "शाही मेवा में आपका स्वागत है!";

    const supporting = document.createElement("div");
    supporting.className = "chat-welcome-supporting";
    supporting.textContent = "आप हमारे स्टॉक, डिलीवरी, या अन्य जानकारी पूछ सकते हैं।";

    welcome.appendChild(supporting);
    messagesContainer.appendChild(welcome);
  }

  // Send message
  async function sendMessage() {
    const question = input.value.trim();
    if (!question || isStreaming) return;

    // Add user message
    addUserMessage(question);
    history.push({ role: "user", content: question });

    // Clear input
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;

    // Show typing indicator
    showTyping();

    // Call API
    try {
      await callAskAPI(question);
    } catch (error) {
      hideTyping();
      showError("Something went wrong. Please try again.");
      console.error("Chat error:", error);
    }
  }

  // Call the customer ASK API
  async function callAskAPI(question) {
    abortController = new AbortController();

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question,
        history: history.slice(0, -1), // Exclude the current question we just added
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasStarted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const chunk of lines) {
        if (!chunk.trim()) continue;
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;

        try {
          const event = JSON.parse(dataLine.slice(5).trim());
          handleSSEEvent(event);
          hasStarted = true;
        } catch (e) {
          console.warn("Failed to parse SSE event:", e);
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const dataLine = buffer.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        try {
          const event = JSON.parse(dataLine.slice(5).trim());
          handleSSEEvent(event);
        } catch (e) {
          console.warn("Failed to parse final SSE event:", e);
        }
      }
    }

    if (!hasStarted) {
      hideTyping();
      showError("No response received. Please try again.");
    }
  }

  // Handle SSE events
  function handleSSEEvent(event) {
    switch (event.type) {
      case "reset":
        hideTyping();
        if (currentAssistantMessage) {
          currentAssistantMessage.remove();
          currentAssistantMessage = null;
          currentAssistantBlocks = [];
          currentRawText = "";
        }
        break;

      case "token":
        hideTyping();
        appendToken(event.token);
        break;

      case "answer":
        hideTyping();
        if (!currentAssistantMessage) {
          // Full answer received without streaming tokens
          addAssistantMessage(event.answer);
        }
        break;

      case "done":
        finalizeAssistantMessage(event.contactOffered);
        break;

      case "error":
        hideTyping();
        if (currentAssistantMessage) {
          currentAssistantMessage.remove();
          currentAssistantMessage = null;
          currentAssistantBlocks = [];
          currentRawText = "";
        }
        showError("I couldn't generate a response. Please try again.");
        break;
    }
  }

  // Copy button icons (mirrors merchant ASK copy-button)
  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"></rect><path d="M16 5V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h1"></path></svg>';
  const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';

  // Copy text to clipboard with a textarea fallback
  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        return ok;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  // Build an independent copy button for one completed assistant response
  function createCopyButton(rawText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-copy-button";
    button.setAttribute("aria-label", "Copy response");
    button.title = "Copy response";
    button.innerHTML = COPY_ICON + "<span>Copy</span>";

    button.addEventListener("click", async function () {
      const ok = await copyTextToClipboard(rawText);
      button.classList.toggle("copied", ok);
      button.setAttribute("aria-label", ok ? "Response copied" : "Copy failed");
      button.title = ok ? "Copied" : "Copy failed";
      button.innerHTML = (ok ? CHECK_ICON : COPY_ICON) + "<span>" + (ok ? "Copied" : "Copy failed") + "</span>";
      window.setTimeout(function () {
        button.classList.remove("copied");
        button.setAttribute("aria-label", "Copy response");
        button.title = "Copy response";
        button.innerHTML = COPY_ICON + "<span>Copy</span>";
      }, 1600);
    });

    return button;
  }

  // Append streaming token
  function appendToken(token) {
    if (!currentAssistantMessage) {
      currentAssistantMessage = document.createElement("div");
      currentAssistantMessage.className = "chat-message assistant chat-pending formatted-message";
      messagesContainer.appendChild(currentAssistantMessage);
    }

    // Accumulate raw markdown and re-parse so formatting renders progressively
    currentRawText += token;
    currentAssistantBlocks = parseMarkdown(currentRawText);

    renderAssistantMessage();
    scrollToBottom();
  }

  // Render assistant message from blocks
  function renderAssistantMessage() {
    if (!currentAssistantMessage) return;

    const html = blocksToHTML(currentAssistantBlocks);
    currentAssistantMessage.innerHTML = html;
    scrollToBottom();
  }

  // Convert blocks to HTML
  function blocksToHTML(blocks) {
    return blocks
      .map((block) => {
        switch (block.type) {
          case "heading":
            return `<h3>${escapeHTML(block.text)}</h3>`;
          case "paragraph":
            return `<p>${formatInline(escapeHTML(block.text))}</p>`;
          case "list":
            const tag = block.ordered ? "ol" : "ul";
            return `<${tag}>${block.items.map((item) => `<li>${formatInline(escapeHTML(item))}</li>`).join("")}</${tag}>`;
          case "table":
            return renderTable(block.rows);
          default:
            return "";
        }
      })
      .join("");
  }

  // Render markdown table, or a bullet list when the table is too wide
  function renderTable(rows) {
    if (!rows.length) return "";
    const width = rows[0].length;
    const maxCellLength = Math.max(...rows.flat().map((cell) => cell.length));
    // Tables with many columns or long cells are hard to read in a narrow panel
    if (width > 3 || maxCellLength > 40) {
      return renderTableAsList(rows);
    }
    const html = ['<div class="chat-table-scroll"><table>'];
    rows.forEach((row, i) => {
      html.push("<tr>");
      row.forEach((cell) => {
        const tag = i === 0 ? "th" : "td";
        html.push(`<${tag}>${formatInline(escapeHTML(cell))}</${tag}>`);
      });
      html.push("</tr>");
    });
    html.push("</table></div>");
    return html.join("");
  }

  // Present a table as a readable bullet list
  function renderTableAsList(rows) {
    if (!rows.length) return "";
    const header = rows[0];
    const items = rows.slice(1).map((row) => {
      const parts = row.map((cell, i) => {
        const label = header[i] ? `${header[i]}: ` : "";
        return `${label}${cell}`;
      });
      return `<li>${formatInline(escapeHTML(parts.join(" — ")))}</li>`;
    });
    return `<ul>${items.join("")}</ul>`;
  }

  // Format inline markdown (bold, italic, code)
  function formatInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  // Escape HTML
  function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Finalize assistant message
  function finalizeAssistantMessage(contactOffered) {
    if (currentAssistantMessage) {
      currentAssistantMessage.classList.remove("chat-pending");
      // Add to history
      const fullText = currentRawText;
      history.push({ role: "assistant", content: fullText });
      // Add an independent copy button for this completed response
      const copyButton = createCopyButton(fullText);
      currentAssistantMessage.insertAdjacentElement("afterend", copyButton);
      currentAssistantMessage = null;
      currentAssistantBlocks = [];
      currentRawText = "";
    }
    sendBtn.disabled = false;
    input.focus();
  }

  // Add user message
  function addUserMessage(text) {
    // Remove welcome screen on first customer message
    const welcome = messagesContainer.querySelector(".chat-welcome");
    if (welcome) {
      welcome.remove();
    }

    const msg = document.createElement("div");
    msg.className = "chat-message user";
    msg.textContent = text;
    messagesContainer.appendChild(msg);
    scrollToBottom();
  }

  // Add assistant message (full, non-streaming)
  function addAssistantMessage(text) {
    const blocks = parseMarkdown(text);
    const html = blocksToHTML(blocks);
    const msg = document.createElement("div");
    msg.className = "chat-message assistant formatted-message";
    msg.innerHTML = html;
    messagesContainer.appendChild(msg);
    history.push({ role: "assistant", content: text });
    // Add an independent copy button for this completed response
    const copyButton = createCopyButton(text);
    msg.insertAdjacentElement("afterend", copyButton);
    scrollToBottom();
    sendBtn.disabled = false;
    input.focus();
  }

  // Parse markdown (mirrors website_agent/lib/ask/format.ts)
  function parseMarkdown(markdown) {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];
    let index = 0;

    function cellsFromRow(line) {
      const escapedPipe = "\u0000";
      const normalized = line.trim().replace(/\\\|/g, escapedPipe);
      const withoutEdges = normalized.replace(/^\|/, "").replace(/\|$/, "");
      return withoutEdges.split("|").map((cell) => cell.replaceAll(escapedPipe, "|").trim());
    }

    function isTableSeparator(line) {
      return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
    }

    function isTableStart(lines, index) {
      return index + 1 < lines.length && lines[index].includes("|") && isTableSeparator(lines[index + 1]);
    }

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (isTableStart(lines, index)) {
        const rows = [cellsFromRow(line)];
        index += 2;
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          rows.push(cellsFromRow(lines[index]));
          index += 1;
        }
        const width = rows[0].length;
        blocks.push({
          type: "table",
          rows: rows.map((row) => [...row.slice(0, width), ...Array(Math.max(0, width - row.length)).fill("")]),
        });
        continue;
      }

      if (/^#{1,3}\s+/.test(line)) {
        blocks.push({ type: "heading", text: line.replace(/^#{1,3}\s+/, "").trim() });
        index += 1;
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*]\s+/, "").trim());
          index += 1;
        }
        blocks.push({ type: "list", items, ordered: false });
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+\.\s+/, "").trim());
          index += 1;
        }
        blocks.push({ type: "list", items, ordered: true });
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^#{1,3}\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+\.\s+/.test(lines[index]) &&
        !isTableStart(lines, index)
      ) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    }

    return blocks;
  }

  // Show typing indicator
  function showTyping() {
    isStreaming = true;
    typingIndicator = document.createElement("div");
    typingIndicator.className = "chat-typing";
    typingIndicator.innerHTML = "<span></span><span></span><span></span>";
    messagesContainer.appendChild(typingIndicator);
    scrollToBottom();
  }

  // Hide typing indicator
  function hideTyping() {
    isStreaming = false;
    if (typingIndicator) {
      typingIndicator.remove();
      typingIndicator = null;
    }
  }

  // Show error
  function showError(message) {
    const error = document.createElement("div");
    error.className = "chat-error";
    error.textContent = message;
    messagesContainer.appendChild(error);
    scrollToBottom();
    sendBtn.disabled = false;
    input.focus();
  }

  // Scroll to bottom
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Initialize when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();