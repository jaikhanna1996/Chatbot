const promptInput = document.getElementById("textarea-prompt");
const chatContainer = document.getElementById("chat-container");
const askButton = document.getElementById("ask-btn");
const chatHistoryKey = "chatHistory";
let chatHistory = loadChatHistory();

for (const message of chatHistory) {
  if (message.role === "user") {
    addUserMessage(message.content);
  } else {
    addAssistantMessage(message.content);
  }
}

askButton.addEventListener("click", handleAsk);

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleAsk();
  }
});

async function handlePrompt(question) {
  addUserMessage(question);
  promptInput.value = "";

  const assistantMessageElement = document.createElement("div");
  assistantMessageElement.className = "flex justify-start min-w-0";
  assistantMessageElement.style.maxWidth = "100%";
  const assistantBubble = document.createElement("div");
  assistantBubble.className = "bg-gray-900 text-gray-200 border border-gray-800 rounded-2xl rounded-bl-sm px-3 py-2";
  assistantBubble.style.width = "max-content";
  assistantBubble.setAttribute("aria-label", "AI is generating a response");
  const skeleton = document.createElement("div");
  skeleton.className = "animate-pulse space-y-1.5";
  skeleton.setAttribute("aria-hidden", "true");
  for (const width of ["7rem", "5rem"]) {
    const line = document.createElement("div");
    line.className = "h-2 rounded bg-gray-700";
    line.style.width = width;
    skeleton.appendChild(line);
  }
  assistantBubble.appendChild(skeleton);
  assistantMessageElement.appendChild(assistantBubble);
  chatContainer.appendChild(assistantMessageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const assistantMessage = await callServer(question);
    assistantBubble.removeAttribute("aria-label");
    assistantBubble.style.width = "";
    assistantBubble.style.maxWidth = "75%";
    assistantBubble.style.minWidth = "0";
    assistantBubble.style.whiteSpace = "normal";
    assistantBubble.style.overflowWrap = "anywhere";
    assistantBubble.replaceChildren(renderAssistantMessage(assistantMessage));
    chatHistory.push(
      { role: "user", content: question },
      { role: "assistant", content: assistantMessage }
    );
    saveChatHistory();
  } catch (error) {
    console.error("Could not get an AI response:", error);
    assistantBubble.removeAttribute("aria-label");
    assistantBubble.style.width = "";
    assistantBubble.style.maxWidth = "75%";
    assistantBubble.style.minWidth = "0";
    assistantBubble.style.whiteSpace = "pre-wrap";
    assistantBubble.style.overflowWrap = "anywhere";
    assistantBubble.textContent = "Sorry, I couldn't get a response. Please try again.";
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function loadChatHistory() {
  try {
    const savedHistory = JSON.parse(sessionStorage.getItem(chatHistoryKey) || "[]");
    if (!Array.isArray(savedHistory)) {
      throw new Error("Saved chat history is not an array.");
    }

    return savedHistory.filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    );
  } catch (error) {
    console.error("Could not load saved chat history:", error);
    return [];
  }
}

function saveChatHistory() {
  try {
    sessionStorage.setItem(chatHistoryKey, JSON.stringify(chatHistory));
  } catch (error) {
    console.error("Could not save chat history:", error);
  }
}

function addUserMessage(question) {
  const userMessageElement = document.createElement("div");
  userMessageElement.className = "flex justify-end";
  const userBubble = document.createElement("div");
  userBubble.className = "bg-gray-800 text-gray-100 rounded-2xl rounded-br-sm px-4 py-2 max-w-[75%] whitespace-pre-wrap break-words";
  userBubble.textContent = question;
  userMessageElement.appendChild(userBubble);
  chatContainer.appendChild(userMessageElement);
}

function addAssistantMessage(message) {
  const assistantMessageElement = document.createElement("div");
  assistantMessageElement.className = "flex justify-start min-w-0";
  assistantMessageElement.style.maxWidth = "100%";
  const assistantBubble = document.createElement("div");
  assistantBubble.className = "bg-gray-900 text-gray-200 border border-gray-800 rounded-2xl rounded-bl-sm px-3 py-2";
  assistantBubble.style.maxWidth = "75%";
  assistantBubble.style.minWidth = "0";
  assistantBubble.style.whiteSpace = "normal";
  assistantBubble.style.overflowWrap = "anywhere";
  assistantBubble.appendChild(renderAssistantMessage(message));
  assistantMessageElement.appendChild(assistantBubble);
  chatContainer.appendChild(assistantMessageElement);
}

function renderAssistantMessage(message) {
  const fragment = document.createDocumentFragment();
  const lines = message.split(/\r?\n/);
  let paragraphLines = [];
  let currentList = null;
  let currentListType = null;

  function appendInlineMarkdown(parent, text) {
    const markdownPattern = /(\*\*.+?\*\*|__.+?__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
    let lastIndex = 0;
    let match;

    while ((match = markdownPattern.exec(text)) !== null) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

      const token = match[0];
      let element;
      let content;
      if (token.startsWith("**") || token.startsWith("__")) {
        element = document.createElement("strong");
        content = token.slice(2, -2);
      } else if (token.startsWith("`")) {
        element = document.createElement("code");
        element.className = "rounded bg-gray-800 px-1";
        content = token.slice(1, -1);
      } else {
        element = document.createElement("em");
        content = token.slice(1, -1);
      }

      element.textContent = content;
      parent.appendChild(element);
      lastIndex = match.index + token.length;
    }

    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const paragraph = document.createElement("p");
    paragraph.className = "mb-2 last:mb-0 leading-7";
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    fragment.appendChild(paragraph);
    paragraphLines = [];
  }

  function flushList() {
    currentList = null;
    currentListType = null;
  }

  for (const line of lines) {
    const trimmedLine = line.trim();
    const heading = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    const unorderedItem = trimmedLine.match(/^[-*+]\s+(.+)$/);
    const orderedItem = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
    const listItem = unorderedItem || orderedItem;
    const listType = unorderedItem ? "ul" : "ol";

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    if (heading) {
      flushParagraph();
      flushList();
      const headingElement = document.createElement(heading[1].length === 1 ? "h3" : "h4");
      headingElement.className = "mb-2 mt-1 font-semibold text-gray-100";
      appendInlineMarkdown(headingElement, heading[2]);
      fragment.appendChild(headingElement);
      continue;
    }

    if (listItem) {
      flushParagraph();
      if (currentListType !== listType) {
        flushList();
        currentList = document.createElement(listType);
        currentList.className = `${listType === "ul" ? "list-disc" : "list-decimal"} mb-2 space-y-1 pl-5`;
        currentListType = listType;
        fragment.appendChild(currentList);
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, listItem[1]);
      currentList.appendChild(item);
      continue;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  return fragment;
}

function handleAsk() {
  const question = promptInput.value.trim();
  if (!question) return;
  handlePrompt(question);
}

async function callServer(inputText) {
  const chatUrl = `${window.location.protocol}//${window.location.hostname}:3000/chat`;
  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question: inputText, chatHistory })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.response;
}
