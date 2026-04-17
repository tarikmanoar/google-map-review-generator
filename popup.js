document.addEventListener('DOMContentLoaded', async () => {
    const IMGBB_API_KEY = '6dd4a1b8639d6c5641d001cd417608a5';
    const DOWNLOADS_SUBDIR = 'Maps';
    const MAX_HISTORY_ITEMS = 200;

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
    const imageStyleSelect = document.getElementById('imageStyle');
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
    let isImageRemixRunning = false;

    // Persist UI states so if popup closes, inputs are not lost
    const restoreInputs = () => {
        chrome.storage.local.get([
            'savedSentiment',
            'savedPersonaStyle',
            'savedLanguageMode',
            'savedLength',
            'savedImageQuality',
            'savedImageStyle',
            'savedVibe'
        ], (result) => {
            if (result.savedSentiment) sentimentSelect.value = result.savedSentiment;
            if (result.savedPersonaStyle) personaStyleSelect.value = result.savedPersonaStyle;
            if (result.savedLanguageMode) languageModeSelect.value = result.savedLanguageMode;
            if (result.savedLength) lengthSelect.value = result.savedLength;
            if (result.savedImageQuality) imageQualitySelect.value = result.savedImageQuality;
            if (result.savedImageStyle) imageStyleSelect.value = result.savedImageStyle;
            if (result.savedVibe) userVibeInput.value = result.savedVibe;
        });
    };
    
    restoreInputs();

    // Save inputs automatically on change
    [
        sentimentSelect,
        personaStyleSelect,
        languageModeSelect,
        lengthSelect,
        imageQualitySelect,
        imageStyleSelect,
        userVibeInput
    ].forEach(el => {
        el.addEventListener('change', () => {
            chrome.storage.local.set({
                savedSentiment: sentimentSelect.value,
                savedPersonaStyle: personaStyleSelect.value,
                savedLanguageMode: languageModeSelect.value,
                savedLength: lengthSelect.value,
                savedImageQuality: imageQualitySelect.value,
                savedImageStyle: imageStyleSelect.value,
                savedVibe: userVibeInput.value
            });
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
        const imageStyle = imageStyleSelect.value;
        const userVibe = userVibeInput.value.trim();

        // Check Cache first
        const cacheKey = `${currentPlaceInfo.name}_${sentiment}_${personaStyle}_${languageMode}_${reviewLength}_${imageQuality}_${imageStyle}_${userVibe}`;
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
                imageStyle
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
                imageStyle,
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
        currentImageBlob = null;
        reviewOutput.value = result.review || "Review could not be generated.";
        
        let promptText = result.image_prompt || result.imagePrompt || "Could not generate image prompt.";
        promptOutput.value = promptText;

        if (imgbbOutput) {
            imgbbOutput.value = result.imgbb_url || '';
        }
        
        const imageUrl = result.generated_image_url || (promptText && promptText !== "Could not generate image prompt." ? buildPollinationsImageUrl(promptText) : '');
        if (imageUrl) {
            imagePreview.src = imageUrl;
            imagePreview.style.display = 'block';
        }

        resultsCard.classList.remove('hidden');
        generateBtn.disabled = false;
        loader.style.display = 'none';
    }

    function buildPollinationsImageUrl(promptText) {
        const styleMap = {
            photorealistic: 'photorealistic, real-life details, natural textures',
            cinematic: 'cinematic composition, dramatic lighting, wide dynamic range',
            'golden-hour': 'golden hour sunlight, warm tones, soft glow',
            'night-vibrant': 'vibrant night scene, neon accents, rich contrast'
        };

        const selectedStyle = imageStyleSelect?.value || 'photorealistic';
        const quality = imageQualitySelect?.value || 'hd';
        const seed = Date.now();
        const resolution = quality === 'uhd' ? { width: 1920, height: 1440 } : { width: 1280, height: 960 };
        const stylizedPrompt = `${promptText}. Style guidance: ${styleMap[selectedStyle] || styleMap.photorealistic}.`;
        const encodedStylizedPrompt = encodeURIComponent(stylizedPrompt);
        return `https://image.pollinations.ai/prompt/${encodedStylizedPrompt}?width=${resolution.width}&height=${resolution.height}&enhance=true&seed=${seed}&nologo=true`;
    }

    function buildPollinationsImageUrlWithOptions(promptText, options = {}) {
        const styleMap = {
            photorealistic: 'photorealistic, real-life details, natural textures',
            cinematic: 'cinematic composition, dramatic lighting, wide dynamic range',
            'golden-hour': 'golden hour sunlight, warm tones, soft glow',
            'night-vibrant': 'vibrant night scene, neon accents, rich contrast'
        };

        const selectedStyle = options.imageStyle || imageStyleSelect?.value || 'photorealistic';
        const quality = options.imageQuality || imageQualitySelect?.value || 'hd';
        const seed = options.forceSeed || Date.now();
        const resolution = quality === 'uhd' ? { width: 1920, height: 1440 } : { width: 1280, height: 960 };
        const stylizedPrompt = `${promptText}. Style guidance: ${styleMap[selectedStyle] || styleMap.photorealistic}.`;
        const encodedStylizedPrompt = encodeURIComponent(stylizedPrompt);

        return `https://image.pollinations.ai/prompt/${encodedStylizedPrompt}?width=${resolution.width}&height=${resolution.height}&enhance=true&seed=${seed}&nologo=true`;
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

    async function processImageAndAssets(result, placeName, options = {}) {
        const imagePrompt = result.image_prompt || result.imagePrompt;
        if (!imagePrompt) return result;

        const imageUrl = buildPollinationsImageUrlWithOptions(imagePrompt, options);
        const output = {
            ...result,
            generated_image_url: imageUrl,
            local_download_path: '',
            imgbb_url: ''
        };

        try {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('Unable to fetch generated image.');
            }

            const imageBlob = await imageResponse.blob();
            currentImageBlob = imageBlob;

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
        } catch (imageError) {
            console.error('Image processing failed:', imageError);
        }

        return output;
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
        }, (injectionResults) => {
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
                chrome.storage.local.get([
                    'savedSentiment',
                    'savedPersonaStyle',
                    'savedLanguageMode',
                    'savedLength',
                    'savedImageQuality',
                    'savedImageStyle',
                    'savedVibe'
                ], async (localData) => {
                    const sentiment = localData.savedSentiment || sentimentSelect.value;
                    const personaStyle = localData.savedPersonaStyle || personaStyleSelect.value;
                    const languageMode = localData.savedLanguageMode || languageModeSelect.value;
                    const length = localData.savedLength || lengthSelect.value;
                    const imageQuality = localData.savedImageQuality || imageQualitySelect.value;
                    const imageStyle = localData.savedImageStyle || imageStyleSelect.value;
                    const vibe = localData.savedVibe || userVibeInput.value.trim();
                    const cacheKey = `${data.name}_${sentiment}_${personaStyle}_${languageMode}_${length}_${imageQuality}_${imageStyle}_${vibe}`;
                    
                    const cachedContent = await chrome.storage.session?.get([cacheKey]);
                    if (cachedContent && cachedContent[cacheKey]) {
                        displayResults(cachedContent[cacheKey]);
                    }
                });
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