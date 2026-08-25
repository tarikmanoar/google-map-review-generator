document.addEventListener('DOMContentLoaded', async () => {
    const PREFS_STORAGE_KEY = 'mapsReviewPrefs';
    const COPILOT_BASE_URL = 'https://copilot-proxy-api.manoar.bd/api/copilot';
    const COPILOT_DEFAULT_MODEL = 'gpt-5-mini';
    const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
    const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
    const DEFAULT_IMGBB_API_KEY = '6dd4a1b8639d6c5641d001cd417608a5';
    const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
    const OPENAI_DEFAULT_IMAGE_MODEL = 'gpt-image-1';
    const GEMINI_DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
    // Hints only - the field is free text, because an endpoint's /models list
    // rarely advertises its image models (and some chat models render images).
    const IMAGE_MODEL_SUGGESTIONS = {
        openai: ['gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2'],
        gemini: ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image-preview', 'imagen-4.0-generate-001']
    };

    const HISTORY_STORAGE_KEY = 'mapsReviewHistory';
    const HISTORY_LIMIT = 25;
    // Image endpoints rate-limit aggressively; firing 4 at once reliably 429s.
    const IMAGE_CONCURRENCY = 2;
    const MAX_REFERENCE_IMAGES = 3;

    // Gemini takes a token budget, OpenAI-style endpoints take an effort label.
    // -1 asks Gemini to decide the budget itself.
    const THINKING_BUDGETS = { minimal: 0, low: 1024, medium: 4096, high: -1 };
    const THINKING_EFFORT = { minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' };

    const POLISH_LEVELS = [
        { label: 'Raw', hint: 'Write like a phone-typed review: lowercase starts, the odd typo, sentence fragments, no polish at all. Do not sound edited.' },
        { label: 'Casual', hint: 'Write casually and unevenly, like a real person tapping this out. Light informality, occasional fragment, no marketing gloss.' },
        { label: 'Natural', hint: 'Write naturally with varied sentence lengths. Mostly clean but not obviously edited.' },
        { label: 'Tidy', hint: 'Write clearly and correctly, with light polish, while still sounding like a person rather than a brand.' },
        { label: 'Polished', hint: 'Write a well-structured, carefully worded review with clean grammar throughout.' }
    ];

    // Each generated image gets a different subject so a batch reads as a set
    // rather than four attempts at the same photo.
    const SHOT_VARIATIONS = [
        'Wide establishing shot showing the venue and its surroundings.',
        'Close-up detail shot of the signature offering or centrepiece.',
        'Interior shot capturing the seating, lighting and atmosphere.',
        'Candid shot from a visitor\'s eye level, slightly off-centre framing.'
    ];

    const providerSelect = document.getElementById('provider');
    const apiKeyInput = document.getElementById('apiKey');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const openaiBaseUrlInput = document.getElementById('openaiBaseUrl');
    const openaiModelSelect = document.getElementById('openaiModel');
    const openaiTemperatureInput = document.getElementById('openaiTemperature');
    const openaiTempValueEl = document.getElementById('openaiTempValue');
    const reloadOpenaiModelsBtn = document.getElementById('reloadOpenaiModelsBtn');
    const openaiModelsStatus = document.getElementById('openaiModelsStatus');
    const openaiSection = document.getElementById('openaiSection');
    const copilotApiKeyInput = document.getElementById('copilotApiKey');
    const copilotModelSelect = document.getElementById('copilotModel');
    const copilotTemperatureInput = document.getElementById('copilotTemperature');
    const copilotTempValueEl = document.getElementById('copilotTempValue');
    const reloadCopilotModelsBtn = document.getElementById('reloadCopilotModelsBtn');
    const copilotModelsStatus = document.getElementById('copilotModelsStatus');
    const copilotSection = document.getElementById('copilotSection');
    const geminiSection = document.getElementById('geminiSection');
    const geminiModelInput = document.getElementById('geminiModel');
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
    const imageModelInput = document.getElementById('imageModel');
    const imageModelHint = document.getElementById('imageModelHint');
    const imageModelSuggestions = document.getElementById('imageModelSuggestions');
    const enableImagesToggle = document.getElementById('enableImagesToggle');
    const imageSettingsAccordion = document.getElementById('imageSettingsAccordion');
    const imageSettingsPanel = document.getElementById('imageSettingsPanel');
    const thinkingLevelSelect = document.getElementById('thinkingLevel');
    const includeThoughtsInput = document.getElementById('includeThoughts');
    const useWebGroundingInput = document.getElementById('useWebGrounding');
    const useImageGroundingInput = document.getElementById('useImageGrounding');
    const referenceImagesInput = document.getElementById('referenceImages');
    const referenceImagesHint = document.getElementById('referenceImagesHint');
    const variantCountSelect = document.getElementById('variantCount');
    const polishLevelInput = document.getElementById('polishLevel');
    const polishValueEl = document.getElementById('polishValue');
    const thinkingHint = document.getElementById('thinkingHint');
    const avoidRepeatsInput = document.getElementById('avoidRepeats');
    const varyImagesInput = document.getElementById('varyImages');
    const groundingGroup = document.getElementById('groundingGroup');
    const groundingHint = document.getElementById('groundingHint');
    const usePlacePhotosInput = document.getElementById('usePlacePhotos');
    const placePhotosHint = document.getElementById('placePhotosHint');
    const stripMetadataInput = document.getElementById('stripMetadata');
    const autoDownloadImagesInput = document.getElementById('autoDownloadImages');
    const uploadToImgbbInput = document.getElementById('uploadToImgbb');
    const imgbbKeyGroup = document.getElementById('imgbbKeyGroup');
    const imgbbApiKeyInput = document.getElementById('imgbbApiKey');
    const placeMetaEl = document.getElementById('placeMeta');
    const placeGapsEl = document.getElementById('placeGaps');
    const placeChangedBanner = document.getElementById('placeChangedBanner');
    const placeChangedText = document.getElementById('placeChangedText');
    const placeChangedReload = document.getElementById('placeChangedReload');
    const staleResultsBanner = document.getElementById('staleResultsBanner');
    const staleResultsText = document.getElementById('staleResultsText');
    const ratingBadge = document.getElementById('ratingBadge');
    const variantTabs = document.getElementById('variantTabs');
    const reviewMeta = document.getElementById('reviewMeta');
    const thoughtsContainer = document.getElementById('thoughtsContainer');
    const thoughtsOutput = document.getElementById('thoughtsOutput');
    const regenerateImagesBtn = document.getElementById('regenerateImagesBtn');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
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
    // The single Image Model input is shared by both image-capable providers,
    // so each provider's choice is remembered separately. '' means "default".
    let imageModelByProvider = { openai: '', gemini: '' };
    let imageModelProvider = null;

    // Review drafts from the last run, plus which one is on screen.
    let currentVariants = [];
    let activeVariantIndex = 0;
    // Everything the image pipeline needs, captured at generate time so
    // "Re-render Images" doesn't depend on the form still holding those values.
    let lastImageContext = null;
    // The place the on-screen results belong to, so we can flag them as stale
    // once the map moves somewhere else.
    let resultsPlaceKey = null;
    // Files the user picked, decoded once and reused across images.
    let userReferenceImages = [];
    let imgbbApiKey = DEFAULT_IMGBB_API_KEY;
    let generationHistory = [];

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
            openaiImageModel: '',
            geminiImageModel: '',
            geminiModel: '',
            enableImages: true,
            thinkingLevel: 'minimal',
            includeThoughts: false,
            useWebGrounding: false,
            useImageGrounding: false,
            variantCount: '1',
            polishLevel: 50,
            avoidRepeats: true,
            varyImages: true,
            usePlacePhotos: false,
            stripMetadata: true,
            autoDownloadImages: false,
            uploadToImgbb: false,
            vibe: '',
            openaiBaseUrl: OPENAI_DEFAULT_BASE_URL,
            openaiModel: OPENAI_DEFAULT_MODEL,
            openaiTemperature: 0.7,
            openaiModels: [OPENAI_DEFAULT_MODEL],
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
            openaiImageModel: imageModelByProvider.openai,
            geminiImageModel: imageModelByProvider.gemini,
            geminiModel: geminiModelInput.value.trim(),
            enableImages: enableImagesToggle.checked,
            thinkingLevel: thinkingLevelSelect.value,
            includeThoughts: includeThoughtsInput.checked,
            useWebGrounding: useWebGroundingInput.checked,
            useImageGrounding: useImageGroundingInput.checked,
            variantCount: variantCountSelect.value,
            polishLevel: parseInt(polishLevelInput.value, 10),
            avoidRepeats: avoidRepeatsInput.checked,
            varyImages: varyImagesInput.checked,
            usePlacePhotos: usePlacePhotosInput.checked,
            stripMetadata: stripMetadataInput.checked,
            autoDownloadImages: autoDownloadImagesInput.checked,
            uploadToImgbb: uploadToImgbbInput.checked,
            vibe: userVibeInput.value,
            openaiBaseUrl: openaiBaseUrlInput.value.trim() || OPENAI_DEFAULT_BASE_URL,
            openaiModel: openaiModelSelect.value,
            openaiTemperature: parseFloat(openaiTemperatureInput.value),
            openaiModels: Array.from(openaiModelSelect.options).map(o => o.value),
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
        imageModelByProvider = {
            openai: typeof prefs.openaiImageModel === 'string' ? prefs.openaiImageModel : '',
            gemini: typeof prefs.geminiImageModel === 'string' ? prefs.geminiImageModel : ''
        };
        imageModelProvider = null;
        geminiModelInput.value = typeof prefs.geminiModel === 'string' ? prefs.geminiModel : '';
        enableImagesToggle.checked = prefs.enableImages !== undefined ? prefs.enableImages : true;
        thinkingLevelSelect.value = prefs.thinkingLevel || thinkingLevelSelect.value;
        includeThoughtsInput.checked = Boolean(prefs.includeThoughts);
        useWebGroundingInput.checked = Boolean(prefs.useWebGrounding);
        useImageGroundingInput.checked = Boolean(prefs.useImageGrounding);
        variantCountSelect.value = prefs.variantCount || '1';
        polishLevelInput.value = String(typeof prefs.polishLevel === 'number' ? prefs.polishLevel : 50);
        avoidRepeatsInput.checked = prefs.avoidRepeats !== undefined ? Boolean(prefs.avoidRepeats) : true;
        varyImagesInput.checked = prefs.varyImages !== undefined ? Boolean(prefs.varyImages) : true;
        usePlacePhotosInput.checked = Boolean(prefs.usePlacePhotos);
        stripMetadataInput.checked = prefs.stripMetadata !== undefined ? Boolean(prefs.stripMetadata) : true;
        autoDownloadImagesInput.checked = Boolean(prefs.autoDownloadImages);
        uploadToImgbbInput.checked = Boolean(prefs.uploadToImgbb);
        userVibeInput.value = prefs.vibe || '';

        openaiBaseUrlInput.value = prefs.openaiBaseUrl || OPENAI_DEFAULT_BASE_URL;
        const savedOpenaiModels = Array.isArray(prefs.openaiModels) && prefs.openaiModels.length
            ? prefs.openaiModels
            : [OPENAI_DEFAULT_MODEL];
        populateModelSelect(openaiModelSelect, savedOpenaiModels, prefs.openaiModel || OPENAI_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL);
        const openaiTemp = typeof prefs.openaiTemperature === 'number' ? prefs.openaiTemperature : 0.7;
        openaiTemperatureInput.value = String(openaiTemp);
        openaiTempValueEl.textContent = openaiTemp.toFixed(1);

        const savedModels = Array.isArray(prefs.copilotModels) && prefs.copilotModels.length
            ? prefs.copilotModels
            : [COPILOT_DEFAULT_MODEL];
        populateModelSelect(copilotModelSelect, savedModels, prefs.copilotModel || COPILOT_DEFAULT_MODEL, COPILOT_DEFAULT_MODEL);
        const temp = typeof prefs.copilotTemperature === 'number' ? prefs.copilotTemperature : 0.2;
        copilotTemperatureInput.value = String(temp);
        copilotTempValueEl.textContent = temp.toFixed(1);

        updateProviderVisibility();
        renderImageModelField();
        updateImageSettingsVisibility();
        updatePolishLabel();
        updateThinkingHint();
        updateImgbbVisibility();
    }

    // ---------- Image model field ----------
    function imageProviderKey(provider) {
        return provider === 'gemini' ? 'gemini' : 'openai';
    }

    function defaultImageModelFor(provider) {
        return imageProviderKey(provider) === 'gemini'
            ? GEMINI_DEFAULT_IMAGE_MODEL
            : OPENAI_DEFAULT_IMAGE_MODEL;
    }

    // Must run before the field is re-pointed at another provider, otherwise
    // the value typed for the old provider is lost (or worse, attributed to
    // the new one).
    function captureImageModelField() {
        if (imageModelProvider) {
            imageModelByProvider[imageModelProvider] = imageModelInput.value.trim();
        }
    }

    function renderImageModelField() {
        const key = imageProviderKey(providerSelect.value);
        imageModelProvider = key;
        imageModelInput.value = imageModelByProvider[key] || '';

        const fallback = defaultImageModelFor(key);
        imageModelInput.placeholder = fallback;
        imageModelHint.textContent = `Any model your endpoint supports. Leave empty to use ${fallback}.`;

        imageModelSuggestions.innerHTML = '';
        for (const id of IMAGE_MODEL_SUGGESTIONS[key] || []) {
            const opt = document.createElement('option');
            opt.value = id;
            imageModelSuggestions.appendChild(opt);
        }
    }

    function getSelectedImageModel(provider) {
        captureImageModelField();
        const key = imageProviderKey(provider);
        return imageModelByProvider[key] || defaultImageModelFor(key);
    }

    function populateModelSelect(selectEl, modelIds, selected, fallback) {
        const ids = (modelIds && modelIds.length) ? modelIds : [fallback];
        selectEl.innerHTML = '';
        for (const id of ids) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            selectEl.appendChild(opt);
        }
        selectEl.value = selected && ids.includes(selected) ? selected : ids[0];
    }

    function updateImageSettingsVisibility() {
        const provider = providerSelect.value;
        const imagesAvailable = provider !== 'copilot';
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

        // Search grounding is a Gemini-only tool. Leaving the checkboxes visible
        // on other providers implies they do something, and they don't.
        const groundingSupported = provider === 'gemini';
        groundingGroup.classList.toggle('hidden', !groundingSupported);
        groundingHint.classList.toggle('hidden', groundingSupported);
        if (!groundingSupported) {
            groundingHint.textContent = 'Google Search grounding is only available on the Gemini provider.';
        }

        updateReferenceSupportHint();
    }

    // Reference images ride along as extra input to the model. Gemini takes them
    // inline; OpenAI-compatible endpoints only accept them on /images/edits,
    // which not every endpoint implements.
    function updateReferenceSupportHint() {
        const provider = providerSelect.value;
        const count = userReferenceImages.length;
        const photosNote = currentPlaceInfo && Array.isArray(currentPlaceInfo.photos) && currentPlaceInfo.photos.length
            ? `${currentPlaceInfo.photos.length} photo${currentPlaceInfo.photos.length === 1 ? '' : 's'} found on this page.`
            : 'No photos detected on this page yet.';
        placePhotosHint.textContent = `Pulls photos off the Maps page so the result resembles the real venue. ${photosNote}`;

        const used = count ? `Using ${count} file${count === 1 ? '' : 's'} (max ${MAX_REFERENCE_IMAGES}). ` : '';
        referenceImagesHint.textContent = provider === 'gemini'
            ? `${used}Sent inline to the image model.`
            : `${used}Sent via /images/edits; endpoints without that route fall back to a text-only prompt.`;
    }

    function updatePolishLabel() {
        polishValueEl.textContent = polishLevelForValue(polishLevelInput.value).label;
    }

    function polishLevelForValue(raw) {
        const pct = Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
        return POLISH_LEVELS[Math.round((pct / 100) * (POLISH_LEVELS.length - 1))];
    }

    function updateThinkingHint() {
        const provider = providerSelect.value;
        thinkingHint.textContent = provider === 'gemini'
            ? 'Sent as a Gemini thinking budget. Dropped automatically if the model rejects it.'
            : 'Sent as reasoning_effort. Dropped automatically if the endpoint rejects it.';
    }

    function updateImgbbVisibility() {
        imgbbKeyGroup.classList.toggle('hidden', !uploadToImgbbInput.checked);
    }

    function updateProviderVisibility() {
        const provider = providerSelect.value;
        geminiSection.classList.toggle('hidden', provider !== 'gemini');
        openaiSection.classList.toggle('hidden', provider !== 'openai');
        copilotSection.classList.toggle('hidden', provider !== 'copilot');

        const labels = { gemini: 'Gemini AI', openai: 'OpenAI', copilot: 'Copilot Proxy' };
        loader.textContent = `Generating with ${labels[provider] || 'AI'}...`;
        updateThinkingHint();
    }

    applyPreferences();

    [
        providerSelect, sentimentSelect, personaStyleSelect, languageModeSelect, lengthSelect,
        imageCountInput, imageQualitySelect, aspectRatioSelect, imageStyleSelect,
        enableImagesToggle, thinkingLevelSelect, includeThoughtsInput,
        useWebGroundingInput, useImageGroundingInput, userVibeInput,
        openaiModelSelect, copilotModelSelect,
        variantCountSelect, polishLevelInput, avoidRepeatsInput, varyImagesInput,
        usePlacePhotosInput, stripMetadataInput, autoDownloadImagesInput, uploadToImgbbInput
    ].forEach(el => {
        el.addEventListener('change', () => {
            if (el === providerSelect) {
                captureImageModelField();
                updateProviderVisibility();
                renderImageModelField();
                updateImageSettingsVisibility();
                if (providerSelect.value === 'copilot' && copilotApiKeyInput.value.trim()) {
                    loadCopilotModels();
                } else if (providerSelect.value === 'openai' && openaiApiKeyInput.value.trim()) {
                    loadOpenaiModels();
                }
            } else if (el === enableImagesToggle) {
                updateImageSettingsVisibility();
            } else if (el === uploadToImgbbInput) {
                updateImgbbVisibility();
            }
            savePreferences();
        });
    });

    polishLevelInput.addEventListener('input', updatePolishLabel);

    imageModelInput.addEventListener('input', captureImageModelField);
    imageModelInput.addEventListener('change', () => {
        captureImageModelField();
        savePreferences();
    });

    geminiModelInput.addEventListener('change', savePreferences);

    imgbbApiKeyInput.addEventListener('change', () => {
        imgbbApiKey = imgbbApiKeyInput.value.trim() || DEFAULT_IMGBB_API_KEY;
        chrome.storage.local.set({ imgbbApiKey: imgbbApiKeyInput.value.trim() });
    });

    referenceImagesInput.addEventListener('change', async () => {
        const files = Array.from(referenceImagesInput.files || []).slice(0, MAX_REFERENCE_IMAGES);
        try {
            userReferenceImages = await Promise.all(files.map(async (file) => ({
                mimeType: file.type || 'image/png',
                data: await blobToBase64(file)
            })));
        } catch (err) {
            userReferenceImages = [];
            showError(`Could not read reference images: ${err.message}`);
        }
        updateReferenceSupportHint();
    });

    openaiBaseUrlInput.addEventListener('change', () => {
        chrome.storage.local.set({ openaiBaseUrl: openaiBaseUrlInput.value.trim() });
        savePreferences();
        if (openaiApiKeyInput.value.trim()) loadOpenaiModels();
    });
    openaiTemperatureInput.addEventListener('input', () => {
        const t = parseFloat(openaiTemperatureInput.value);
        openaiTempValueEl.textContent = (isNaN(t) ? 0.7 : t).toFixed(1);
    });
    openaiTemperatureInput.addEventListener('change', savePreferences);
    reloadOpenaiModelsBtn.addEventListener('click', loadOpenaiModels);

    copilotTemperatureInput.addEventListener('input', () => {
        const t = parseFloat(copilotTemperatureInput.value);
        copilotTempValueEl.textContent = (isNaN(t) ? 0.2 : t).toFixed(1);
    });
    copilotTemperatureInput.addEventListener('change', savePreferences);
    reloadCopilotModelsBtn.addEventListener('click', loadCopilotModels);

    // ---------- API key persistence ----------
    chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'openaiBaseUrl', 'copilotApiKey', 'imgbbApiKey'], (result) => {
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
        if (result.openaiApiKey) openaiApiKeyInput.value = result.openaiApiKey;
        if (result.openaiBaseUrl) openaiBaseUrlInput.value = result.openaiBaseUrl;
        if (result.copilotApiKey) copilotApiKeyInput.value = result.copilotApiKey;
        if (result.imgbbApiKey) {
            imgbbApiKeyInput.value = result.imgbbApiKey;
            imgbbApiKey = result.imgbbApiKey;
        }

        if (providerSelect.value === 'openai' && openaiApiKeyInput.value.trim()) loadOpenaiModels();
        if (providerSelect.value === 'copilot' && copilotApiKeyInput.value.trim()) loadCopilotModels();
    });

    apiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ geminiApiKey: e.target.value });
    });
    openaiApiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ openaiApiKey: e.target.value });
        if (e.target.value.trim()) loadOpenaiModels();
    });
    copilotApiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ copilotApiKey: e.target.value });
        if (e.target.value.trim()) loadCopilotModels();
    });

    function getOpenaiBaseUrl() {
        return (openaiBaseUrlInput.value.trim() || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, '');
    }

    function parseModelList(data) {
        const list = Array.isArray(data?.data) ? data.data
                   : Array.isArray(data?.models) ? data.models
                   : Array.isArray(data) ? data
                   : [];
        return list
            .map(m => typeof m === 'string' ? m : m?.id || m?.name)
            .filter(Boolean);
    }

    async function loadModelsInto(selectEl, statusEl, url, apiKey, fallbackModel) {
        if (!apiKey) {
            statusEl.textContent = 'Enter API key to load models.';
            return;
        }
        statusEl.textContent = 'Loading models...';
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || errData.error || `HTTP ${response.status}`);
            }
            const ids = parseModelList(await response.json());
            if (!ids.length) {
                statusEl.textContent = 'No models returned. Using default.';
                populateModelSelect(selectEl, [fallbackModel], fallbackModel, fallbackModel);
                return;
            }
            const previous = selectEl.value;
            const selected = ids.includes(previous) ? previous
                           : ids.includes(fallbackModel) ? fallbackModel
                           : ids[0];
            populateModelSelect(selectEl, ids, selected, fallbackModel);
            statusEl.textContent = `Loaded ${ids.length} model${ids.length === 1 ? '' : 's'}.`;
            savePreferences();
        } catch (err) {
            statusEl.textContent = `Failed to load models: ${err.message}`;
        }
    }

    function loadOpenaiModels() {
        return loadModelsInto(
            openaiModelSelect,
            openaiModelsStatus,
            `${getOpenaiBaseUrl()}/models`,
            openaiApiKeyInput.value.trim(),
            OPENAI_DEFAULT_MODEL
        );
    }

    function loadCopilotModels() {
        return loadModelsInto(
            copilotModelSelect,
            copilotModelsStatus,
            `${COPILOT_BASE_URL}/models`,
            copilotApiKeyInput.value.trim(),
            COPILOT_DEFAULT_MODEL
        );
    }

    function showError(msg) {
        statusMessage.textContent = msg;
        statusMessage.classList.remove('hidden');
    }

    // ---------- Map scraping ----------
    // Runs in the Maps page via executeScript, so it must stay self-contained.
    // Google rotates its obfuscated class names, so every field tries a chain of
    // strategies and records what it could not find rather than inventing a value.
    function scrapePlaceDOM() {
        const missing = [];

        // Maps renders Material icons as private-use-area glyphs inside the same
        // text nodes as the labels. Left in, they reach the model as tofu boxes.
        function clean(text) {
            return (text || '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim();
        }

        function firstText(root, selectors) {
            for (const sel of selectors) {
                const el = root.querySelector(sel);
                const text = el ? clean(el.innerText) : '';
                if (text) return text;
            }
            return '';
        }

        try {
            const h1Elements = Array.from(document.querySelectorAll('h1'));
            const validH1s = h1Elements.filter(el => {
                if (el.offsetParent === null) return false;
                const text = el.innerText.trim();
                if (!text || text === 'Results' || text === 'Top results' || text === 'Search results') return false;
                return true;
            });

            const nameEl = validH1s.find(el => el.classList.contains('fontHeadlineLarge') || el.classList.contains('DUwDvf')) || validH1s[0];
            const name = nameEl ? clean(nameEl.innerText) : '';
            if (!name) return { error: 'No specific place opened. Please click on a single place from the results.' };

            // Scope everything to the detail pane so search-result siblings don't
            // bleed into the extracted data.
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

            // --- address ---
            let address = '';
            const addressBtn = detailPane.querySelector('button[data-tooltip="Copy address"], button[data-item-id="address"]')
                || Array.from(detailPane.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || '').includes('Address:'));
            if (addressBtn) {
                const label = addressBtn.getAttribute('aria-label') || '';
                address = label.includes('Address:')
                    ? clean(label.split('Address:')[1])
                    : clean(addressBtn.innerText);
            }
            if (!address) address = firstText(detailPane, ['.fontBodyMedium.mgr77e', '.Io6YTe', '.W4Eejd']);
            if (!address) { address = 'Address not found'; missing.push('address'); }

            // --- rating and review count ---
            let rating = '';
            let ratingValue = null;
            let reviewCount = null;
            const ratingEl = detailPane.querySelector('div.fontDisplayLarge, span[aria-label*="stars"], span[aria-label*="star"], div[aria-label*="stars"]');
            if (ratingEl) {
                rating = clean(ratingEl.getAttribute('aria-label') || ratingEl.innerText);
                const num = (rating.match(/(\d+[.,]\d+|\d+)/) || [])[0];
                if (num) ratingValue = parseFloat(num.replace(',', '.'));
            }
            if (ratingValue === null) missing.push('rating');

            const countEl = Array.from(detailPane.querySelectorAll('button, span'))
                .find(el => /^[\d,.\s]+\s*(reviews?|ratings?)$/i.test((el.innerText || '').trim()));
            if (countEl) {
                const digits = (countEl.innerText.match(/[\d,.]+/) || [''])[0].replace(/[.,]/g, '');
                if (digits) reviewCount = parseInt(digits, 10);
            }

            // --- category ---
            let category = firstText(detailPane, ['button[jsaction="pane.rating.category"]', '.DkEaL']);
            if (!category) {
                const possibleCat = Array.from(detailPane.querySelectorAll('button'))
                    .find(b => (b.innerText || '').includes('\u00b7') && b.innerText.length < 40);
                if (possibleCat) category = clean(possibleCat.innerText);
            }
            if (!category) { category = 'Not specified'; missing.push('category'); }

            // --- price level ---
            let priceLevel = '';
            const priceEl = Array.from(detailPane.querySelectorAll('span, button'))
                .find(el => {
                    const label = el.getAttribute('aria-label') || '';
                    if (/price/i.test(label)) return true;
                    const text = (el.innerText || '').trim();
                    return /^[$\u20ac\u00a3\u00a5\u09f3]{1,4}$/.test(text) || /^[$\u20ac\u00a3\u00a5\u09f3]+\s*\d+[\u2013-]/.test(text);
                });
            if (priceEl) priceLevel = clean(priceEl.getAttribute('aria-label') || priceEl.innerText);

            // --- open state / hours ---
            let openState = '';
            const hoursEl = detailPane.querySelector('[data-item-id*="oh"], .OqCZI, .o0Svhf')
                || Array.from(detailPane.querySelectorAll('span, div'))
                    .find(el => /^(open|closed|opens|closes|temporarily closed|permanently closed)\b/i.test((el.innerText || '').trim()));
            if (hoursEl) {
                openState = clean(hoursEl.innerText);
                // The hours element usually contains the whole week's table after
                // the status line; keep only the status.
                const dayCut = openState.search(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
                if (dayCut > 0) openState = openState.slice(0, dayCut).trim();
                openState = openState.replace(/[\u00b7,;]\s*$/, '').slice(0, 80).trim();
                if (/^(open|closed|opens|closes)/i.test(openState) === false && openState.length > 40) openState = '';
            }

            // --- amenity / highlight chips ---
            const amenities = Array.from(detailPane.querySelectorAll('[data-item-id^="place-info-links"], .CK16pd, .LTs0Rc'))
                .map(el => clean(el.getAttribute('aria-label') || el.innerText))
                .filter(t => t && t.length < 60);

            // --- website / phone ---
            const websiteEl = detailPane.querySelector('a[data-item-id="authority"], [data-item-id="authority"]');
            const website = websiteEl ? clean(websiteEl.getAttribute('href') || websiteEl.innerText) : '';
            const phoneEl = detailPane.querySelector('[data-item-id^="phone"]');
            const phone = phoneEl ? clean((phoneEl.getAttribute('aria-label') || phoneEl.innerText || '').replace('Phone:', '')) : '';

            // --- visitor reviews ---
            // Maps keeps both a truncated and an expanded copy of each review in
            // the DOM, so collapse them and keep the fuller text.
            const reviewEls = detailPane.querySelectorAll('.MyEned, .wiI7pd, [data-review-id] .wiI7pd');
            const bestByOpening = new Map();
            for (const el of reviewEls) {
                const text = clean(el.innerText).replace(/\s*[.\u2026]*\s*More$/i, '').trim();
                if (!text) continue;
                const key = text.slice(0, 60).toLowerCase();
                const existing = bestByOpening.get(key);
                if (!existing || existing.length < text.length) bestByOpening.set(key, text);
            }
            const reviews = Array.from(bestByOpening.values()).slice(0, 12);
            if (!reviews.length) missing.push('visitor reviews');

            // --- photos, for use as image references ---
            // Maps serves thumbnails with a "=w123-h456" size suffix; request a
            // larger render so the reference is actually usable.
            const photos = Array.from(detailPane.querySelectorAll('img'))
                .map(img => img.src || '')
                .filter(src => /googleusercontent\.com|ggpht\.com/.test(src))
                .filter(src => !/=s\d{1,2}(-|$)/.test(src))
                .map(src => src.replace(/=w\d+-h\d+.*$/, '=w800-h800').replace(/=s\d+(-.*)?$/, '=s800'))
                .filter((src, i, arr) => arr.indexOf(src) === i)
                .slice(0, 6);

            return {
                name, address, rating, ratingValue, reviewCount, category,
                priceLevel, openState, amenities, website, phone, reviews, photos,
                missing
            };
        } catch (e) {
            return { error: e.toString() };
        }
    }

    function placeKeyOf(info) {
        if (!info) return null;
        return `${info.name || ''}|${info.address || ''}`;
    }

    function renderPlaceCard(data) {
        placeNameEl.textContent = data.name;
        placeAddressEl.textContent = data.address;

        const chips = [];
        if (data.category && data.category !== 'Not specified') chips.push(data.category);
        if (data.ratingValue !== null && data.ratingValue !== undefined) {
            chips.push(data.reviewCount ? `${data.ratingValue}★ (${data.reviewCount.toLocaleString()})` : `${data.ratingValue}★`);
        }
        if (data.priceLevel) chips.push(data.priceLevel);
        if (data.openState) chips.push(data.openState);
        if (Array.isArray(data.photos) && data.photos.length) chips.push(`${data.photos.length} photos`);

        placeMetaEl.innerHTML = '';
        for (const chip of chips) {
            const span = document.createElement('span');
            span.className = 'badge';
            span.textContent = chip;
            placeMetaEl.appendChild(span);
        }

        // Say what could not be read instead of silently passing blanks to the
        // model, which is how "Address not found" ends up inside a review.
        const missing = Array.isArray(data.missing) ? data.missing : [];
        if (missing.length) {
            placeGapsEl.textContent = `Could not read: ${missing.join(', ')}. The review will work around it.`;
            placeGapsEl.classList.remove('hidden');
        } else {
            placeGapsEl.classList.add('hidden');
        }
    }

    // The tab this panel belongs to. The panel is enabled per tab, so whenever
    // it is on screen the focused window's active tab is its tab.
    let panelTabId = null;
    let pendingPlace = null;
    let rescanTimer = null;

    async function getPanelTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            return tab || null;
        } catch (_) {
            return null;
        }
    }

    function adoptPlace(data) {
        currentPlaceInfo = data;
        pendingPlace = null;
        placeChangedBanner.classList.add('hidden');
        statusMessage.classList.add('hidden');
        generateBtn.disabled = false;
        renderPlaceCard(data);
        placeCard.classList.remove('hidden');
        updateReferenceSupportHint();
    }

    function offerPlace(data) {
        // Results are on screen for a different place. Swapping the place out
        // from under the user would strand those results, so ask first.
        pendingPlace = data;
        placeChangedText.textContent = `The map moved to "${data.name}".`;
        placeChangedBanner.classList.remove('hidden');
        staleResultsText.textContent = `These results are for "${currentPlaceInfo ? currentPlaceInfo.name : 'a previous place'}".`;
        staleResultsBanner.classList.remove('hidden');
    }

    async function extractMapData({ auto = false } = {}) {
        const tab = await getPanelTab();
        if (!tab || !self.MapsUrl.isMapsUrl(tab.url)) {
            if (!auto) {
                showError('Please open a location on Google Maps first.');
                generateBtn.disabled = true;
            }
            return;
        }
        panelTabId = tab.id;

        let data;
        try {
            const [injection] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scrapePlaceDOM
            });
            data = injection && injection.result;
        } catch (err) {
            if (!auto) showError(`Failed to read map data: ${err.message}`);
            return;
        }

        if (!data) {
            if (!auto) showError('Failed to read map data. Try refreshing the page.');
            return;
        }
        if (data.error) {
            // On an automatic pass this usually just means the user is back on
            // the results list, which is not worth an error banner.
            if (!auto) {
                showError(data.error);
                generateBtn.disabled = true;
            }
            return;
        }

        const newKey = placeKeyOf(data);
        if (auto && newKey === placeKeyOf(currentPlaceInfo)) return;

        const resultsVisible = !resultsCard.classList.contains('hidden');
        if (auto && resultsVisible && resultsPlaceKey && newKey !== resultsPlaceKey) {
            offerPlace(data);
        } else {
            adoptPlace(data);
        }
    }

    function scheduleRescan() {
        // Maps fires a burst of URL updates while panning; settle before reading.
        clearTimeout(rescanTimer);
        rescanTimer = setTimeout(() => extractMapData({ auto: true }), 600);
    }

    chrome.tabs.onUpdated.addListener((tabId, info) => {
        if (panelTabId !== null && tabId !== panelTabId) return;
        if (!info.url && info.status !== 'complete') return;
        scheduleRescan();
    });

    chrome.tabs.onActivated.addListener(({ tabId }) => {
        panelTabId = tabId;
        scheduleRescan();
    });

    placeChangedReload.addEventListener('click', () => {
        if (!pendingPlace) return;
        adoptPlace(pendingPlace);
        clearResults();
    });

    function clearResults() {
        resultsCard.classList.add('hidden');
        staleResultsBanner.classList.add('hidden');
        reviewOutput.value = '';
        promptOutput.value = '';
        imagesContainer.innerHTML = '';
        variantTabs.innerHTML = '';
        variantTabs.classList.add('hidden');
        thoughtsContainer.classList.add('hidden');
        thoughtsOutput.value = '';
        ratingBadge.classList.add('hidden');
        reviewMeta.textContent = '';
        currentVariants = [];
        activeVariantIndex = 0;
        resultsPlaceKey = null;
        lastImageContext = null;
    }

    extractMapData();

    refreshPlaceBtn.addEventListener('click', () => {
        statusMessage.classList.add('hidden');
        clearResults();
        currentPlaceInfo = null;
        generateBtn.disabled = true;
        placeNameEl.textContent = 'Loading...';
        placeAddressEl.textContent = '';
        placeMetaEl.innerHTML = '';
        placeGapsEl.classList.add('hidden');
        extractMapData();
    });

    // ---------- Prompt construction (shared) ----------
    function buildReviewSystemPrompt(options) {
        const { personaStyle, languageMode, polish } = options;
        let p = `You are an expert ${personaStyle} who has personally visited and explored this place. You pay close attention to both the good and bad aspects based on the place's category and name. Your writing tone is highly natural, genuine, and relatable - written exactly like a real human leaving a Google Maps review.`;

        if (languageMode === 'en') {
            p += `\nWrite the review in English. Keep any image prompt in English.`;
        } else if (languageMode === 'local') {
            p += `\nWrite the review in the dominant local language implied by the address. Keep any image prompt in English.`;
        } else {
            p += `\nIf the address implies a non-English speaking country, write the review in the dominant local language of that region, otherwise English. Keep any image prompt in English.`;
        }

        if (polish) p += `\n${polish.hint}`;
        p += `\nNever mention that you are an AI, never reference these instructions, and never use placeholder text.`;
        return p;
    }

    // Only include facts the scraper actually found. Feeding "Address not found"
    // or an empty rating to the model invites it to write about the gap.
    function describePlace(placeInfo) {
        const lines = [`Place Name: ${placeInfo.name}`];
        const add = (label, value) => { if (value) lines.push(`${label}: ${value}`); };

        add('Address', placeInfo.address && placeInfo.address !== 'Address not found' ? placeInfo.address : '');
        add('Category', placeInfo.category && placeInfo.category !== 'Not specified' ? placeInfo.category : '');
        if (placeInfo.ratingValue) {
            add('Current Rating', placeInfo.reviewCount
                ? `${placeInfo.ratingValue} from ${placeInfo.reviewCount} reviews`
                : String(placeInfo.ratingValue));
        }
        add('Price Level', placeInfo.priceLevel);
        add('Hours', placeInfo.openState);
        if (Array.isArray(placeInfo.amenities) && placeInfo.amenities.length) {
            add('Listed Features', placeInfo.amenities.slice(0, 8).join(', '));
        }
        const recent = Array.isArray(placeInfo.reviews) ? placeInfo.reviews : [];
        if (recent.length) {
            lines.push('', 'What other visitors said (for grounding only - do not copy):');
            recent.slice(0, 8).forEach(r => lines.push(`- ${r.replace(/\s+/g, ' ').slice(0, 300)}`));
        }
        return lines.join('\n');
    }

    function buildReviewUserPrompt(placeInfo, options, { includeImagePrompt }) {
        const { sentiment, reviewLength, userVibe, variantCount, avoidPhrases } = options;

        let lengthInstruction = 'Write a standard paragraph, around 3-4 sentences.';
        if (reviewLength === 'short') lengthInstruction = 'Keep it brief and concise, around 1-2 sentences.';
        else if (reviewLength === 'long') lengthInstruction = 'Write a comprehensive and detailed review, around 5-7 sentences.';

        const count = Math.max(1, Math.min(3, parseInt(variantCount, 10) || 1));

        let body = `${describePlace(placeInfo)}

Task: Write ${count === 1 ? 'one authentic, human-like' : `${count} distinct authentic, human-like`} ${sentiment} review${count === 1 ? '' : 's'}. ${lengthInstruction}`;

        if (count > 1) {
            body += `\nEach variant must take a genuinely different angle - a different detail noticed, a different opening, a different rhythm. Do not paraphrase one review ${count} times.`;
        }
        if (userVibe) {
            body += `\nWeave this personal experience in naturally: "${userVibe}"`;
        }
        if (Array.isArray(avoidPhrases) && avoidPhrases.length) {
            body += `\nYou have recently written the reviews below. Avoid reusing their openings, phrasing and structure:\n${avoidPhrases.map(t => `- ${t.slice(0, 160)}`).join('\n')}`;
        }

        body += `\nAlso pick the star rating (1-5, integer) that honestly matches the tone of each review you write.`;
        if (includeImagePrompt) {
            body += `\nAlso write a descriptive image generation prompt for each review, matching the atmosphere it describes. Describe the venue concretely; do not name real people.`;
        }

        const variantShape = includeImagePrompt
            ? '{"review": string, "rating": number, "image_prompt": string}'
            : '{"review": string, "rating": number}';
        body += `\n\nReturn strictly one JSON object: {"variants": [${variantShape}]} with exactly ${count} item${count === 1 ? '' : 's'}.`;

        return body;
    }

    // Accepts both the {"variants": [...]} shape we ask for and the older
    // {"review", "image_prompt"} shape, so a model that ignores the schema still
    // produces something usable.
    function normalizeReviewResult(parsed) {
        const rawVariants = Array.isArray(parsed && parsed.variants) ? parsed.variants
            : Array.isArray(parsed && parsed.reviews) ? parsed.reviews
            : parsed && (parsed.review || parsed.image_prompt) ? [parsed]
            : [];

        const variants = rawVariants
            .map(v => {
                if (typeof v === 'string') return { review: v.trim(), rating: null, imagePrompt: '' };
                const review = typeof v.review === 'string' ? v.review.trim()
                    : typeof v.text === 'string' ? v.text.trim() : '';
                const ratingNum = Number(v.rating);
                return {
                    review,
                    rating: Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? Math.round(ratingNum) : null,
                    imagePrompt: typeof v.image_prompt === 'string' ? v.image_prompt.trim() : ''
                };
            })
            .filter(v => v.review);

        if (!variants.length) throw new Error('Model returned no usable review text.');
        return variants;
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

    // ---------- Shared request plumbing ----------
    async function postJson(url, headers, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const message = errData.error?.message
                || (typeof errData.error === 'string' ? errData.error : '')
                || errData.message
                || `Request failed (HTTP ${response.status})`;
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    // Reasoning controls are the parameter endpoints most often reject, and the
    // model field is free text, so send them and retry once without on a 400.
    function looksLikeRejectedParam(message) {
        return /thinking|thought|reasoning|unsupported|unrecognized|unknown (field|parameter|argument)|invalid.*(parameter|argument|field)|extra inputs/i
            .test(message || '');
    }

    async function postJsonSheddingThinking(url, headers, payload, stripThinking) {
        try {
            return await postJson(url, headers, payload);
        } catch (error) {
            const retriable = (error.status === 400 || error.status === 422)
                && looksLikeRejectedParam(error.message);
            if (!retriable) throw error;
            return postJson(url, headers, stripThinking(payload));
        }
    }

    // ---------- Provider: Gemini direct ----------
    async function generateReviewViaGemini(apiKey, placeInfo, options) {
        const model = ((options.textModel || '').trim() || GEMINI_DEFAULT_MODEL).replace(/^models\//, '');
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const systemPrompt = buildReviewSystemPrompt(options);
        const userPrompt = buildReviewUserPrompt(placeInfo, options, { includeImagePrompt: options.enableImages });

        const payload = {
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: 'application/json' }
        };

        const budget = THINKING_BUDGETS[options.thinkingLevel];
        if (budget !== undefined) {
            payload.generationConfig.thinkingConfig = { thinkingBudget: budget };
            if (options.includeThoughts) payload.generationConfig.thinkingConfig.includeThoughts = true;
        }

        const data = await postJsonSheddingThinking(endpoint, {}, payload, (p) => {
            const next = JSON.parse(JSON.stringify(p));
            delete next.generationConfig.thinkingConfig;
            return next;
        });

        const parts = data?.candidates?.[0]?.content?.parts || [];
        // With includeThoughts the reasoning arrives as sibling parts flagged
        // thought:true; everything else is the answer.
        const thoughts = parts.filter(part => part.thought).map(part => part.text || '').join('\n').trim();
        const text = parts.filter(part => !part.thought).map(part => part.text || '').join('').trim();
        if (!text) throw new Error(`Gemini model "${model}" returned no text.`);

        return { variants: normalizeReviewResult(tryParseJsonText(text)), thoughts };
    }

    const IMAGE_STYLE_HINTS = {
        photorealistic: 'photorealistic, real-life details, natural textures',
        cinematic: 'cinematic composition, dramatic lighting, wide dynamic range',
        'golden-hour': 'golden hour sunlight, warm tones, soft glow',
        'night-vibrant': 'vibrant night scene, neon accents, rich contrast'
    };

    // Each image in a batch gets its own shot direction, otherwise N calls with
    // an identical prompt come back as N near-identical pictures.
    function composeImagePrompt(promptText, options, index) {
        const style = IMAGE_STYLE_HINTS[options.imageStyle] || IMAGE_STYLE_HINTS.photorealistic;
        const parts = [promptText, `Style guidance: ${style}`];
        if (options.varyImages && index > 0) parts.push(SHOT_VARIATIONS[index % SHOT_VARIATIONS.length]);
        else if (options.varyImages) parts.push(SHOT_VARIATIONS[0]);
        return parts.filter(Boolean).join('. ');
    }

    async function generateImageViaGemini(apiKey, promptText, options) {
        // Tolerate the "models/<id>" form so a value copied straight out of the
        // Gemini docs still resolves.
        const model = ((options.imageModel || '').trim() || GEMINI_DEFAULT_IMAGE_MODEL).replace(/^models\//, '');
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const aspectHint = options.aspectRatio ? `Aspect ratio: ${options.aspectRatio}.` : '';
        const sizeHint = options.imageQuality ? `Output size: ${options.imageQuality}.` : '';
        const searchHint = options.useWebGrounding ? 'Use Google Search grounding for factual environment details.' : '';
        const imageSearchHint = options.useImageGrounding ? 'Use image search grounding for visual references, but avoid people sourced from search.' : '';
        const references = options.referenceImages || [];
        const refHint = references.length
            ? 'Use the supplied reference photographs for the venue\'s real appearance, materials and layout. Do not reproduce recognisable faces.'
            : '';

        const fullPrompt = `${promptText}. ${aspectHint} ${sizeHint} ${searchHint} ${imageSearchHint} ${refHint}`.replace(/\s+/g, ' ').trim();

        const parts = [{ text: fullPrompt }];
        for (const ref of references) {
            parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
        }

        const payload = {
            contents: [{ parts }],
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
            throw new Error(errData.error?.message || `Gemini image request failed for model "${model}"`);
        }

        const data = await response.json();
        const responseParts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of responseParts) {
            const inlineData = part.inlineData || part.inline_data;
            if (inlineData?.data) {
                const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
                return base64ToBlob(inlineData.data, mimeType);
            }
        }
        throw new Error(`No image returned from Gemini model "${model}".`);
    }

    // ---------- Provider: OpenAI / compatible ----------
    function buildChatPayload(model, temperature, placeInfo, options) {
        const systemPrompt = buildReviewSystemPrompt(options) +
            '\n\nIMPORTANT: Reply ONLY with a single valid JSON object. No prose before or after. No markdown code fences. Start your output with "{" and end with "}".';
        const userPrompt = buildReviewUserPrompt(placeInfo, options, { includeImagePrompt: options.enableImages });

        const payload = {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature
        };
        const effort = THINKING_EFFORT[options.thinkingLevel];
        if (effort) payload.reasoning_effort = effort;
        return payload;
    }

    function stripReasoning(payload) {
        const { reasoning_effort, ...rest } = payload;
        return rest;
    }

    // Endpoints disagree on where the text lives; check the common shapes.
    function extractChatText(data) {
        const message = data?.choices?.[0]?.message;
        return (typeof message?.content === 'string' && message.content)
            || (typeof data?.message === 'string' ? data.message : data?.message?.content)
            || data?.content
            || data?.text
            || '';
    }

    function extractChatThoughts(data) {
        const message = data?.choices?.[0]?.message || data?.message || {};
        const raw = message.reasoning_content || message.reasoning || data?.reasoning || '';
        return typeof raw === 'string' ? raw.trim() : '';
    }

    function parseChatResponse(data, label) {
        const text = extractChatText(data);
        if (!text || !text.trim()) throw new Error(`${label} returned empty response.`);
        const thoughts = extractChatThoughts(data);
        try {
            return { variants: normalizeReviewResult(tryParseJsonText(text)), thoughts };
        } catch (_) {
            // A model that ignored the JSON instruction still wrote a review.
            return { variants: [{ review: text.trim(), rating: null, imagePrompt: '' }], thoughts };
        }
    }

    async function generateReviewViaOpenAI(apiKey, baseUrl, model, temperature, placeInfo, options) {
        const data = await postJsonSheddingThinking(
            `${baseUrl}/chat/completions`,
            { 'Authorization': `Bearer ${apiKey}` },
            buildChatPayload(model, temperature, placeInfo, options),
            stripReasoning
        );
        return parseChatResponse(data, 'OpenAI endpoint');
    }

    // ---------- Provider: Copilot Proxy ----------
    async function generateReviewViaCopilot(apiKey, model, temperature, placeInfo, options) {
        const data = await postJsonSheddingThinking(
            `${COPILOT_BASE_URL}/chat`,
            { 'Authorization': `Bearer ${apiKey}` },
            buildChatPayload(model, temperature, placeInfo, options),
            stripReasoning
        );
        return parseChatResponse(data, 'Copilot proxy');
    }

    const LANDSCAPE_RATIOS = ['16:9', '21:9', '3:2', '4:3', '5:4', '4:1', '8:1'];
    const PORTRAIT_RATIOS = ['9:16', '2:3', '3:4', '4:5', '1:4', '1:8'];

    function aspectRatioToOpenAISize(ratio, family) {
        // Image endpoints only accept a fixed set of sizes; map to the nearest.
        const r = (ratio || '1:1').trim();
        if (family === 'dall-e-3') {
            if (LANDSCAPE_RATIOS.includes(r)) return '1792x1024';
            if (PORTRAIT_RATIOS.includes(r)) return '1024x1792';
            return '1024x1024';
        }
        if (family === 'dall-e-2') return '1024x1024';
        if (LANDSCAPE_RATIOS.includes(r)) return '1536x1024';
        if (PORTRAIT_RATIOS.includes(r)) return '1024x1536';
        return '1024x1024';
    }

    function openAIImageFamily(model) {
        const m = (model || '').toLowerCase();
        if (m.startsWith('dall-e-3')) return 'dall-e-3';
        if (m.startsWith('dall-e-2')) return 'dall-e-2';
        return 'default';
    }

    function buildOpenAIImagePayload(model, prompt, options) {
        const family = openAIImageFamily(model);
        const wantsHighQuality = options.imageQuality === '2K' || options.imageQuality === '4K';
        const payload = { model, prompt, n: 1, size: aspectRatioToOpenAISize(options.aspectRatio, family) };

        // dall-e-2 rejects `quality` entirely; dall-e-3 uses standard/hd where
        // gpt-image-1 (and most compatible endpoints) use medium/high.
        if (family === 'dall-e-3') {
            payload.quality = wantsHighQuality ? 'hd' : 'standard';
        } else if (family !== 'dall-e-2') {
            payload.quality = wantsHighQuality ? 'high' : 'medium';
        }
        return payload;
    }

    async function requestOpenAIImage(apiKey, baseUrl, payload) {
        const response = await fetch(`${baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const message = errData.error?.message || errData.message
                || `Image request failed for model "${payload.model}" (HTTP ${response.status})`;
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    async function extractOpenAIImageBlob(data) {
        const item = data?.data?.[0] || {};

        // Some endpoints return inline base64, others return a hosted URL.
        const b64 = item.b64_json || item.b64 || data?.b64_json;
        if (b64) return base64ToBlob(b64, 'image/png');

        const imageUrl = item.url || data?.url || item.image_url || item.image;
        if (imageUrl) {
            const imgResponse = await fetch(imageUrl);
            if (!imgResponse.ok) throw new Error(`Image URL fetch failed (HTTP ${imgResponse.status})`);
            const blob = await imgResponse.blob();
            if (!blob || blob.size === 0) throw new Error('Fetched image was empty.');
            return blob;
        }

        const keys = Object.keys(item).join(', ') || Object.keys(data || {}).join(', ');
        throw new Error(`No image in response (got keys: ${keys || 'none'}).`);
    }

    // A free-text model means a typo also lands as a 400, and shedding
    // parameters can never fix that - fail fast instead of retrying.
    function isUnsupportedParamError(message) {
        const m = (message || '').toLowerCase();
        const aboutModel = m.includes('model');
        const missing = /(not found|does not exist|unknown|no such|not available|unsupported model|invalid model)/.test(m);
        return !(aboutModel && missing);
    }

    // Reference images are only accepted on /images/edits, which plenty of
    // OpenAI-compatible endpoints do not implement - hence the fallback.
    async function requestOpenAIImageEdit(apiKey, baseUrl, payload, references) {
        const form = new FormData();
        form.append('model', payload.model);
        form.append('prompt', payload.prompt);
        form.append('n', String(payload.n));
        if (payload.size) form.append('size', payload.size);
        if (payload.quality) form.append('quality', payload.quality);

        const field = references.length > 1 ? 'image[]' : 'image';
        references.forEach((ref, i) => {
            form.append(field, base64ToBlob(ref.data, ref.mimeType), `reference-${i + 1}.png`);
        });

        const response = await fetch(`${baseUrl}/images/edits`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: form
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const error = new Error(errData.error?.message || errData.message
                || `Image edit failed for model "${payload.model}" (HTTP ${response.status})`);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    async function generateImageViaOpenAI(apiKey, baseUrl, promptText, options) {
        const model = (options.imageModel || '').trim() || OPENAI_DEFAULT_IMAGE_MODEL;
        const payload = buildOpenAIImagePayload(model, promptText, options);
        const references = options.referenceImages || [];

        if (references.length) {
            try {
                return await extractOpenAIImageBlob(await requestOpenAIImageEdit(apiKey, baseUrl, payload, references));
            } catch (error) {
                console.warn('Image edit with references failed, falling back to text-only:', error.message);
            }
        }

        // An arbitrary model on an arbitrary compatible endpoint may reject the
        // optional knobs, so shed them one at a time before giving up.
        const attempts = [payload];
        if ('quality' in payload) {
            const { quality, ...withoutQuality } = payload;
            attempts.push(withoutQuality);
        }
        const { quality: _q, size: _s, ...minimal } = payload;
        attempts.push(minimal);

        let lastError;
        for (const attempt of attempts) {
            try {
                const data = await requestOpenAIImage(apiKey, baseUrl, attempt);
                return await extractOpenAIImageBlob(data);
            } catch (error) {
                lastError = error;
                // Only a rejected-parameter error is worth retrying; auth, rate
                // limit, missing endpoint and server errors are not.
                const retriable = (error.status === 400 || error.status === 422)
                    && isUnsupportedParamError(error.message);
                if (!retriable) throw error;
            }
        }
        throw lastError;
    }

    // ---------- Helpers ----------
    async function blobToBase64(blob) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    async function uploadImageToImgBB(blob) {
        const base64Image = await blobToBase64(blob);
        const formData = new FormData();
        formData.append('image', base64Image);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbApiKey)}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!result?.success) {
            throw new Error(result?.error?.message || `ImgBB upload failed (HTTP ${response.status})`);
        }
        return {
            url: result.data.url,
            displayUrl: result.data.display_url || result.data.url,
            deleteUrl: result.data.delete_url
        };
    }

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

    // Runs at most `limit` tasks at once and never rejects: each slot reports
    // its own outcome so one failed image doesn't cancel the rest.
    async function runWithLimit(limit, tasks) {
        const results = new Array(tasks.length);
        let cursor = 0;
        async function worker() {
            while (cursor < tasks.length) {
                const index = cursor++;
                try {
                    results[index] = { ok: true, value: await tasks[index]() };
                } catch (error) {
                    results[index] = { ok: false, error };
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
        return results;
    }

    // Re-encoding through a canvas drops EXIF, GPS and any generator tags. Falls
    // back to the original blob rather than losing the image on a decode error.
    async function stripImageMetadata(blob) {
        try {
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            bitmap.close();
            const cleaned = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            return cleaned && cleaned.size ? cleaned : blob;
        } catch (_) {
            return blob;
        }
    }

    // Photos scraped off the Maps page, downloaded and inlined as references.
    async function fetchPlacePhotos(urls, limit) {
        const picked = (urls || []).slice(0, limit);
        const results = await runWithLimit(3, picked.map(url => async () => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            if (!blob.size) throw new Error('empty');
            return { mimeType: blob.type || 'image/jpeg', data: await blobToBase64(blob) };
        }));
        return results.filter(r => r.ok).map(r => r.value);
    }

    // ---------- History ----------
    function loadHistory() {
        chrome.storage.local.get([HISTORY_STORAGE_KEY], (result) => {
            generationHistory = Array.isArray(result[HISTORY_STORAGE_KEY]) ? result[HISTORY_STORAGE_KEY] : [];
            renderHistory();
        });
    }

    function addToHistory(entry) {
        generationHistory.unshift(entry);
        generationHistory = generationHistory.slice(0, HISTORY_LIMIT);
        chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: generationHistory });
        renderHistory();
    }

    // Feeds the last few reviews back as negative examples so the model stops
    // opening every review the same way.
    function recentReviewTexts(limit) {
        return generationHistory.slice(0, limit).map(e => e.review).filter(Boolean);
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (!generationHistory.length) {
            const empty = document.createElement('p');
            empty.className = 'helper-text';
            empty.textContent = 'Nothing generated yet.';
            historyList.appendChild(empty);
            clearHistoryBtn.classList.add('hidden');
            return;
        }
        clearHistoryBtn.classList.remove('hidden');

        for (const entry of generationHistory) {
            const row = document.createElement('div');
            row.className = 'history-entry';

            const place = document.createElement('div');
            place.className = 'h-place';
            place.textContent = entry.place || 'Unknown place';

            const when = document.createElement('span');
            when.className = 'helper-text';
            when.textContent = `${new Date(entry.at).toLocaleString()}${entry.rating ? ` · ${entry.rating}★` : ''}`;

            const text = document.createElement('div');
            text.className = 'h-text';
            text.textContent = entry.review.length > 180 ? `${entry.review.slice(0, 180)}…` : entry.review;

            const buttons = document.createElement('div');
            buttons.className = 'row-buttons';

            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy';
            copyBtn.style.background = '#5f6368';
            copyBtn.onclick = async () => {
                await copyToClipboard(entry.review);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
            };

            const reuseBtn = document.createElement('button');
            reuseBtn.textContent = 'Load';
            reuseBtn.style.background = '#e8eaed';
            reuseBtn.style.color = '#202124';
            reuseBtn.onclick = () => {
                reviewOutput.value = entry.review;
                resultsCard.classList.remove('hidden');
                reviewOutputContainer.style.display = 'block';
            };

            buttons.appendChild(copyBtn);
            buttons.appendChild(reuseBtn);
            row.appendChild(place);
            row.appendChild(when);
            row.appendChild(text);
            row.appendChild(buttons);
            historyList.appendChild(row);
        }
    }

    clearHistoryBtn.addEventListener('click', () => {
        generationHistory = [];
        chrome.storage.local.remove(HISTORY_STORAGE_KEY);
        renderHistory();
    });

    loadHistory();

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

    // ---------- Results rendering ----------
    function selectVariant(index) {
        if (!currentVariants[index]) return;
        activeVariantIndex = index;
        const variant = currentVariants[index];

        reviewOutput.value = variant.review;
        promptOutput.value = variant.imagePrompt || promptOutput.value;

        if (variant.rating) {
            ratingBadge.textContent = `Suggested: ${variant.rating}★`;
            ratingBadge.classList.remove('hidden');
        } else {
            ratingBadge.classList.add('hidden');
        }

        const words = variant.review.trim().split(/\s+/).filter(Boolean).length;
        reviewMeta.textContent = `${words} word${words === 1 ? '' : 's'} · ${variant.review.length} characters`;

        Array.from(variantTabs.children).forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });
    }

    function renderVariants() {
        variantTabs.innerHTML = '';
        if (currentVariants.length > 1) {
            currentVariants.forEach((variant, i) => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'variant-tab';
                tab.textContent = variant.rating ? `Draft ${i + 1} · ${variant.rating}★` : `Draft ${i + 1}`;
                tab.onclick = () => selectVariant(i);
                variantTabs.appendChild(tab);
            });
            variantTabs.classList.remove('hidden');
        } else {
            variantTabs.classList.add('hidden');
        }
        selectVariant(0);
    }

    function createImageSlot(index) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '10px';

        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.borderRadius = '4px';
        img.style.minHeight = '150px';
        img.style.backgroundColor = '#e8eaed';
        img.alt = `Generating image ${index + 1}...`;

        const status = document.createElement('div');
        status.className = 'helper-text';
        status.textContent = 'Queued…';

        const buttons = document.createElement('div');
        buttons.className = 'row-buttons';
        buttons.style.marginTop = '4px';

        wrapper.appendChild(img);
        wrapper.appendChild(buttons);
        wrapper.appendChild(status);
        imagesContainer.appendChild(wrapper);

        return { wrapper, img, status, buttons };
    }

    function attachImageActions(slot, blob, filename, options) {
        const blobUrl = URL.createObjectURL(blob);
        slot.img.src = blobUrl;
        slot.img.style.minHeight = 'auto';
        slot.img.alt = filename;

        const download = () => {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.click();
        };

        const dlBtn = document.createElement('button');
        dlBtn.textContent = 'Download';
        dlBtn.style.background = '#0b8043';
        dlBtn.onclick = download;
        slot.buttons.appendChild(dlBtn);

        const uploadBtn = document.createElement('button');
        uploadBtn.textContent = 'Upload to ImgBB';
        uploadBtn.style.background = '#5f6368';
        uploadBtn.onclick = () => runImgbbUpload(slot, blob, uploadBtn);
        slot.buttons.appendChild(uploadBtn);

        slot.status.textContent = options.stripMetadata ? 'Ready · metadata stripped' : 'Ready';

        if (options.autoDownloadImages) download();
        if (options.uploadToImgbb) runImgbbUpload(slot, blob, uploadBtn);
    }

    async function runImgbbUpload(slot, blob, button) {
        button.disabled = true;
        button.textContent = 'Uploading…';
        try {
            const { url } = await uploadImageToImgBB(blob);
            slot.status.innerHTML = '';

            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = url;
            link.style.color = '#1a73e8';
            slot.status.appendChild(link);

            button.disabled = false;
            button.textContent = 'Copy URL';
            button.onclick = async () => {
                await copyToClipboard(url);
                button.textContent = 'Copied!';
                setTimeout(() => { button.textContent = 'Copy URL'; }, 1500);
            };
        } catch (err) {
            slot.status.textContent = `ImgBB upload failed: ${err.message}`;
            slot.status.style.color = '#d93025';
            button.disabled = false;
            button.textContent = 'Retry upload';
        }
    }

    async function renderImages(promptText) {
        if (!lastImageContext || !promptText.trim()) return;
        const { provider, geminiKey, openaiKey, baseUrl, options, placeSlug } = lastImageContext;

        imagesContainer.innerHTML = '';
        const count = Math.max(1, Math.min(4, parseInt(imageCountInput.value, 10) || 1));
        const slots = Array.from({ length: count }, (_, i) => createImageSlot(i));

        let done = 0;
        const tasks = slots.map((slot, i) => async () => {
            slot.status.textContent = 'Generating…';
            try {
                const prompt = composeImagePrompt(promptText, options, i);
                const raw = provider === 'openai'
                    ? await generateImageViaOpenAI(openaiKey, baseUrl, prompt, options)
                    : await generateImageViaGemini(geminiKey, prompt, options);
                const blob = options.stripMetadata ? await stripImageMetadata(raw) : raw;
                attachImageActions(slot, blob, `Maps_${placeSlug}_${i + 1}.png`, options);
            } catch (err) {
                console.error('Image gen error:', err);
                slot.img.alt = 'Generation failed';
                slot.status.textContent = `Failed: ${err.message}`;
                slot.status.style.color = '#d93025';
            } finally {
                done++;
                loader.textContent = `Rendered ${done} of ${count} image${count === 1 ? '' : 's'}…`;
            }
        });

        loader.style.display = 'block';
        loader.textContent = `Rendering ${count} image${count === 1 ? '' : 's'}…`;
        await runWithLimit(IMAGE_CONCURRENCY, tasks);
        loader.style.display = 'none';
        updateProviderVisibility();
    }

    async function collectReferenceImages(options) {
        const refs = userReferenceImages.slice(0, MAX_REFERENCE_IMAGES);
        const remaining = MAX_REFERENCE_IMAGES - refs.length;
        if (options.usePlacePhotos && remaining > 0 && currentPlaceInfo && currentPlaceInfo.photos?.length) {
            try {
                refs.push(...await fetchPlacePhotos(currentPlaceInfo.photos, remaining));
            } catch (err) {
                console.warn('Could not fetch place photos:', err.message);
            }
        }
        return refs;
    }

    // ---------- Main generate handler ----------
    function buildOptions(provider, enableImages) {
        return {
            sentiment: sentimentSelect.value,
            personaStyle: personaStyleSelect.value,
            languageMode: languageModeSelect.value,
            reviewLength: lengthSelect.value,
            userVibe: userVibeInput.value.trim(),
            polish: polishLevelForValue(polishLevelInput.value),
            variantCount: variantCountSelect.value,
            avoidPhrases: avoidRepeatsInput.checked ? recentReviewTexts(3) : [],
            thinkingLevel: thinkingLevelSelect.value,
            includeThoughts: includeThoughtsInput.checked,
            textModel: geminiModelInput.value.trim(),
            enableImages,
            imageStyle: imageStyleSelect.value,
            aspectRatio: aspectRatioSelect.value,
            imageQuality: imageQualitySelect.value,
            imageModel: getSelectedImageModel(provider),
            varyImages: varyImagesInput.checked,
            usePlacePhotos: usePlacePhotosInput.checked,
            stripMetadata: stripMetadataInput.checked,
            autoDownloadImages: autoDownloadImagesInput.checked,
            uploadToImgbb: uploadToImgbbInput.checked,
            useWebGrounding: provider === 'gemini' && useWebGroundingInput.checked,
            useImageGrounding: provider === 'gemini' && useImageGroundingInput.checked,
            referenceImages: []
        };
    }

    generateBtn.addEventListener('click', async () => {
        const provider = providerSelect.value;
        const enableImages = enableImagesToggle.checked && provider !== 'copilot';

        if (!currentPlaceInfo) {
            showError('No place info. Map might not be loaded properly.');
            return;
        }

        const geminiKey = apiKeyInput.value.trim();
        const openaiKey = openaiApiKeyInput.value.trim();
        const copilotKey = copilotApiKeyInput.value.trim();
        if (provider === 'gemini' && !geminiKey) return showError('Please enter your Gemini API Key.');
        if (provider === 'openai' && !openaiKey) return showError('Please enter your API Key.');
        if (provider === 'copilot' && !copilotKey) return showError('Please enter your Copilot Proxy API Key.');

        const options = buildOptions(provider, enableImages);

        generateBtn.disabled = true;
        loader.style.display = 'block';
        resultsCard.classList.add('hidden');
        staleResultsBanner.classList.add('hidden');
        statusMessage.classList.add('hidden');
        imagesContainer.innerHTML = '';
        promptOutput.value = '';
        thoughtsOutput.value = '';
        thoughtsContainer.classList.add('hidden');

        try {
            let result;
            if (provider === 'gemini') {
                result = await generateReviewViaGemini(geminiKey, currentPlaceInfo, options);
            } else if (provider === 'copilot') {
                const temperature = parseFloat(copilotTemperatureInput.value);
                result = await generateReviewViaCopilot(
                    copilotKey,
                    copilotModelSelect.value || COPILOT_DEFAULT_MODEL,
                    isNaN(temperature) ? 0.2 : temperature,
                    currentPlaceInfo,
                    options
                );
            } else {
                const temperature = parseFloat(openaiTemperatureInput.value);
                result = await generateReviewViaOpenAI(
                    openaiKey,
                    getOpenaiBaseUrl(),
                    openaiModelSelect.value || OPENAI_DEFAULT_MODEL,
                    isNaN(temperature) ? 0.7 : temperature,
                    currentPlaceInfo,
                    options
                );
            }

            currentVariants = result.variants;
            resultsPlaceKey = placeKeyOf(currentPlaceInfo);
            renderVariants();
            reviewOutputContainer.style.display = 'block';
            resultsCard.classList.remove('hidden');

            if (result.thoughts) {
                thoughtsOutput.value = result.thoughts;
                thoughtsContainer.classList.remove('hidden');
            } else {
                thoughtsContainer.classList.add('hidden');
                if (options.includeThoughts) {
                    reviewMeta.textContent += ' · the model returned no reasoning';
                }
            }

            addToHistory({
                at: Date.now(),
                place: currentPlaceInfo.name,
                review: currentVariants[0].review,
                rating: currentVariants[0].rating
            });

            const copied = await copyToClipboard(currentVariants[0].review);
            if (!copied) {
                statusMessage.textContent = 'Review generated. Auto-copy is blocked by browser policy, use "Copy Review".';
                statusMessage.classList.remove('hidden');
            }

            const promptText = currentVariants[activeVariantIndex].imagePrompt;
            if (enableImages && promptText) {
                promptOutputContainer.style.display = 'block';
                options.referenceImages = await collectReferenceImages(options);
                lastImageContext = {
                    provider, geminiKey, openaiKey,
                    baseUrl: getOpenaiBaseUrl(),
                    options,
                    placeSlug: currentPlaceInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
                };
                await renderImages(promptText);
            } else {
                promptOutputContainer.style.display = 'none';
                lastImageContext = null;
            }
        } catch (error) {
            showError('Failed to generate: ' + error.message);
        } finally {
            generateBtn.disabled = false;
            loader.style.display = 'none';
            updateProviderVisibility();
        }
    });

    regenerateImagesBtn.addEventListener('click', async () => {
        if (!lastImageContext) {
            showError('Generate a review with images first.');
            return;
        }
        regenerateImagesBtn.disabled = true;
        try {
            // Re-read the toggles so changes made since the last run take effect,
            // and refresh references in case the file picker changed.
            Object.assign(lastImageContext.options, {
                imageStyle: imageStyleSelect.value,
                aspectRatio: aspectRatioSelect.value,
                imageQuality: imageQualitySelect.value,
                imageModel: getSelectedImageModel(lastImageContext.provider),
                varyImages: varyImagesInput.checked,
                stripMetadata: stripMetadataInput.checked,
                autoDownloadImages: autoDownloadImagesInput.checked,
                uploadToImgbb: uploadToImgbbInput.checked
            });
            lastImageContext.options.referenceImages = await collectReferenceImages(lastImageContext.options);
            await renderImages(promptOutput.value);
        } catch (error) {
            showError('Failed to re-render: ' + error.message);
        } finally {
            regenerateImagesBtn.disabled = false;
        }
    });

    autoPasteBtn.addEventListener('click', async () => {
        const reviewText = reviewOutput.value;
        if (!reviewText) return;

        const tab = await getPanelTab();
        if (!tab || !self.MapsUrl.isMapsUrl(tab.url)) {
            showError('Open the Google Maps tab before pasting.');
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => {
                const box = document.querySelector('textarea, div[role="textbox"]');
                if (!box) return 'no-box';
                box.focus();
                document.execCommand('insertText', false, text);
                return 'ok';
            },
            args: [reviewText]
        }).then(([injection]) => {
            if (injection && injection.result === 'no-box') {
                showError('Open the "Write a review" box on Maps first.');
            }
        }).catch(err => showError(`Could not paste: ${err.message}`));
    });

    if (copyReviewBtn) {
        copyReviewBtn.addEventListener('click', async () => {
            await copyToClipboard(reviewOutput.value);
            copyReviewBtn.textContent = 'Copied!';
            setTimeout(() => copyReviewBtn.textContent = 'Copy Review', 2000);
        });
    }
});
