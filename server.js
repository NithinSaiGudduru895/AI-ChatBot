
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

app.use(express.json({ limit: '12mb' }));
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
    try {
        if (!API_KEY) {
            return res.status(500).json({
                error: 'Server API key is not configured.'
            });
        }

        const { message = '', file = null } = req.body || {};
        const parts = [];

        if (message.trim()) {
            parts.push({ text: message.trim() });
        }

        if (file?.data && file?.mime_type) {
            if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mime_type)) {
                return res.status(400).json({
                    error: 'Only JPEG, PNG, WEBP, and GIF images are supported.'
                });
            }

            parts.push({
                inline_data: {
                    mime_type: file.mime_type,
                    data: file.data
                }
            });
        }

        if (!parts.length) {
            parts.push({ text: 'Hello' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': API_KEY
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const detail =
                data?.error?.message ||
                `Gemini request failed with status ${response.status}`;

            return res.status(response.status).json({
                error: detail
            });
        }

        const text = data?.candidates?.[0]?.content?.parts
            ?.filter(part => part.text)
            .map(part => part.text)
            .join('\n');

        if (!text) {
            return res.status(502).json({
                error: 'Gemini returned no text response.'
            });
        }

        res.json({ text });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Unable to contact Gemini. Check the server logs.'
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;
