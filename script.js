const chatBody = document.querySelector('.chat-body');
const messageInput = document.querySelector('.message-input');
const sendMessageButton = document.querySelector('#send-message');
const fileInput = document.querySelector('#file-input');
const fileUploadWrapper = document.querySelector('.file-upload-wrapper');
const fileUploadButton = document.querySelector('#file-upload');
const fileCancelButton = document.querySelector('#file-cancel');
const chatForm = document.querySelector('.chat-form');
const closeChatbotButton = document.querySelector('#close-chatbot');
const emojiButton = document.querySelector('#emoji-picker');

const userData = { message: '', file: { data: null, mime_type: null } };
let isGenerating = false;

const createMessageElement = (content, ...classes) => {
    const div = document.createElement('div');
    div.classList.add('message', ...classes);
    div.innerHTML = content;
    return div;
};

const escapeHTML = (text) => text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const renderMarkdown = (text) => {
    let html = escapeHTML(text.replace(/\r\n/g, '\n'));
    html = html.replace(/```(?:[\w+-]+)?\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, '<ul>$1</ul>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/<\/pre><br>/g, '</pre>');
    html = html.replace(/<br><h([1-3])>/g, '<h$1>');
    html = html.replace(/<\/h([1-3])><br>/g, '</h$1>');
    html = html.replace(/<\/ul><br>/g, '</ul>');
    return html;
};

const scrollToBottom = () => chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'smooth' });

const resetFileUpload = () => {
    userData.file = { data: null, mime_type: null };
    fileUploadWrapper.classList.remove('file-uploaded');
    const preview = fileUploadWrapper.querySelector('img');
    if (preview) preview.removeAttribute('src');
    fileInput.value = '';
};

const addUserMessage = (message, file) => {
    const outgoing = createMessageElement(`
        <div class="message-text"></div>
        ${file ? `<img src="data:${file.mime_type};base64,${file.data}" class="attachment" alt="Uploaded image">` : ''}
    `, 'user-message');
    outgoing.querySelector('.message-text').textContent = message;
    chatBody.appendChild(outgoing);
    scrollToBottom();
};

const addThinkingMessage = () => {
    const incoming = createMessageElement(`
        <span class="bot-avatar material-symbols-rounded">smart_toy</span>
        <div class="message-text"><div class="thinking-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>
    `, 'bot-message', 'thinking');
    chatBody.appendChild(incoming);
    scrollToBottom();
    return incoming;
};

const getBotResponse = async (message, file) => {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, file })
    });
    const responseData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(responseData.error || `Request failed with status ${response.status}`);
    if (!responseData.text) throw new Error('No response received from the server.');
    return responseData.text;
};

const generateBotResponse = async (incoming, message, file) => {
    const messageElement = incoming.querySelector('.message-text');
    try {
        messageElement.innerHTML = renderMarkdown(await getBotResponse(message, file));
    } catch (error) {
        console.error(error);
        messageElement.textContent = error.message;
        messageElement.style.color = '#ff0000';
    } finally {
        incoming.classList.remove('thinking');
        isGenerating = false;
        messageInput.disabled = false;
        sendMessageButton.disabled = false;
        fileUploadButton.disabled = false;
        messageInput.focus();
        scrollToBottom();
    }
};

const handleOutgoingMessage = (event) => {
    event.preventDefault();
    if (isGenerating) return;
    const message = messageInput.value.trim();
    if (!message && !userData.file.data) return;
    const selectedFile = userData.file.data ? { ...userData.file } : null;
    addUserMessage(message, selectedFile);
    messageInput.value = '';
    resetFileUpload();
    const incoming = addThinkingMessage();
    isGenerating = true;
    messageInput.disabled = true;
    sendMessageButton.disabled = true;
    fileUploadButton.disabled = true;
    generateBotResponse(incoming, message, selectedFile);
};

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        resetFileUpload();
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert('Please select an image smaller than 10 MB.');
        resetFileUpload();
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const result = event.target.result;
        fileUploadWrapper.querySelector('img').src = result;
        userData.file = { data: result.split(',')[1], mime_type: file.type };
        fileUploadWrapper.classList.add('file-uploaded');
    };
    reader.readAsDataURL(file);
});

fileUploadButton.addEventListener('click', () => { if (!isGenerating) fileInput.click(); });
fileCancelButton.addEventListener('click', (event) => { event.stopPropagation(); resetFileUpload(); });
chatForm.addEventListener('submit', handleOutgoingMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});
emojiButton.addEventListener('click', () => { messageInput.value += '🙂'; messageInput.focus(); });
closeChatbotButton.addEventListener('click', () => document.body.classList.toggle('chatbot-minimized'));
