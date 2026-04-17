document.addEventListener('DOMContentLoaded', async () => {
    const IMGBB_API_KEY = '6dd4a1b8639d6c5641d001cd417608a5';
    const DOWNLOADS_SUBDIR = 'Maps';
    const MAX_HISTORY_ITEMS = 200;
    const PREFS_STORAGE_KEY = 'mapsReviewPrefs';

    const apiKeyInput = document.getElementById('apiKey');
    const generateBtn = document.getElementById('generateBtn');
    const statusMessage = document.getElementById('statusMessage');
    const placeCard = document.getElementById('placeCard');
    const placeNameEl = document.getElementById('placeName');
    const placeAddressEl = document.getElementById('placeAddress');
    const sentimentSelect = document.getElementById('sentiment');
    const personaStyleSelect = document.getElementById('personaStyle');
    const languageModeSelect = document.getElementById('languageMode');
    const lengthSelect = document.getElementById('reviewLength');
    const imageQualitySelect = document.getElementById('imageQuality');
    const aspectRatioSelect = document.getElementById('aspectRatio');
    const imageStyleSelect = document.getElementById('imageStyle');
    const responseModeSelect = document.getElementById('responseMode');
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
    const imgbbOutput = document.getElementById('imgbbOutput');
    const imagePreview = document.getElementById('imagePreview');
    const autoPasteBtn = document.getElementById('autoPasteBtn');
    const copyReviewBtn = document.getElementById('copyReviewBtn');
    const remixImageBtn = document.getElementById('remixImageBtn');
    const copyImgbbBtn = document.getElementById('copyImgbbBtn');
    const downloadImageBtn = document.getElementById('downloadImageBtn');
    const historyList = document.getElementById('historyList');

    let currentPlaceInfo = null;
    let currentImageBlob = null;
    let currentImageObjectUrl = null;
    let isImageRemixRunning = false;

    function loadPreferences() {
        try {
            const stored = localStorage.getItem(PREFS_STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (err) {
            console.error('Failed loading preferences from localStorage:', err);
        }

        return {
            sentiment: 'Positive',
            personaStyle: 'Local Guide',
            languageMode: 'auto',
            reviewLength: 'medium',
            imageQuality: '1K',
            aspectRatio: '1:1',
            imageStyle: 'photorealistic',
            responseMode: 'text-image',
            thinkingLevel: 'minimal',
            includeThoughts: false,
            useWebGrounding: false,
            useImageGrounding: false,
            vibe: ''
        };
    }

    function savePreferences() {
        const prefs = {
            sentiment: sentimentSelect.value,
            personaStyle: personaStyleSelect.value,
            languageMode: languageModeSelect.value,
            reviewLength: lengthSelect.value,
            imageQuality: imageQualitySelect.value,
            aspectRatio: aspectRatioSelect.value,
            imageStyle: imageStyleSelect.value,
            responseMode: responseModeSelect.value,
            thinkingLevel: thinkingLevelSelect.value,
            includeThoughts: includeThoughtsInput.checked,
            useWebGrounding: useWebGroundingInput.checked,
            useImageGrounding: useImageGroundingInput.checked,
            vibe: userVibeInput.value
        };

        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }

    function applyPreferences() {
        const prefs = loadPreferences();
        sentimentSelect.value = prefs.sentiment || sentimentSelect.value;
        personaStyleSelect.value = prefs.personaStyle || personaStyleSelect.value;
        languageModeSelect.value = prefs.languageMode || languageModeSelect.value;
        lengthSelect.value = prefs.reviewLength || lengthSelect.value;
        imageQualitySelect.value = prefs.imageQuality || imageQualitySelect.value;
        aspectRatioSelect.value = prefs.aspectRatio || aspectRatioSelect.value;
        imageStyleSelect.value = prefs.imageStyle || imageStyleSelect.value;
        responseModeSelect.value = prefs.responseMode || responseModeSelect.value;
        thinkingLevelSelect.value = prefs.thinkingLevel || thinkingLevelSelect.value;
        includeThoughtsInput.checked = Boolean(prefs.includeThoughts);
        useWebGroundingInput.checked = Boolean(prefs.useWebGrounding);
        useImageGroundingInput.checked = Boolean(prefs.useImageGrounding);
        userVibeInput.value = prefs.vibe || '';

        savePreferences();
    }

    async function migrateLegacyPreferences() {
        if (localStorage.getItem(PREFS_STORAGE_KEY)) {
            return;
        }

        const legacyPrefs = await new Promise((resolve) => {
            chrome.storage.local.get([
                'savedSentiment',
                'savedPersonaStyle',
                'savedLanguageMode',
                'savedLength',
                'savedImageQuality',
                'savedImageStyle',
                'savedVibe'
            ], resolve);
        });

        const migratedPrefs = {
            sentiment: legacyPrefs.savedSentiment || 'Positive',
            personaStyle: legacyPrefs.savedPersonaStyle || 'Local Guide',
            languageMode: legacyPrefs.savedLanguageMode || 'auto',
            reviewLength: legacyPrefs.savedLength || 'medium',
            imageQuality: '1K',
            aspectRatio: '1:1',
            imageStyle: legacyPrefs.savedImageStyle || 'photorealistic',
            responseMode: 'text-image',
            thinkingLevel: 'minimal',
            includeThoughts: false,
            useWebGrounding: false,
            useImageGrounding: false,
            vibe: legacyPrefs.savedVibe || ''
        };

        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(migratedPrefs));
    }

    await migrateLegacyPreferences();
    applyPreferences();

    // Save inputs automatically on change
    [
        sentimentSelect,
        personaStyleSelect,
        languageModeSelect,
        lengthSelect,
        imageQualitySelect,
        aspectRatioSelect,
        imageStyleSelect,
        responseModeSelect,
        thinkingLevelSelect,
        includeThoughtsInput,
        useWebGroundingInput,
        useImageGroundingInput,
        referenceImagesInput,
        userVibeInput
    ].forEach(el => {
        el.addEventListener('change', () => {
            savePreferences();
        });
    });

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    // Save API key on change
    apiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ geminiApiKey: e.target.value });
    });

    // Check if we are on Google Maps and extract data
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.url.includes("google.com/maps")) {
            extractMapData(currentTab.id);
        } else {
            showError("Please open a location on Google Maps first.");
            generateBtn.disabled = true;
        }
    });

    generateBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showError("Please enter your Gemini API Key.");
            return;
        }
        if (!currentPlaceInfo) {
            showError("No place information found. Ensure a place is selected on the map.");
            return;
        }

        const sentiment = sentimentSelect.value;
        const personaStyle = personaStyleSelect.value;
        const languageMode = languageModeSelect.value;
        const reviewLength = lengthSelect.value;
        const imageQuality = imageQualitySelect.value;
        const aspectRatio = aspectRatioSelect.value;
        const imageStyle = imageStyleSelect.value;
        const responseMode = responseModeSelect.value;
        const thinkingLevel = thinkingLevelSelect.value;
        const includeThoughts = includeThoughtsInput.checked;
        const useWebGrounding = useWebGroundingInput.checked;
        const useImageGrounding = useImageGroundingInput.checked;
        const userVibe = userVibeInput.value.trim();
        const referenceImages = Array.from(referenceImagesInput.files || []).slice(0, 14);

        // Check Cache first
        const cacheKey = `${currentPlaceInfo.name}_${sentiment}_${personaStyle}_${languageMode}_${reviewLength}_${imageQuality}_${aspectRatio}_${imageStyle}_${responseMode}_${thinkingLevel}_${includeThoughts}_${useWebGrounding}_${useImageGrounding}_${userVibe}`;
        const cachedContent = await chrome.storage.session?.get([cacheKey]);

        // UI Loading state
        generateBtn.disabled = true;
        loader.style.display = 'block';
        resultsCard.classList.add('hidden');
        statusMessage.classList.add('hidden');
        imagePreview.style.display = 'none';
        autoPasteBtn.style.display = 'block';
        autoPasteBtn.textContent = '✨ Auto-Paste to Maps';

        if (cachedContent && cachedContent[cacheKey]) {
            displayResults(cachedContent[cacheKey]);
            generateBtn.disabled = false;
            loader.style.display = 'none';
            return;
        }

        try {
            const result = await callGeminiAPI(apiKey, currentPlaceInfo, {
                sentiment,
                personaStyle,
                languageMode,
                reviewLength,
                userVibe
            });

            const enrichedResult = await processImageAndAssets(result, currentPlaceInfo.name, {
                imageQuality,
                aspectRatio,
                imageStyle
            }, {
                responseMode,
                thinkingLevel,
                includeThoughts,
                useWebGrounding,
                useImageGrounding,
                referenceImages
            });

            if (chrome.storage.session) {
                chrome.storage.session.set({ [cacheKey]: enrichedResult });
            }

            await saveReviewHistory({
                place: currentPlaceInfo.name,
                address: currentPlaceInfo.address,
                sentiment,
                personaStyle,
                languageMode,
                reviewLength,
                imageQuality,
                aspectRatio,
                imageStyle,
                responseMode,
                thinkingLevel,
                includeThoughts,
                useWebGrounding,
                useImageGrounding,
                userVibe,
                review: enrichedResult.review,
                imagePrompt: enrichedResult.image_prompt || enrichedResult.imagePrompt || '',
                imageUrl: enrichedResult.generated_image_url || '',
                imgbbUrl: enrichedResult.imgbb_url || '',
                timestamp: new Date().toISOString()
            });

            displayResults(enrichedResult);
        } catch (error) {
            showError("Failed to generate: " + error.message);
        } finally {
            generateBtn.disabled = false;
            loader.style.display = 'none';
        }
    });

    autoPasteBtn.addEventListener('click', () => {
        const reviewText = reviewOutput.value;
        const sentiment = sentimentSelect.value;
        if (!reviewText) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                function: pasteReviewToMaps,
                args: [reviewText, sentiment]
            }, (results) => {
                if (results && results[0] && results[0].result) {
                    autoPasteBtn.textContent = '✅ Pasted successfully!';
                } else {
                    autoPasteBtn.textContent = '⚠️ Open the Maps review box first';
                }
                setTimeout(() => { autoPasteBtn.textContent = '✨ Auto-Paste to Maps'; }, 3000);
            });
        });
    });

    if (copyReviewBtn) {
        copyReviewBtn.addEventListener('click', async () => {
            const text = reviewOutput.value.trim();
            if (!text) return;
            const copied = await copyToClipboard(text);
            copyReviewBtn.textContent = copied ? 'Copied Review' : 'Copy Failed';
            setTimeout(() => { copyReviewBtn.textContent = 'Copy Review'; }, 2000);
        });
    }

    if (copyImgbbBtn) {
        copyImgbbBtn.addEventListener('click', async () => {
            const text = imgbbOutput.value.trim();
            if (!text) return;
            const copied = await copyToClipboard(text);
            copyImgbbBtn.textContent = copied ? 'Copied URL' : 'Copy Failed';
            setTimeout(() => { copyImgbbBtn.textContent = 'Copy ImgBB URL'; }, 2000);
        });
    }

    if (downloadImageBtn) {
        downloadImageBtn.addEventListener('click', async () => {
            try {
                if (currentImageBlob) {
                    await downloadBlobToMapsFolder(currentImageBlob, currentPlaceInfo?.name || 'map-place');
                    downloadImageBtn.textContent = 'Downloaded';
                } else {
                    downloadImageBtn.textContent = 'No image yet';
                }
            } catch (err) {
                downloadImageBtn.textContent = 'Download failed';
            }
            setTimeout(() => { downloadImageBtn.textContent = 'Download Current Image'; }, 2000);
        });
    }

    if (remixImageBtn) {
        remixImageBtn.addEventListener('click', async () => {
            if (isImageRemixRunning) return;
            const imagePrompt = promptOutput.value.trim();
            if (!imagePrompt || imagePrompt === 'Could not generate image prompt.') return;

            isImageRemixRunning = true;
            remixImageBtn.disabled = true;
            remixImageBtn.textContent = 'Remixing...';
            loader.style.display = 'block';

            try {
                const result = {
                    review: reviewOutput.value,
                    image_prompt: imagePrompt
                };
                const remixedResult = await processImageAndAssets(result, currentPlaceInfo?.name || 'map-place', {
                    imageQuality: imageQualitySelect.value,
                    imageStyle: imageStyleSelect.value,
                    forceSeed: Date.now()
                });
                displayResults(remixedResult);
            } catch (err) {
                showError('Failed to remix image.');
            } finally {
                isImageRemixRunning = false;
                remixImageBtn.disabled = false;
                remixImageBtn.textContent = 'Remix Image Variation';
                loader.style.display = 'none';
            }
        });
    }

    // Injected function to paste into Google Maps
    function pasteReviewToMaps(text, sentiment) {
        try {
            // Find the review textarea (Maps uses an iframe for reviews or a direct textarea)
            const mapIframe = document.querySelector('iframe.goog-reviews-write-widget') || document.querySelector('iframe');
            const doc = mapIframe ? mapIframe.contentDocument : document;
            
            const textBox = doc.querySelector('textarea, [contenteditable="true"], .VfPpkd-fmcmS-wGMbrd');
            
            if (textBox) {
                textBox.focus();
                
                // Maps uses contenteditable divs sometimes or true textareas
                if (textBox.tagName.toLowerCase() === 'textarea') {
                    textBox.value = text;
                } else {
                    textBox.innerText = text;
                }
                
                // Trigger React/Maps internal state events to realize the text was entered
                textBox.dispatchEvent(new Event('input', { bubbles: true }));
                textBox.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Try to click the star rating if possible
                let starIndex = 4; // default 5 star (index 4)
                if (sentiment === 'Average') starIndex = 2; // 3 star
                if (sentiment === 'Negative') starIndex = 0; // 1 star
                
                const stars = doc.querySelectorAll('.hNK1nd, [role="radio"]'); // Common class/roles for star rating
                if (stars && stars.length >= 5) {
                    stars[starIndex].click();
                }

                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function displayResults(result) {
        if (currentImageObjectUrl) {
            URL.revokeObjectURL(currentImageObjectUrl);
            currentImageObjectUrl = null;
        }

        currentImageBlob = null;
        reviewOutput.value = result.review || "Review could not be generated.";
        
        let promptText = result.image_prompt || result.imagePrompt || "Could not generate image prompt.";
        promptOutput.value = promptText;

        if (imgbbOutput) {
            imgbbOutput.value = result.imgbb_url || '';
        }
        
        const imageUrl = result.generated_image_url || '';
        if (imageUrl) {
            imagePreview.src = imageUrl;
            imagePreview.style.display = 'block';
        }

        resultsCard.classList.remove('hidden');
        generateBtn.disabled = false;
        loader.style.display = 'none';
    }

    async function processImageAndAssets(result, placeName, imageOptions = {}, generationOptions = {}) {
        const imagePrompt = result.image_prompt || result.imagePrompt;
        if (!imagePrompt) return result;

        const imageResponse = await callGeminiImageAPI(imagePrompt, imageOptions, generationOptions);
        const generatedImage = extractGeneratedImage(imageResponse);
        if (!generatedImage) {
            throw new Error('No image returned by Gemini image model.');
        }

        const imageBlob = base64ToBlob(generatedImage.base64, generatedImage.mimeType);
        currentImageBlob = imageBlob;
        setImagePreviewFromBlob(imageBlob);

        const output = {
            ...result,
            generated_image_url: generatedImage.dataUrl,
            generated_image_text: imageResponse?.candidates?.[0]?.content?.parts?.map(part => part.text).filter(Boolean).join('\n') || '',
            local_download_path: '',
            imgbb_url: ''
        };

        try {
            const downloadResult = await downloadBlobToMapsFolder(imageBlob, placeName);
            output.local_download_path = `Downloads/${downloadResult.filename}`;
        } catch (downloadError) {
            console.error('Failed saving image to Downloads/Maps:', downloadError);
        }

        try {
            const base64Image = await blobToBase64(imageBlob);
            output.imgbb_url = await uploadImageToImgBB(base64Image);
            console.log('Successfully uploaded image to ImgBB:', output.imgbb_url);
        } catch (uploadError) {
            console.error('Failed to upload image to ImgBB:', uploadError);
        }

        return output;
    }

    async function callGeminiImageAPI(promptText, imageOptions, generationOptions) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKeyInput.value.trim()}`;
        const contentsParts = [];
        const referenceImages = Array.isArray(generationOptions.referenceImages) ? generationOptions.referenceImages : [];

        for (const file of referenceImages) {
            const base64Image = await fileToBase64(file);
            contentsParts.push({
                inlineData: {
                    mimeType: file.type || 'image/png',
                    data: base64Image
                }
            });
        }

        contentsParts.push({ text: buildGeminiImagePrompt(promptText, imageOptions, generationOptions) });

        const payload = {
            contents: [{ parts: contentsParts }],
            generationConfig: {
                responseModalities: generationOptions.responseMode === 'image-only' ? ['Image'] : ['Text', 'Image'],
                imageConfig: {
                    aspectRatio: imageOptions.aspectRatio || '1:1',
                    imageSize: imageOptions.imageQuality || '1K'
                }
            }
        };

        // thinkingConfig is not natively supported as a field in gemini-3.1-flash-image-preview
        // removed to prevent invalid JSON payload errors.

        if (generationOptions.useWebGrounding || generationOptions.useImageGrounding) {
            const searchTypes = {};
            if (generationOptions.useWebGrounding) searchTypes.webSearch = {};
            if (generationOptions.useImageGrounding) searchTypes.imageSearch = {};

            payload.tools = [{ googleSearch: { searchTypes } }];
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Image generation request failed');
        }

        return response.json();
    }

    function buildGeminiImagePrompt(promptText, imageOptions, generationOptions) {
        const styleMap = {
            photorealistic: 'photorealistic, real-life details, natural textures',
            cinematic: 'cinematic composition, dramatic lighting, wide dynamic range',
            'golden-hour': 'golden hour sunlight, warm tones, soft glow',
            'night-vibrant': 'vibrant night scene, neon accents, rich contrast'
        };

        const selectedStyle = imageOptions.imageStyle || 'photorealistic';
        const styleHint = styleMap[selectedStyle] || styleMap.photorealistic;
        const aspectHint = imageOptions.aspectRatio ? `Aspect ratio: ${imageOptions.aspectRatio}.` : '';
        const sizeHint = imageOptions.imageQuality ? `Output size: ${imageOptions.imageQuality}.` : '';
        const searchHint = generationOptions.useWebGrounding ? 'Use Google Search grounding for factual environment details.' : '';
        const imageSearchHint = generationOptions.useImageGrounding ? 'Use image search grounding for visual references, but avoid people sourced from search.' : '';
        const referenceHint = Array.isArray(generationOptions.referenceImages) && generationOptions.referenceImages.length > 0
            ? `Use ${generationOptions.referenceImages.length} reference image(s) for composition and fidelity.`
            : '';

        return `${promptText}. Style guidance: ${styleHint}. ${aspectHint} ${sizeHint} ${searchHint} ${imageSearchHint} ${referenceHint}`.trim();
    }

    function extractGeneratedImage(imageResponse) {
        const parts = imageResponse?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            const inlineData = part.inlineData || part.inline_data;
            if (inlineData?.data) {
                const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
                return {
                    base64: inlineData.data,
                    mimeType,
                    dataUrl: `data:${mimeType};base64,${inlineData.data}`
                };
            }
        }

        return null;
    }

    function base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i += 1) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }

        return new Blob(byteArrays, { type: mimeType || 'image/png' });
    }

    function setImagePreviewFromBlob(blob) {
        if (currentImageObjectUrl) {
            URL.revokeObjectURL(currentImageObjectUrl);
        }

        currentImageObjectUrl = URL.createObjectURL(blob);
        imagePreview.src = currentImageObjectUrl;
        imagePreview.style.display = 'block';
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                if (typeof result !== 'string') {
                    reject(new Error('Failed to read reference image.'));
                    return;
                }
                resolve(result.split(',')[1]);
            };
            reader.onerror = () => reject(new Error('Failed to read reference image.'));
            reader.readAsDataURL(file);
        });
    }

    function sanitizeFileName(name) {
        return (name || 'map-place')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120)
            .replace(/ /g, '_') || 'map-place';
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                if (typeof dataUrl !== 'string') {
                    reject(new Error('Could not convert image to base64.'));
                    return;
                }
                resolve(dataUrl.split(',')[1]);
            };
            reader.onerror = () => reject(new Error('Failed to read image blob.'));
            reader.readAsDataURL(blob);
        });
    }

    function downloadBlobToMapsFolder(blob, placeName) {
        return new Promise((resolve, reject) => {
            const safeName = sanitizeFileName(placeName);
            const filename = `${DOWNLOADS_SUBDIR}/${safeName}.png`;
            const objectUrl = URL.createObjectURL(blob);

            chrome.downloads.download({
                url: objectUrl,
                filename,
                conflictAction: 'uniquify',
                saveAs: false
            }, (downloadId) => {
                URL.revokeObjectURL(objectUrl);

                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                resolve({ downloadId, filename });
            });
        });
    }

    async function uploadImageToImgBB(base64Image) {
        const formData = new FormData();
        formData.append('image', base64Image);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Unknown ImgBB upload error');
        }

        return result.data.url;
    }

    async function saveReviewHistory(entry) {
        try {
            const existing = await chrome.storage.local.get(['reviewHistory']);
            const history = Array.isArray(existing.reviewHistory) ? existing.reviewHistory : [];
            history.unshift(entry);

            const cappedHistory = history.slice(0, MAX_HISTORY_ITEMS);
            await chrome.storage.local.set({ reviewHistory: cappedHistory });
            renderRecentHistory(cappedHistory.slice(0, 8));
        } catch (err) {
            console.error('Failed saving review history:', err);
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Clipboard write failed:', err);
            return false;
        }
    }

    function renderRecentHistory(items) {
        if (!historyList) return;
        if (!Array.isArray(items) || items.length === 0) {
            historyList.textContent = 'No generations yet.';
            return;
        }

        historyList.innerHTML = items.map((item, index) => {
            const place = escapeHtml(item.place || 'Unknown place');
            const sentiment = escapeHtml(item.sentiment || 'Unknown');
            const time = new Date(item.timestamp).toLocaleString();
            return `<div style="padding:8px 0;border-bottom:1px solid #eceff1;"><strong>${index + 1}. ${place}</strong><br><span>${sentiment} · ${escapeHtml(time)}</span></div>`;
        }).join('');
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function showError(msg) {
        statusMessage.textContent = msg;
        statusMessage.classList.remove('hidden');
    }

    // This function executes inside the Google Maps tab
    function scrapePlaceDOM() {
        try {
            // Finding the place name (usually the primary h1 element in the sidebar)
            const nameEl = document.querySelector('h1.fontHeadlineLarge') || document.querySelector('h1');
            const name = nameEl ? nameEl.innerText : null;

            if (!name) return { error: "Could not find place name. Make sure a specific place panel is open." };

            // Attempt to find address (usually contained in buttons with specific aria-labels)
            let address = "Address not found";
            const addressButtons = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('aria-label')?.includes('Address:'));
            if (addressButtons.length > 0) {
                address = addressButtons[0].getAttribute('aria-label').replace('Address: ', '').trim();
            }

            // Attempt to extract Rating and Category/Price
            let rating = "";
            const ratingEl = document.querySelector('span[aria-label*="stars"]');
            if (ratingEl) rating = ratingEl.getAttribute('aria-label');

            let category = "";
            const categoryEl = document.querySelector('.DkEaL'); // Sometimes contains category/price like "Restaurant · $$"
            if (categoryEl) category = categoryEl.innerText;

            // Attempt to fetch existing reviews for context
            const reviewEls = document.querySelectorAll('.wiI7pd');
            const reviews = Array.from(reviewEls).map(el => el.innerText).slice(0, 8); // Get up to 8 reviews

            return { name, address, rating, category, reviews };
        } catch (e) {
            return { error: e.toString() };
        }
    }

    function extractMapData(tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: scrapePlaceDOM
        }, async (injectionResults) => {
            if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                showError("Failed to read map data. Refresh the page and try again.");
                return;
            }

            const data = injectionResults[0].result;

            if (data.error) {
                showError(data.error);
            } else {
                currentPlaceInfo = data;
                placeNameEl.textContent = data.name;
                placeAddressEl.textContent = data.address;
                placeCard.classList.remove('hidden');

                // Check cache immediately upon place detection so results restore automatically
                const prefs = loadPreferences();
                const sentiment = prefs.sentiment || sentimentSelect.value;
                const personaStyle = prefs.personaStyle || personaStyleSelect.value;
                const languageMode = prefs.languageMode || languageModeSelect.value;
                const length = prefs.reviewLength || lengthSelect.value;
                const imageQuality = prefs.imageQuality || imageQualitySelect.value;
                const aspectRatio = prefs.aspectRatio || aspectRatioSelect.value;
                const imageStyle = prefs.imageStyle || imageStyleSelect.value;
                const responseMode = prefs.responseMode || responseModeSelect.value;
                const thinkingLevel = prefs.thinkingLevel || thinkingLevelSelect.value;
                const includeThoughts = Boolean(prefs.includeThoughts);
                const useWebGrounding = Boolean(prefs.useWebGrounding);
                const useImageGrounding = Boolean(prefs.useImageGrounding);
                const vibe = prefs.vibe || userVibeInput.value.trim();
                const cacheKey = `${data.name}_${sentiment}_${personaStyle}_${languageMode}_${length}_${imageQuality}_${aspectRatio}_${imageStyle}_${responseMode}_${thinkingLevel}_${includeThoughts}_${useWebGrounding}_${useImageGrounding}_${vibe}`;
                    
                const cachedContent = await chrome.storage.session?.get([cacheKey]);
                if (cachedContent && cachedContent[cacheKey]) {
                    displayResults(cachedContent[cacheKey]);
                }
            }
        });
    }

    async function callGeminiAPI(apiKey, placeInfo, options) {
        const {
            sentiment,
            personaStyle,
            languageMode,
            reviewLength,
            userVibe
        } = options;
        const recentReviews = Array.isArray(placeInfo.reviews) ? placeInfo.reviews : [];

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        let systemPrompt = `You are an expert ${personaStyle} who has personally visited and explored this place. You pay close attention to both the good and bad aspects based on the place's category and name. Your writing tone is highly natural, genuine, and relatable-written exactly like a real human leaving a Google Maps review. You avoid corporate or overly robotic phrasing.`;
        
        let lengthInstruction = "";
        if (reviewLength === "short") lengthInstruction = "Keep it brief and concise, around 1-2 sentences.";
        else if (reviewLength === "medium") lengthInstruction = "Write a standard paragraph, around 3-4 sentences.";
        else lengthInstruction = "Write a comprehensive and detailed review covering multiple aspects, around 5-7 sentences.";

        const vibeInstruction = userVibe ? `\nMake sure to explicitly weave this specific user sentiment/experience into the review naturally: "${userVibe}"` : "";

        if (languageMode === 'en') {
            systemPrompt += `\nWrite the review in English. Keep the image prompt in English.`;
        } else if (languageMode === 'local') {
            systemPrompt += `\nWrite the review in the dominant local language implied by the address. Keep the image prompt in English.`;
        } else {
            systemPrompt += `\nIf the address implies a non-English speaking country, write the review in the dominant local language of that region, but keep the image prompt in English.`;
        }

        const userPrompt = `
        Place Name: ${placeInfo.name}
        Address: ${placeInfo.address}
        Place Category & Pricing: ${placeInfo.category || 'Not specified'}
        Current Rating: ${placeInfo.rating || 'Not specified'}
        Recent Reviews Context: ${recentReviews.length > 0 ? recentReviews.join(' || ') : 'No recent reviews available.'}
        
        Task 1: Write an authentic, human-like ${sentiment} review for this place. Incorporate the vibe of the exact place category, its name, and mention specific details or environment aspects gleaned from the "Recent Reviews Context". ${lengthInstruction} ${vibeInstruction} Make sure it sounds like a real customer's lived experience.
        Task 2: Write a highly descriptive image generation prompt. It must visually match the specific environment, atmosphere, and characteristic details mentioned in the real reviews and the place name so the generated image realistically represents this specific place.

        Return the response strictly as a JSON object with keys "review" and "image_prompt".
        `;

        const payload = {
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        review: { type: "STRING" },
                        image_prompt: { type: "STRING" }
                    },
                    required: ["review", "image_prompt"]
                }
            }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "API request failed");
        }

        const data = await response.json();
        const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
            throw new Error('Model returned an empty response.');
        }

        return safeJsonParse(jsonText);
    }

    function safeJsonParse(text) {
        try {
            return JSON.parse(text);
        } catch (err) {
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) {
                throw new Error('Could not parse model JSON response.');
            }
            return JSON.parse(match[0]);
        }
    }

    chrome.storage.local.get(['reviewHistory'], (result) => {
        const history = Array.isArray(result.reviewHistory) ? result.reviewHistory : [];
        renderRecentHistory(history.slice(0, 8));
    });
});