/**
 * Shahi Meva Customer Assistant Chat Widget
 * Connects to Website Agent's /api/customer/ask endpoint (SSE streaming)
 */

(function () {
  "use strict";

  // Configuration
  const API_BASE = window.SHAHI_MEVA_CUSTOMER_API || "https://website-ai-flax.vercel.app";
  const API_ENDPOINT = API_BASE + "/api/customer/ask";
  const TRANSCRIBE_ENDPOINT = API_BASE + "/api/customer/transcribe";
  const MAX_RECORDING_DURATION_MS = 60000;
  const MAX_CAPTURE_SIZE = 7500000;

  // Session persistence — keeps the conversation across page navigation
  const SESSION_KEY = "shahiMevaCustomerChat";
  const SESSION_TTL_MS = 30 * 60 * 1000;

  // State
  let history = [];
  let isStreaming = false;
  let currentAssistantMessage = null;
  let currentAssistantBlocks = [];
  let currentRawText = "";
  let abortController = null;

  // Voice recording state
  let voiceState = "idle"; // idle | requesting | recording | paused | transcribing
  let voiceSecondsRemaining = 60;
  let mediaRecorder = null;
  let mediaStream = null;
  let voiceChunks = [];
  let voiceAudioBlob = null;
  let voiceCountdownTimer = null;
  let voiceLimitTimer = null;
  let voiceStartedAt = 0;
  let voiceCancelled = false;
  let voiceStopRequested = false;
  let voicePermissionRequest = false;
  let voiceRequestInFlight = false;
  let voiceAbortController = null;

  // Persisted session state
  let sessionId = null;
  let lastActivity = 0;

  // DOM elements
  let launcher = null;
  let panel = null;
  let messagesContainer = null;
  let input = null;
  let sendBtn = null;
  let micBtn = null;
  let stopBtn = null;
  let composerInner = null;
  let voiceComposer = null;
  let voiceStatus = null;
  let voiceActions = null;
  let voiceError = null;
  let reloadBtn = null;
  let closeBtn = null;
  let typingIndicator = null;

  // Initialize widget
  function init() {
    buildDOM();
    bindEvents();
    if (isReloadNavigation()) {
      // A real browser reload starts a fresh session.
      startNewSession();
      showWelcome();
      return;
    }
    if (!restoreSession()) {
      startNewSession();
      showWelcome();
    }
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
          <button class="chat-mic" id="chat-mic" aria-label="Start voice message" title="Start voice message">
            <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"></path><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"></path></svg>
          </button>
          <button class="chat-stop hidden" id="chat-stop" aria-label="जवाब रोकें" title="जवाब रोकें">
            <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>
          </button>
        </div>
        <div class="chat-voice-composer hidden" id="chat-voice-composer" aria-label="Voice recording controls">
          <span class="chat-recording-dot" aria-hidden="true"></span>
          <span class="chat-voice-status" id="chat-voice-status" aria-live="polite"></span>
          <div class="chat-voice-actions" id="chat-voice-actions"></div>
        </div>
        <p class="chat-voice-error hidden" id="chat-voice-error" role="alert"></p>
      </div>
    `;
    document.body.appendChild(panel);

    // Cache elements
    messagesContainer = panel.querySelector("#chat-messages");
    input = panel.querySelector("#chat-input");
    sendBtn = panel.querySelector("#chat-send");
    micBtn = panel.querySelector("#chat-mic");
    stopBtn = panel.querySelector("#chat-stop");
    composerInner = panel.querySelector(".chat-composer-inner");
    voiceComposer = panel.querySelector("#chat-voice-composer");
    voiceStatus = panel.querySelector("#chat-voice-status");
    voiceActions = panel.querySelector("#chat-voice-actions");
    voiceError = panel.querySelector("#chat-voice-error");
    reloadBtn = panel.querySelector("#chat-reload");
    closeBtn = panel.querySelector("#chat-close");

    // Auto-resize textarea and toggle send/mic buttons
    input.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
      updateComposerButtons();
    });
    updateComposerButtons();
  }

  // Bind events
  function bindEvents() {
    launcher.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", hidePanel);
    reloadBtn.addEventListener("click", reloadConversation);

    sendBtn.addEventListener("click", sendMessage);
    micBtn.addEventListener("click", startVoiceRecording);
    stopBtn.addEventListener("click", stopResponse);
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

    // Expand/collapse the panel on mobile by tapping the header
    panel.querySelector(".chat-header").addEventListener("click", function (e) {
      if (e.target.closest(".chat-action-btn")) return;
      panel.classList.toggle("chat-panel-expanded");
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
    discardVoiceRecording();
    panel.classList.add("hidden");
    launcher.style.display = "flex";
  }

  // Reload conversation
  function reloadConversation() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isStreaming = false;
    history = [];
    messagesContainer.innerHTML = "";
    startNewSession();
    showWelcome();
    input.value = "";
    input.style.height = "auto";
    discardVoiceRecording();
    updateComposerButtons();
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

  // --- Session persistence (sessionStorage) ---
  // Keeps the conversation across homepage <-> inventory navigation.
  // A real browser reload clears the session; tab close ends it naturally.
  function generateSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "session-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  function isReloadNavigation() {
    try {
      const entries = performance.getEntriesByType && performance.getEntriesByType("navigation");
      if (entries && entries.length) return entries[0].type === "reload";
      if (performance.navigation) return performance.navigation.type === 1;
    } catch (error) {
      // Fall through — treat as a normal navigation.
    }
    return false;
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.history) || typeof data.lastActivity !== "number") return null;
      if (Date.now() - data.lastActivity > SESSION_TTL_MS) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function writeSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId: sessionId,
        history: history,
        lastActivity: lastActivity,
      }));
    } catch (error) {
      // Storage unavailable or full — the conversation simply won't persist.
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Ignore.
    }
  }

  function touchSession() {
    lastActivity = Date.now();
    writeSession();
  }

  function renderRestoredMessage(entry) {
    if (!entry || typeof entry.content !== "string") return;
    if (entry.role === "user") {
      const msg = document.createElement("div");
      msg.className = "chat-message user";
      msg.textContent = entry.content;
      messagesContainer.appendChild(msg);
    } else if (entry.role === "assistant") {
      const blocks = parseMarkdown(entry.content);
      const html = blocksToHTML(blocks);
      const msg = document.createElement("div");
      msg.className = "chat-message assistant formatted-message";
      msg.innerHTML = html;
      messagesContainer.appendChild(msg);
      const copyButton = createCopyButton(entry.content);
      msg.insertAdjacentElement("afterend", copyButton);
    }
  }

  function restoreSession() {
    const data = readSession();
    if (!data) {
      clearSession();
      return false;
    }
    sessionId = typeof data.sessionId === "string" && data.sessionId ? data.sessionId : generateSessionId();
    history = data.history.slice();
    for (const entry of history) renderRestoredMessage(entry);
    lastActivity = Date.now();
    writeSession();
    scrollToBottom();
    return true;
  }

  function startNewSession() {
    clearSession();
    sessionId = generateSessionId();
    lastActivity = Date.now();
  }

  // Voice recording — mirrors the merchant ASK voice flow
  const VOICE_TEXT = {
    permissionWaiting: "अनुमति की प्रतीक्षा…",
    permissionDenied: "माइक्रोफ़ोन की अनुमति नहीं मिली। अनुमति दें या टाइप करें।",
    microphoneUnavailable: "माइक्रोफ़ोन उपलब्ध नहीं है। आप टाइप कर सकते हैं।",
    unsupportedRecording: "वॉइस रिकॉर्डिंग यहाँ उपलब्ध नहीं है। आप टाइप कर सकते हैं।",
    unsupportedFormat: "वॉइस रिकॉर्डिंग यहाँ उपलब्ध नहीं है। आप टाइप कर सकते हैं।",
    recordingFailed: "रिकॉर्डिंग विफल रही। कृपया फिर कोशिश करें।",
    recordingTooLarge: "रिकॉर्डिंग बहुत बड़ी है। छोटी रिकॉर्डिंग आज़माएँ।",
    emptyRecording: "कोई आवाज़ नहीं मिली। कृपया फिर रिकॉर्ड करें।",
    networkError: "प्रोसेस नहीं हो पाया। कृपया फिर कोशिश करें।",
    transcriptionFailed: "प्रोसेस नहीं हो पाया। कृपया फिर कोशिश करें।",
    recording: "रिकॉर्डिंग",
    recordingStopped: "भेजने के लिए तैयार",
    startVoice: "वॉइस संदेश भेजें",
    stop: "रोकें",
    discard: "रद्द करें",
    transcribing: "लिख रहे हैं…",
    sendRecording: "भेजें",
    sendError: "रिकॉर्डिंग नहीं भेजी जा सकी। कृपया फिर कोशिश करें।",
    answerStopped: "आपने उत्तर रोक दिया।",
    stopResponse: "जवाब रोकें",
    sendingMessage: "संदेश भेजा जा रहा है",
  };

  function formatRecordingCountdown(seconds) {
    const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  }

  function setVoiceState(state) {
    voiceState = state;
    renderVoiceComposer();
  }

  function setVoiceError(message) {
    voiceError.textContent = message || "";
    voiceError.classList.toggle("hidden", !message);
  }

  function updateComposerButtons() {
    const hasText = input.value.trim().length > 0;
    const transcribing = voiceState === "transcribing";
    input.disabled = transcribing;
    sendBtn.disabled = !hasText || isStreaming || transcribing;
    sendBtn.classList.toggle("hidden", !hasText);
    micBtn.classList.toggle("hidden", hasText || voiceState !== "idle" || isStreaming);
    stopBtn.classList.toggle("hidden", !isStreaming || hasText || voiceState !== "idle");
  }

  // Stop an in-flight assistant response (mirrors merchant ASK stop-response)
  function stopResponse() {
    if (!isStreaming || !abortController) return;
    abortController.abort();
    abortController = null;
    hideTyping();
    if (currentAssistantMessage) {
      currentAssistantMessage.classList.remove("chat-pending");
      const stopped = document.createElement("small");
      stopped.className = "answer-stopped";
      stopped.textContent = VOICE_TEXT.answerStopped;
      currentAssistantMessage.appendChild(stopped);
      const fullText = currentRawText;
      history.push({ role: "assistant", content: fullText });
      touchSession();
      const copyButton = createCopyButton(fullText);
      currentAssistantMessage.insertAdjacentElement("afterend", copyButton);
      currentAssistantMessage = null;
      currentAssistantBlocks = [];
      currentRawText = "";
    }
    isStreaming = false;
    updateComposerButtons();
    input.focus();
  }

  function renderVoiceComposer() {
    const active = voiceState !== "idle";
    voiceComposer.className = "chat-voice-composer" + (active ? "" : " hidden") + (voiceState === "paused" ? " paused" : "");
    composerInner.classList.toggle("hidden", active);
    if (!active) {
      updateComposerButtons();
      return;
    }
    const status = voiceState === "requesting"
      ? VOICE_TEXT.permissionWaiting
      : voiceState === "recording"
        ? formatRecordingCountdown(voiceSecondsRemaining)
        : voiceState === "transcribing"
          ? ""
          : VOICE_TEXT.recordingStopped;
    voiceStatus.textContent = status;
    voiceActions.innerHTML = "";
    if (voiceState === "requesting") {
      voiceActions.appendChild(createVoiceButton("chat-voice-button", VOICE_TEXT.discard, discardVoiceRecording, "close"));
    } else if (voiceState === "recording") {
      voiceActions.appendChild(createVoiceButton("chat-voice-button", VOICE_TEXT.discard, discardVoiceRecording, "close"));
      voiceActions.appendChild(createVoiceButton("chat-voice-button chat-voice-primary", VOICE_TEXT.stop, stopVoiceRecording, "pause"));
    } else if (voiceState === "paused") {
      voiceActions.appendChild(createVoiceButton("chat-voice-button", VOICE_TEXT.discard, discardVoiceRecording, "close"));
      voiceActions.appendChild(createVoiceButton("chat-voice-button chat-voice-primary", VOICE_TEXT.sendRecording, sendVoiceRecording, "arrow-up"));
    }
  }

  function createVoiceButton(className, label, onClick, iconName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    if (iconName) button.innerHTML = VOICE_ICONS[iconName];
    else button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  const VOICE_ICONS = {
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"></path></svg>',
    "arrow-up": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8l-4.6 4.6L5 11z"></path></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>',
  };

  function clearVoiceTimers() {
    if (voiceCountdownTimer !== null) window.clearInterval(voiceCountdownTimer);
    if (voiceLimitTimer !== null) window.clearTimeout(voiceLimitTimer);
    voiceCountdownTimer = null;
    voiceLimitTimer = null;
  }

  function releaseVoiceMedia(stopRecorder) {
    clearVoiceTimers();
    if (mediaRecorder && stopRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      try {
        mediaRecorder.stop();
      } catch (error) {
        // The browser may have stopped the recorder already.
      }
    }
    mediaRecorder = null;
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
      mediaStream = null;
    }
  }

  function stopAndPauseVoice(automatic) {
    const recorder = mediaRecorder;
    if (!recorder || voiceStopRequested || recorder.state === "inactive") return;
    voiceStopRequested = true;
    clearVoiceTimers();
    voiceSecondsRemaining = automatic
      ? 0
      : Math.max(0, Math.ceil((MAX_RECORDING_DURATION_MS - (Date.now() - voiceStartedAt)) / 1000));
    const stopped = new Promise(function (resolve) {
      recorder.addEventListener("stop", function () { resolve(); }, { once: true });
    });
    try {
      recorder.stop();
    } catch (error) {
      releaseVoiceMedia(true);
      setVoiceError(VOICE_TEXT.recordingFailed);
      setVoiceState("idle");
      return;
    }
    stopped.then(function () {
      const blob = new Blob(voiceChunks, { type: recorder.mimeType || "audio/webm" });
      releaseVoiceMedia(false);
      voiceChunks = [];
      if (voiceCancelled) return;
      if (!blob.size) {
        setVoiceError(VOICE_TEXT.emptyRecording);
        setVoiceState("idle");
        return;
      }
      voiceAudioBlob = blob;
      setVoiceError("");
      setVoiceState("paused");
    }).catch(function () {
      releaseVoiceMedia(true);
      setVoiceError(VOICE_TEXT.recordingFailed);
      setVoiceState("idle");
    });
  }

  function startVoiceRecording() {
    if (voiceState !== "idle" || voicePermissionRequest || voiceRequestInFlight) return;
    setVoiceError("");
    voiceSecondsRemaining = 60;
    voiceCancelled = false;
    voiceStopRequested = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError(VOICE_TEXT.unsupportedRecording);
      return;
    }
    const mimeType = typeof MediaRecorder.isTypeSupported === "function"
      ? ["audio/webm;codecs=opus", "audio/webm"].find(function (candidate) { return MediaRecorder.isTypeSupported(candidate); })
      : undefined;
    if (!mimeType) {
      setVoiceError(VOICE_TEXT.unsupportedFormat);
      return;
    }

    voicePermissionRequest = true;
    setVoiceState("requesting");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (voiceCancelled) {
        for (const track of stream.getTracks()) track.stop();
        voicePermissionRequest = false;
        return;
      }
      mediaStream = stream;
      mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
      voiceChunks = [];
      mediaRecorder.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) voiceChunks.push(event.data);
      };
      mediaRecorder.onerror = function () {
        setVoiceError(VOICE_TEXT.recordingFailed);
        releaseVoiceMedia(true);
        setVoiceState("idle");
      };
      mediaRecorder.start(250);
      voiceStartedAt = Date.now();
      voicePermissionRequest = false;
      setVoiceState("recording");
      voiceCountdownTimer = window.setInterval(function () {
        voiceSecondsRemaining = Math.max(0, Math.ceil((MAX_RECORDING_DURATION_MS - (Date.now() - voiceStartedAt)) / 1000));
        if (voiceState === "recording") {
          voiceStatus.textContent = formatRecordingCountdown(voiceSecondsRemaining);
        }
      }, 250);
      voiceLimitTimer = window.setTimeout(function () {
        stopAndPauseVoice(true);
      }, MAX_RECORDING_DURATION_MS);
    }).catch(function (captureError) {
      voicePermissionRequest = false;
      releaseVoiceMedia(true);
      const name = captureError && captureError.name ? captureError.name : "";
      setVoiceError(
        name === "NotAllowedError" || name === "SecurityError"
          ? VOICE_TEXT.permissionDenied
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? VOICE_TEXT.microphoneUnavailable
            : VOICE_TEXT.recordingFailed,
      );
      setVoiceState("idle");
    });
  }

  function stopVoiceRecording() {
    stopAndPauseVoice(false);
  }

  function discardVoiceRecording() {
    voiceCancelled = true;
    if (voiceAbortController) {
      voiceAbortController.abort();
      voiceAbortController = null;
    }
    voiceRequestInFlight = false;
    if (voiceState === "transcribing") hideTyping();
    releaseVoiceMedia(true);
    voiceAudioBlob = null;
    voiceChunks = [];
    setVoiceError("");
    voiceSecondsRemaining = 60;
    setVoiceState("idle");
  }

  function sendVoiceRecording() {
    if (voiceState !== "paused" || voiceRequestInFlight) return;
    const audio = voiceAudioBlob;
    if (!audio) return;
    voiceRequestInFlight = true;
    voiceCancelled = false;
    voiceAbortController = new AbortController();
    setVoiceError("");
    setVoiceState("transcribing");

    if (audio.size > MAX_CAPTURE_SIZE) {
      voiceRequestInFlight = false;
      setVoiceError(VOICE_TEXT.recordingTooLarge);
      setVoiceState("paused");
      return;
    }

    const loadingBubble = showVoiceLoadingBubble();

    const form = new FormData();
    form.append("audio", audio, "voice-message.webm");

    fetch(TRANSCRIBE_ENDPOINT, {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: voiceAbortController.signal,
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        return { ok: response.ok, status: response.status, payload: payload };
      });
    }).then(function (result) {
      if (!result.ok || typeof result.payload.transcript !== "string" || !result.payload.transcript.trim()) {
        throw new Error(
          result.status === 413
            ? VOICE_TEXT.recordingTooLarge
            : result.status === 415
              ? VOICE_TEXT.unsupportedFormat
              : result.status === 400
                ? VOICE_TEXT.emptyRecording
                : VOICE_TEXT.transcriptionFailed,
        );
      }
      const transcript = result.payload.transcript.trim();
      voiceAudioBlob = null;
      voiceChunks = [];
      voiceSecondsRemaining = 60;
      voiceRequestInFlight = false;
      loadingBubble.remove();
      setVoiceState("idle");
      submitVoiceTranscript(transcript);
    }).catch(function (error) {
      if (voiceCancelled || (error && error.name === "AbortError")) {
        loadingBubble.remove();
        return;
      }
      voiceRequestInFlight = false;
      loadingBubble.remove();
      setVoiceError(VOICE_TEXT.transcriptionFailed);
      setVoiceState("paused");
    });
  }

  function submitVoiceTranscript(transcript) {
    if (!transcript || isStreaming) return;
    input.value = transcript;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    sendMessage();
  }

  // Temporary right-side bubble shown while a voice recording is transcribed
  function showVoiceLoadingBubble() {
    const bubble = document.createElement("div");
    bubble.className = "chat-message user chat-voice-loading";
    bubble.setAttribute("aria-label", VOICE_TEXT.transcribing);
    bubble.innerHTML = '<span class="chat-voice-loading-dots"><span></span><span></span><span></span></span>';
    messagesContainer.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  // Send message
  async function sendMessage() {
    const question = input.value.trim();
    if (!question || isStreaming) return;

    // Add user message
    addUserMessage(question);
    history.push({ role: "user", content: question });
    touchSession();

    // Clear input
    input.value = "";
    input.style.height = "auto";
    updateComposerButtons();

    // Show typing indicator
    showTyping();

    // Call API
    try {
      await callAskAPI(question);
    } catch (error) {
      if (error && error.name === "AbortError") return; // user stopped the response
      hideTyping();
      isStreaming = false;
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
        sessionId: sessionId,
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
      isStreaming = false;
      showError("No response received. Please try again.");
    }
    updateComposerButtons();
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
        isStreaming = false;
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
    isStreaming = false;
    if (currentAssistantMessage) {
      currentAssistantMessage.classList.remove("chat-pending");
      // Add to history
      const fullText = currentRawText;
      history.push({ role: "assistant", content: fullText });
      touchSession();
      // Add an independent copy button for this completed response
      const copyButton = createCopyButton(fullText);
      currentAssistantMessage.insertAdjacentElement("afterend", copyButton);
      currentAssistantMessage = null;
      currentAssistantBlocks = [];
      currentRawText = "";
    }
    updateComposerButtons();
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
    isStreaming = false;
    const blocks = parseMarkdown(text);
    const html = blocksToHTML(blocks);
    const msg = document.createElement("div");
    msg.className = "chat-message assistant formatted-message";
    msg.innerHTML = html;
    messagesContainer.appendChild(msg);
    history.push({ role: "assistant", content: text });
    touchSession();
    // Add an independent copy button for this completed response
    const copyButton = createCopyButton(text);
    msg.insertAdjacentElement("afterend", copyButton);
    scrollToBottom();
    updateComposerButtons();
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

  // Hide typing indicator (does not end the streaming state)
  function hideTyping() {
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
    updateComposerButtons();
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