document.addEventListener('DOMContentLoaded', async () => {
    const PREFS_STORAGE_KEY = 'mapsReviewPrefs';
    const PROXY_WORKER_URL = 'https://duronto-gemini-proxy.focustaxationwa.workers.dev/';
    const COPILOT_BASE_URL = 'https://copilot-proxy-api.manoar.bd/api/copilot';
    const COPILOT_DEFAULT_MODEL = 'gpt-5-mini';

    const providerSelect = document.getElementById('provider');
    const apiKeyInput = document.getElementById('apiKey');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const copilotApiKeyInput = document.getElementById('copilotApiKey');
    const copilotModelSelect = document.getElementById('copilotModel');
    const copilotTemperatureInput = document.getElementById('copilotTemperature');
    const copilotTempValueEl = document.getElementById('copilotTempValue');
    const reloadCopilotModelsBtn = document.getElementById('reloadCopilotModelsBtn');
    const copilotModelsStatus = document.getElementById('copilotModelsStatus');
    const copilotSection = document.getElementById('copilotSection');
    const geminiKeyGroup = document.getElementById('geminiKeyGroup');
    const openaiKeyGroup = document.getElementById('openaiKeyGroup');
    const proxyInfo = document.getElementById('proxyInfo');
    const generateBtn = document.getElementById('generateBtn');
    const statusMessage = document.getElementById('statusMessage');
    const placeCard = document.getElementById('placeCard');
    const placeNameEl = document.getElementById('placeName');
    const placeAddressEl = document.getElementById('placeAddress');
    const sentimentSelect = document.getElementById('sentiment');
    const personaStyleSelect = document.getElementById('personaStyle');
    const languageModeSelect = document.getElementById('languageMode');
    const lengthSelect = document.getElementById('reviewLength');
    const imageCountInput = document.getElementById('imageCount');
    const imageQualitySelect = document.getElementById('imageQuality');
    const aspectRatioSelect = document.getElementById('aspectRatio');
    const imageStyleSelect = document.getElementById('imageStyle');
    const enableImagesToggle = document.getElementById('enableImagesToggle');
    const imageSettingsAccordion = document.getElementById('imageSettingsAccordion');
    const imageSettingsPanel = document.getElementById('imageSettingsPanel');
    const thinkingLevelSelect = document.getElementById('thinkingLevel');
    const includeThoughtsInput = document.getElementById('includeThoughts');
    const useWebGroundingInput = document.getElementById('useWebGrounding');
    const useImageGroundingInput = document.getElementById('useImageGrounding');
    const referenceImagesInput = document.getElementById('referenceImages');
    const userVibeInput = document.getElementById('userVibe');
    const loader = document.getElementById('loader');
    const resultsCard = document.getElementById('resultsCard');
    const reviewOutput = document.getElementById('reviewOutput');
    const promptOutput = document.getElementById('promptOutput');
    const autoPasteBtn = document.getElementById('autoPasteBtn');
    const copyReviewBtn = document.getElementById('copyReviewBtn');
    const imagesContainer = document.getElementById('imagesContainer');
    const reviewOutputContainer = document.getElementById('reviewOutputContainer');
    const promptOutputContainer = document.getElementById('promptOutputContainer');
    const refreshPlaceBtn = document.getElementById('refreshPlaceBtn');

    let currentPlaceInfo = null;

    // ---------- Accordion ----------
    document.querySelectorAll('.accordion').forEach(acc => {
        acc.addEventListener('click', function () {
            this.classList.toggle('active');
            const panel = this.nextElementSibling;
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        });
    });

    // ---------- Preferences ----------
    function loadPreferences() {
        try {
            const stored = localStorage.getItem(PREFS_STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (_) {}
        return {
            provider: 'gemini',
            sentiment: 'Positive',
            personaStyle: 'Local Guide',
            languageMode: 'auto',
            reviewLength: 'medium',
            imageCount: '1',
            imageQuality: '1K',
            aspectRatio: '1:1',
            imageStyle: 'photorealistic',
            enableImages: true,
            thinkingLevel: 'minimal',
            includeThoughts: false,
            useWebGrounding: false,
            useImageGrounding: false,
            vibe: '',
            copilotModel: COPILOT_DEFAULT_MODEL,
            copilotTemperature: 0.2,
            copilotModels: [COPILOT_DEFAULT_MODEL]
        };
    }

    function savePreferences() {
        const prefs = {
            provider: providerSelect.value,
            sentiment: sentimentSelect.value,
            personaStyle: personaStyleSelect.value,
            languageMode: languageModeSelect.value,
            reviewLength: lengthSelect.value,
            imageCount: imageCountInput.value,
            imageQuality: imageQualitySelect.value,
            aspectRatio: aspectRatioSelect.value,
            imageStyle: imageStyleSelect.value,
            enableImages: enableImagesToggle.checked,
            thinkingLevel: thinkingLevelSelect.value,
            includeThoughts: includeThoughtsInput.checked,
            useWebGrounding: useWebGroundingInput.checked,
            useImageGrounding: useImageGroundingInput.checked,
            vibe: userVibeInput.value,
            copilotModel: copilotModelSelect.value,
            copilotTemperature: parseFloat(copilotTemperatureInput.value),
            copilotModels: Array.from(copilotModelSelect.options).map(o => o.value)
        };
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }

    function applyPreferences() {
        const prefs = loadPreferences();
        providerSelect.value = prefs.provider || 'gemini';
        sentimentSelect.value = prefs.sentiment || sentimentSelect.value;
        personaStyleSelect.value = prefs.personaStyle || personaStyleSelect.value;
        languageModeSelect.value = prefs.languageMode || languageModeSelect.value;
        lengthSelect.value = prefs.reviewLength || lengthSelect.value;
        imageCountInput.value = prefs.imageCount || imageCountInput.value;
        imageQualitySelect.value = prefs.imageQuality || imageQualitySelect.value;
        aspectRatioSelect.value = prefs.aspectRatio || aspectRatioSelect.value;
        imageStyleSelect.value = prefs.imageStyle || imageStyleSelect.value;
        enableImagesToggle.checked = prefs.enableImages !== undefined ? prefs.enableImages : true;
        thinkingLevelSelect.value = prefs.thinkingLevel || thinkingLevelSelect.value;
        includeThoughtsInput.checked = Boolean(prefs.includeThoughts);
        useWebGroundingInput.checked = Boolean(prefs.useWebGrounding);
        useImageGroundingInput.checked = Boolean(prefs.useImageGrounding);
        userVibeInput.value = prefs.vibe || '';

        const savedModels = Array.isArray(prefs.copilotModels) && prefs.copilotModels.length
            ? prefs.copilotModels
            : [COPILOT_DEFAULT_MODEL];
        populateCopilotModels(savedModels, prefs.copilotModel || COPILOT_DEFAULT_MODEL);

        const temp = typeof prefs.copilotTemperature === 'number' ? prefs.copilotTemperature : 0.2;
        copilotTemperatureInput.value = String(temp);
        copilotTempValueEl.textContent = temp.toFixed(1);

        updateProviderVisibility();
        updateImageSettingsVisibility();
    }

    function populateCopilotModels(modelIds, selected) {
        const ids = (modelIds && modelIds.length) ? modelIds : [COPILOT_DEFAULT_MODEL];
        copilotModelSelect.innerHTML = '';
        for (const id of ids) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            copilotModelSelect.appendChild(opt);
        }
        const target = selected && ids.includes(selected) ? selected : ids[0];
        copilotModelSelect.value = target;
    }

    function updateImageSettingsVisibility() {
        const provider = providerSelect.value;
        const imagesAvailable = provider !== 'proxy' && provider !== 'copilot';
        const enabled = imagesAvailable && enableImagesToggle.checked;

        const switchContainer = enableImagesToggle.closest('.switch-container');
        if (switchContainer) {
            switchContainer.style.display = imagesAvailable ? 'flex' : 'none';
        }

        if (enabled) {
            imageSettingsAccordion.style.display = 'flex';
        } else {
            imageSettingsAccordion.style.display = 'none';
            imageSettingsPanel.style.display = 'none';
            imageSettingsAccordion.classList.remove('active');
        }
    }

    function updateProviderVisibility() {
        const provider = providerSelect.value;
        geminiKeyGroup.classList.toggle('hidden', provider !== 'gemini');
        openaiKeyGroup.classList.toggle('hidden', provider !== 'openai');
        copilotSection.classList.toggle('hidden', provider !== 'copilot');
        proxyInfo.classList.toggle('hidden', provider !== 'proxy');

        const labels = { gemini: 'Gemini AI', proxy: 'Duronto Proxy', openai: 'OpenAI', copilot: 'Copilot Proxy' };
        loader.textContent = `Generating with ${labels[provider] || 'AI'}...`;
    }

    applyPreferences();

    [
        providerSelect, sentimentSelect, personaStyleSelect, languageModeSelect, lengthSelect,
        imageCountInput, imageQualitySelect, aspectRatioSelect, imageStyleSelect,
        enableImagesToggle, thinkingLevelSelect, includeThoughtsInput,
        useWebGroundingInput, useImageGroundingInput, userVibeInput,
        copilotModelSelect
    ].forEach(el => {
        el.addEventListener('change', () => {
            if (el === providerSelect) {
                updateProviderVisibility();
                updateImageSettingsVisibility();
                if (providerSelect.value === 'copilot' && copilotApiKeyInput.value.trim()) {
                    loadCopilotModels();
                }
            } else if (el === enableImagesToggle) {
                updateImageSettingsVisibility();
            }
            savePreferences();
        });
    });

    copilotTemperatureInput.addEventListener('input', () => {
        const t = parseFloat(copilotTemperatureInput.value);
        copilotTempValueEl.textContent = (isNaN(t) ? 0.2 : t).toFixed(1);
    });
    copilotTemperatureInput.addEventListener('change', savePreferences);
    reloadCopilotModelsBtn.addEventListener('click', loadCopilotModels);

    // ---------- API key persistence ----------
    chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'copilotApiKey'], (result) => {
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
        if (result.openaiApiKey) openaiApiKeyInput.value = result.openaiApiKey;
        if (result.copilotApiKey) {
            copilotApiKeyInput.value = result.copilotApiKey;
            if (providerSelect.value === 'copilot') loadCopilotModels();
        }
    });

    apiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ geminiApiKey: e.target.value });
    });
    openaiApiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ openaiApiKey: e.target.value });
    });
    copilotApiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ copilotApiKey: e.target.value });
        if (e.target.value.trim()) loadCopilotModels();
    });

    async function loadCopilotModels() {
        const apiKey = copilotApiKeyInput.value.trim();
        if (!apiKey) {
            copilotModelsStatus.textContent = 'Enter API key to load models.';
            return;
        }
        copilotModelsStatus.textContent = 'Loading models...';
        try {
            const response = await fetch(`${COPILOT_BASE_URL}/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || errData.error || `HTTP ${response.status}`);
            }
            const data = await response.json();
            const list = Array.isArray(data?.data) ? data.data
                       : Array.isArray(data?.models) ? data.models
                       : Array.isArray(data) ? data
                       : [];
            const ids = list
                .map(m => typeof m === 'string' ? m : m?.id || m?.name)
                .filter(Boolean);
            if (!ids.length) {
                copilotModelsStatus.textContent = 'No models returned. Using default.';
                populateCopilotModels([COPILOT_DEFAULT_MODEL], COPILOT_DEFAULT_MODEL);
                return;
            }
            const previous = copilotModelSelect.value;
            const selected = ids.includes(previous) ? previous
                           : ids.includes(COPILOT_DEFAULT_MODEL) ? COPILOT_DEFAULT_MODEL
                           : ids[0];
            populateCopilotModels(ids, selected);
            copilotModelsStatus.textContent = `Loaded ${ids.length} model${ids.length === 1 ? '' : 's'}.`;
            savePreferences();
        } catch (err) {
            copilotModelsStatus.textContent = `Failed to load models: ${err.message}`;
        }
    }

    function showError(msg) {
        statusMessage.textContent = msg;
        statusMessage.classList.remove('hidden');
    }

    // ---------- Map scraping ----------
    function scrapePlaceDOM() {
        try {
            const h1Elements = Array.from(document.querySelectorAll('h1'));
            const validH1s = h1Elements.filter(el => {
                if (el.offsetParent === null) return false;
                const text = el.innerText.trim();
                if (!text || text === 'Results' || text === 'Top results' || text === 'Search results') return false;
                return true;
            });

            const nameEl = validH1s.find(el => el.classList.contains('fontHeadlineLarge') || el.classList.contains('DUwDvf')) || validH1s[0];
            const name = nameEl ? nameEl.innerText.trim() : null;

            if (!name) return { error: "No specific place opened. Please click on a single place from the results." };

            let detailPane = document;
            if (nameEl) {
                let parent = nameEl.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.getAttribute('role') === 'main' || parent.querySelector('button[data-tooltip="Copy address"]')) {
                        detailPane = parent;
                        break;
                    }
                    parent = parent.parentElement;
                }
            }

            let address = "Address not found";
            const addressBtn = detailPane.querySelector('button[data-tooltip="Copy address"], button[data-item-id="address"]') ||
                Array.from(detailPane.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Address:'));

            if (addressBtn && addressBtn.getAttribute('aria-label')) {
                address = addressBtn.getAttribute('aria-label').replace('Address: ', '').trim();
            } else {
                const subt = detailPane.querySelector('.fontBodyMedium.mgr77e, .Io6YTe, .W4Eejd');
                if (subt && subt.innerText.length > 2) address = subt.innerText.trim();
            }

            let rating = "";
            const ratingEl = detailPane.querySelector('span[aria-label*="stars"], span[aria-label*="star"], div[aria-label*="stars"]');
            if (ratingEl) rating = ratingEl.getAttribute('aria-label');

            let category = "Not specified";
            const categoryBtn = detailPane.querySelector('button[jsaction="pane.rating.category"]') || detailPane.querySelector('.DkEaL, .fontBodyMedium');
            if (categoryBtn) {
                category = categoryBtn.innerText;
            } else {
                const possibleCat = Array.from(detailPane.querySelectorAll('button')).find(b => b.innerText.includes('·') && b.innerText.length < 40);
                if (possibleCat) category = possibleCat.innerText;
            }

            const reviewEls = detailPane.querySelectorAll('.MyEned, .wiI7pd');
            const reviews = Array.from(reviewEls).map(el => el.innerText.trim()).filter(t => t.length > 0).slice(0, 8);

            return { name, address, rating, category, reviews };
        } catch (e) {
            return { error: e.toString() };
        }
    }

    function extractMapData() {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url || !currentTab.url.includes('google.com/maps')) {
                showError('Please open a location on Google Maps first.');
                generateBtn.disabled = true;
                return;
            }
            chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                function: scrapePlaceDOM
            }, (injectionResults) => {
                if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                    showError('Failed to read map data. Try refreshing the page.');
                    return;
                }
                const data = injectionResults[0].result;
                if (data.error) {
                    showError(data.error);
                } else {
                    statusMessage.classList.add('hidden');
                    generateBtn.disabled = false;
                    currentPlaceInfo = data;
                    placeNameEl.textContent = data.name;
                    placeAddressEl.textContent = data.address;
                    placeCard.classList.remove('hidden');
                }
            });
        });
    }

    extractMapData();

    refreshPlaceBtn.addEventListener('click', () => {
        statusMessage.classList.add('hidden');
        resultsCard.classList.add('hidden');
        currentPlaceInfo = null;
        generateBtn.disabled = true;
        placeNameEl.textContent = 'Loading...';
        placeAddressEl.textContent = '';
        reviewOutput.value = '';
        promptOutput.value = '';
        imagesContainer.innerHTML = '';
        extractMapData();
    });

    // ---------- Prompt construction (shared) ----------
    function buildReviewSystemPrompt(options) {
        const { personaStyle, languageMode } = options;
        let p = `You are an expert ${personaStyle} who has personally visited and explored this place. You pay close attention to both the good and bad aspects based on the place's category and name. Your writing tone is highly natural, genuine, and relatable - written exactly like a real human leaving a Google Maps review.`;
        if (languageMode === 'en') {
            p += `\nWrite the review in English. Keep any image prompt in English.`;
        } else if (languageMode === 'local') {
            p += `\nWrite the review in the dominant local language implied by the address. Keep any image prompt in English.`;
        } else {
            p += `\nIf the address implies a non-English speaking country, write the review in the dominant local language of that region, otherwise English. Keep any image prompt in English.`;
        }
        return p;
    }

    function buildReviewUserPrompt(placeInfo, options, { includeImagePrompt }) {
        const { sentiment, reviewLength, userVibe } = options;
        const recentReviews = Array.isArray(placeInfo.reviews) ? placeInfo.reviews : [];

        let lengthInstruction = 'Write a standard paragraph, around 3-4 sentences.';
        if (reviewLength === 'short') lengthInstruction = 'Keep it brief and concise, around 1-2 sentences.';
        else if (reviewLength === 'long') lengthInstruction = 'Write a comprehensive and detailed review, around 5-7 sentences.';

        const vibeInstruction = userVibe ? `\nWeave this vibe into the review naturally: "${userVibe}"` : '';

        let body = `Place Name: ${placeInfo.name}
Address: ${placeInfo.address}
Place Category: ${placeInfo.category || 'Not specified'}
Rating: ${placeInfo.rating || 'Not specified'}
Recent Reviews Context: ${recentReviews.join(' || ')}

Task 1: Write an authentic, human-like ${sentiment} review. ${lengthInstruction}${vibeInstruction}`;

        if (includeImagePrompt) {
            body += `\nTask 2: Write a descriptive image generation prompt matching the atmosphere described.
Return strictly as a JSON object with keys "review" and "image_prompt".`;
        } else {
            body += `\nReturn strictly as a JSON object with the key "review".`;
        }

        return body;
    }

    function tryParseJsonText(text) {
        if (!text) throw new Error('Empty response');
        try { return JSON.parse(text); } catch (_) {}
        const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        try { return JSON.parse(cleaned); } catch (_) {}
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (_) {}
        }
        throw new Error('Could not parse JSON from model response.');
    }

    // ---------- Provider: Gemini direct ----------
    async function generateReviewViaGemini(apiKey, placeInfo, options) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const systemPrompt = buildReviewSystemPrompt(options);
        const userPrompt = buildReviewUserPrompt(placeInfo, options, { includeImagePrompt: options.enableImages });

        const payload = {
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: 'application/json' }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Gemini API request failed');
        }
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return tryParseJsonText(text);
    }

    async function generateImageViaGemini(apiKey, promptText, options) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

        const styleMap = {
            photorealistic: 'photorealistic, real-life details, natural textures',
            cinematic: 'cinematic composition, dramatic lighting, wide dynamic range',
            'golden-hour': 'golden hour sunlight, warm tones, soft glow',
            'night-vibrant': 'vibrant night scene, neon accents, rich contrast'
        };

        const styleHint = styleMap[options.imageStyle] || styleMap.photorealistic;
        const aspectHint = options.aspectRatio ? `Aspect ratio: ${options.aspectRatio}.` : '';
        const sizeHint = options.imageQuality ? `Output size: ${options.imageQuality}.` : '';
        const searchHint = options.useWebGrounding ? 'Use Google Search grounding for factual environment details.' : '';
        const imageSearchHint = options.useImageGrounding ? 'Use image search grounding for visual references, but avoid people sourced from search.' : '';

        const fullPrompt = `${promptText}. Style guidance: ${styleHint}. ${aspectHint} ${sizeHint} ${searchHint} ${imageSearchHint}`.trim();

        const payload = {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                responseModalities: ['Image'],
                imageConfig: {
                    aspectRatio: options.aspectRatio || '1:1',
                    imageSize: options.imageQuality || '1K'
                }
            }
        };

        if (options.useWebGrounding || options.useImageGrounding) {
            const searchTypes = {};
            if (options.useWebGrounding) searchTypes.webSearch = {};
            if (options.useImageGrounding) searchTypes.imageSearch = {};
            payload.tools = [{ googleSearch: { searchTypes } }];
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Gemini image request failed');
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            const inlineData = part.inlineData || part.inline_data;
            if (inlineData?.data) {
                const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
                return base64ToBlob(inlineData.data, mimeType);
            }
        }
        throw new Error('No image returned from Gemini.');
    }

    // ---------- Provider: Duronto Proxy ----------
    async function callProxyWorker(prompt, systemInstruction) {
        const response = await fetch(PROXY_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, systemInstruction })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Proxy worker request failed');
        }
        const data = await response.json();
        if (!data.text) throw new Error('Proxy returned empty text');
        return data.text;
    }

    async function generateReviewViaProxy(placeInfo, options) {
        const recentReviews = Array.isArray(placeInfo.reviews) ? placeInfo.reviews : [];
        const lengthInstruction =
            options.reviewLength === 'short' ? '1-2 sentences' :
            options.reviewLength === 'long' ? '5-7 sentences' : '3-4 sentences';

        const systemPrompt =
            buildReviewSystemPrompt(options) +
            '\nSpeak only the review text aloud. Do not narrate or add preamble. Do not say "here is your review" or similar.';

        const userPrompt = `Write an authentic, human-like ${options.sentiment} Google Maps review for this place:
Name: ${placeInfo.name}
Address: ${placeInfo.address}
Category: ${placeInfo.category || 'Not specified'}
Rating: ${placeInfo.rating || 'Not specified'}
Recent reviews: ${recentReviews.join(' || ')}

Length: ${lengthInstruction}.
${options.userVibe ? `Vibe: ${options.userVibe}` : ''}

Speak only the review text, nothing else.`;

        const review = await callProxyWorker(userPrompt, systemPrompt);
        return { review, image_prompt: '' };
    }

    // ---------- Provider: OpenAI ----------
    async function generateReviewViaOpenAI(apiKey, placeInfo, options) {
        const systemPrompt = buildReviewSystemPrompt(options);
        const userPrompt = buildReviewUserPrompt(placeInfo, options, { includeImagePrompt: options.enableImages });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'OpenAI request failed');
        }
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        return tryParseJsonText(text);
    }

    // ---------- Provider: Copilot Proxy ----------
    async function generateReviewViaCopilot(apiKey, model, temperature, placeInfo, options) {
        const systemPrompt = buildReviewSystemPrompt(options);
        const userPrompt = buildReviewUserPrompt(placeInfo, options, { includeImagePrompt: options.enableImages });

        const response = await fetch(`${COPILOT_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || errData.error || `Copilot request failed (HTTP ${response.status})`);
        }
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content
                  || data?.message?.content
                  || data?.content
                  || data?.text;
        return tryParseJsonText(text);
    }

    function aspectRatioToOpenAISize(ratio) {
        // OpenAI's images endpoint supports a limited set; map to nearest.
        const r = (ratio || '1:1').trim();
        if (r === '16:9' || r === '21:9' || r === '3:2' || r === '4:3' || r === '5:4' || r === '4:1' || r === '8:1') return '1536x1024';
        if (r === '9:16' || r === '2:3' || r === '3:4' || r === '4:5' || r === '1:4' || r === '1:8') return '1024x1536';
        return '1024x1024';
    }

    async function generateImageViaOpenAI(apiKey, promptText, options) {
        const styleMap = {
            photorealistic: 'photorealistic, real-life details, natural textures',
            cinematic: 'cinematic composition, dramatic lighting, wide dynamic range',
            'golden-hour': 'golden hour sunlight, warm tones, soft glow',
            'night-vibrant': 'vibrant night scene, neon accents, rich contrast'
        };
        const styleHint = styleMap[options.imageStyle] || styleMap.photorealistic;
        const fullPrompt = `${promptText}. Style guidance: ${styleHint}`;
        const quality = (options.imageQuality === '2K' || options.imageQuality === '4K') ? 'high' : 'medium';

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: fullPrompt,
                n: 1,
                size: aspectRatioToOpenAISize(options.aspectRatio),
                quality
            })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'OpenAI image request failed');
        }
        const data = await response.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) throw new Error('No image returned from OpenAI.');
        return base64ToBlob(b64, 'image/png');
    }

    // ---------- Helpers ----------
    function base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        return new Blob(byteArrays, { type: mimeType });
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            try {
                const tempArea = document.createElement('textarea');
                tempArea.value = text;
                tempArea.setAttribute('readonly', '');
                tempArea.style.position = 'fixed';
                tempArea.style.top = '-9999px';
                document.body.appendChild(tempArea);
                tempArea.focus();
                tempArea.select();
                const copied = document.execCommand('copy');
                document.body.removeChild(tempArea);
                return copied;
            } catch (__) {
                return false;
            }
        }
    }

    // ---------- Main generate handler ----------
    generateBtn.addEventListener('click', async () => {
        const provider = providerSelect.value;
        const enableImages = enableImagesToggle.checked && provider !== 'proxy' && provider !== 'copilot';

        if (!currentPlaceInfo) {
            showError('No place info. Map might not be loaded properly.');
            return;
        }

        let geminiKey = apiKeyInput.value.trim();
        let openaiKey = openaiApiKeyInput.value.trim();
        let copilotKey = copilotApiKeyInput.value.trim();
        if (provider === 'gemini' && !geminiKey) {
            showError('Please enter your Gemini API Key.');
            return;
        }
        if (provider === 'openai' && !openaiKey) {
            showError('Please enter your OpenAI API Key.');
            return;
        }
        if (provider === 'copilot' && !copilotKey) {
            showError('Please enter your Copilot Proxy API Key.');
            return;
        }

        const options = {
            sentiment: sentimentSelect.value,
            personaStyle: personaStyleSelect.value,
            languageMode: languageModeSelect.value,
            reviewLength: lengthSelect.value,
            userVibe: userVibeInput.value.trim(),
            enableImages,
            imageStyle: imageStyleSelect.value,
            aspectRatio: aspectRatioSelect.value,
            imageQuality: imageQualitySelect.value,
            useWebGrounding: useWebGroundingInput.checked,
            useImageGrounding: useImageGroundingInput.checked
        };

        generateBtn.disabled = true;
        loader.style.display = 'block';
        resultsCard.classList.add('hidden');
        statusMessage.classList.add('hidden');
        imagesContainer.innerHTML = '';

        try {
            let result;
            if (provider === 'gemini') {
                result = await generateReviewViaGemini(geminiKey, currentPlaceInfo, options);
            } else if (provider === 'proxy') {
                result = await generateReviewViaProxy(currentPlaceInfo, options);
            } else if (provider === 'copilot') {
                const model = copilotModelSelect.value || COPILOT_DEFAULT_MODEL;
                const temperature = parseFloat(copilotTemperatureInput.value);
                result = await generateReviewViaCopilot(
                    copilotKey,
                    model,
                    isNaN(temperature) ? 0.2 : temperature,
                    currentPlaceInfo,
                    options
                );
            } else {
                result = await generateReviewViaOpenAI(openaiKey, currentPlaceInfo, options);
            }

            const reviewText = result.review || 'No review generated';
            const promptText = result.image_prompt || '';

            reviewOutput.value = reviewText;
            promptOutput.value = promptText;
            reviewOutputContainer.style.display = 'block';

            const copied = await copyToClipboard(reviewText);
            if (!copied) {
                statusMessage.textContent = 'Review generated. Auto-copy is blocked by browser policy, use "Copy Review".';
                statusMessage.classList.remove('hidden');
            }

            if (enableImages && promptText) {
                promptOutputContainer.style.display = 'block';
                const imgCount = parseInt(imageCountInput.value, 10) || 1;
                const placeSlug = currentPlaceInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

                for (let i = 0; i < imgCount; i++) {
                    const imgWrapper = document.createElement('div');
                    imgWrapper.style.marginBottom = '10px';

                    const img = document.createElement('img');
                    img.style.width = '100%';
                    img.style.borderRadius = '4px';
                    img.style.minHeight = '150px';
                    img.style.backgroundColor = '#e8eaed';
                    img.alt = `Generating Image ${i + 1}...`;

                    const dlBtn = document.createElement('button');
                    dlBtn.textContent = 'Generating...';
                    dlBtn.style.backgroundColor = '#80868b';
                    dlBtn.style.marginTop = '4px';
                    dlBtn.disabled = true;

                    imgWrapper.appendChild(img);
                    imgWrapper.appendChild(dlBtn);
                    imagesContainer.appendChild(imgWrapper);

                    const imageCall = provider === 'openai'
                        ? generateImageViaOpenAI(openaiKey, promptText, options)
                        : generateImageViaGemini(geminiKey, promptText, options);

                    imageCall
                        .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            img.src = blobUrl;
                            img.style.minHeight = 'auto';
                            dlBtn.textContent = `Download Image ${i + 1}`;
                            dlBtn.style.backgroundColor = '#0b8043';
                            dlBtn.disabled = false;

                            const filename = `Maps_${placeSlug}_${i + 1}.png`;
                            dlBtn.onclick = () => {
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = filename;
                                a.click();
                            };
                            const autoA = document.createElement('a');
                            autoA.href = blobUrl;
                            autoA.download = filename;
                            autoA.click();
                        })
                        .catch(err => {
                            console.error('Image gen error:', err);
                            img.alt = `Failed: ${err.message}`;
                            dlBtn.textContent = 'Failed';
                        });
                }
            } else {
                promptOutputContainer.style.display = 'none';
            }

            resultsCard.classList.remove('hidden');
        } catch (error) {
            showError('Failed to generate: ' + error.message);
        } finally {
            generateBtn.disabled = false;
            loader.style.display = 'none';
        }
    });

    autoPasteBtn.addEventListener('click', () => {
        const reviewText = reviewOutput.value;
        if (!reviewText) return;
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            const tabUrl = tabs[0] ? tabs[0].url : '';
            if (tabUrl && tabUrl.includes('google.com/maps')) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: (text) => {
                        const box = document.querySelector('textarea, div[role="textbox"]');
                        if (box) {
                            box.focus();
                            document.execCommand('insertText', false, text);
                        } else {
                            alert('Please open the Write a Review box first.');
                        }
                    },
                    args: [reviewText]
                });
            }
        });
    });

    if (copyReviewBtn) {
        copyReviewBtn.addEventListener('click', async () => {
            await copyToClipboard(reviewOutput.value);
            copyReviewBtn.textContent = 'Copied!';
            setTimeout(() => copyReviewBtn.textContent = 'Copy Review', 2000);
        });
    }
});
