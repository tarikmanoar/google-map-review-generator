document.addEventListener('DOMContentLoaded', async () => {
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

    // Accordion Logic
    const accordions = document.querySelectorAll(".accordion");
    accordions.forEach(acc => {
        acc.addEventListener("click", function() {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            if (panel.style.display === "block") {
                panel.style.display = "none";
            } else {
                panel.style.display = "block";
            }
        });
    });

    function loadPreferences() {
        try {
            const stored = localStorage.getItem(PREFS_STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (err) {}
        return {
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
            vibe: ''
        };
    }

    function savePreferences() {
        const prefs = {
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
        
        updateImageSettingsVisibility();
    }

    function updateImageSettingsVisibility() {
        if (enableImagesToggle.checked) {
            imageSettingsAccordion.style.display = 'flex';
        } else {
            imageSettingsAccordion.style.display = 'none';
            imageSettingsPanel.style.display = 'none';
            imageSettingsAccordion.classList.remove('active');
        }
    }

    applyPreferences();

    [
        sentimentSelect, personaStyleSelect, languageModeSelect, lengthSelect,
        imageCountInput, imageQualitySelect, aspectRatioSelect, imageStyleSelect,
        enableImagesToggle, thinkingLevelSelect, includeThoughtsInput,
        useWebGroundingInput, useImageGroundingInput, userVibeInput
    ].forEach(el => {
        el.addEventListener('change', () => {
            if (el === enableImagesToggle) {
                updateImageSettingsVisibility();
            }
            savePreferences();
        });
    });

    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
    });

    apiKeyInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ geminiApiKey: e.target.value });
    });

    function showError(msg) {
        statusMessage.textContent = msg;
        statusMessage.classList.remove('hidden');
    }

    function scrapePlaceDOM() {
        try {
            // Remove dependency on obfuscated classes that change quickly or match list views
            // Find all h1s and choose the one that is actually visible and NOT a generic search header like "Results"
            const h1Elements = Array.from(document.querySelectorAll('h1'));
            const validH1s = h1Elements.filter(el => {
                if (el.offsetParent === null) return false; // Hidden
                const text = el.innerText.trim();
                if (!text || text === 'Results' || text === 'Top results' || text === 'Search results') return false;
                return true;
            });

            // The main place title usually has large font classes like fontHeadlineLarge or DUwDvf
            const nameEl = validH1s.find(el => el.classList.contains('fontHeadlineLarge') || el.classList.contains('DUwDvf')) || validH1s[0];
            const name = nameEl ? nameEl.innerText.trim() : null;

            if (!name) return { error: "No specific place opened. Please click on a single place from the results." };

            // Find the container that holds this h1 to scope our search (avoids pulling the address of the first item in the list)
            // A place detail pane usually has role="main" or contains the place name
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
            // Look for buttons containing 'Address:' in aria-label or tooltip "Copy address"
            const addressBtn = detailPane.querySelector('button[data-tooltip="Copy address"], button[data-item-id="address"]') || 
                Array.from(detailPane.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Address:'));
            
            if (addressBtn && addressBtn.getAttribute('aria-label')) {
                address = addressBtn.getAttribute('aria-label').replace('Address: ', '').trim();
            } else {
                // Secondary check for address often below place name
                const subt = detailPane.querySelector('.fontBodyMedium.mgr77e, .Io6YTe, .W4Eejd');
                if (subt && subt.innerText.length > 2) {
                    address = subt.innerText.trim();
                }
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
            if (!currentTab || !currentTab.url || !currentTab.url.includes("google.com/maps")) {
                showError("Please open a location on Google Maps first.");
                generateBtn.disabled = true;
                return;
            }
            chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                function: scrapePlaceDOM
            }, (injectionResults) => {
                if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                    showError("Failed to read map data. Try refreshing the page.");
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

    // Call on load and also add a manual refresh if needed
    extractMapData();

    refreshPlaceBtn.addEventListener('click', () => {
        statusMessage.classList.add('hidden');
        placeNameEl.textContent = 'Loading...';
        placeAddressEl.textContent = '';
        extractMapData();
    });

    async function callGeminiAPI(apiKey, placeInfo, options) {
        const { sentiment, personaStyle, languageMode, reviewLength, userVibe, enableImages } = options;
        const recentReviews = Array.isArray(placeInfo.reviews) ? placeInfo.reviews : [];

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        let systemPrompt = `You are an expert ${personaStyle} who has personally visited and explored this place. You pay close attention to both the good and bad aspects based on the place's category and name. Your writing tone is highly natural, genuine, and relatable-written exactly like a real human leaving a Google Maps review.`;
        
        let lengthInstruction = "";
        if (reviewLength === "short") lengthInstruction = "Keep it brief and concise, around 1-2 sentences.";
        else if (reviewLength === "medium") lengthInstruction = "Write a standard paragraph, around 3-4 sentences.";
        else lengthInstruction = "Write a comprehensive and detailed review, around 5-7 sentences.";

        const vibeInstruction = userVibe ? `\nMake sure to explicitly weave this vibe into the review naturally: "${userVibe}"` : "";

        if (languageMode === 'en') systemPrompt += `\nWrite the review in English. Keep the image prompt in English.`;
        else if (languageMode === 'local') systemPrompt += `\nWrite the review in the dominant local language implied by the address. Keep the image prompt in English.`;
        else systemPrompt += `\nIf the address implies a non-English speaking country, write the review in the dominant local language of that region, but keep the image prompt in English.`;

        let userPrompt = `
        Place Name: ${placeInfo.name}
        Address: ${placeInfo.address}
        Place Category: ${placeInfo.category || 'Not specified'}
        Rating: ${placeInfo.rating || 'Not specified'}
        Recent Reviews Context: ${recentReviews.join(' || ')}
        
        Task 1: Write an authentic, human-like ${sentiment} review. ${lengthInstruction} ${vibeInstruction}`;

        if (enableImages) {
            userPrompt += `\n        Task 2: Write a descriptive image generation prompt matching the atmosphere described.\n
        Return strictly as a JSON object with keys "review" and "image_prompt".`;
        } else {
            userPrompt += `\n
        Return strictly as a JSON object with the key "review".`;
        }

        const payload = {
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json"
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
        
        try {
            return JSON.parse(jsonText);
        } catch (e) {
            const match = jsonText.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            throw new Error('Could not parse model JSON response.');
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for contexts where Clipboard API is blocked (e.g. lost user activation).
            try {
                const tempArea = document.createElement('textarea');
                tempArea.value = text;
                tempArea.setAttribute('readonly', '');
                tempArea.style.position = 'fixed';
                tempArea.style.top = '-9999px';
                tempArea.style.left = '-9999px';
                document.body.appendChild(tempArea);
                tempArea.focus();
                tempArea.select();

                const copied = document.execCommand('copy');
                document.body.removeChild(tempArea);
                return copied;
            } catch (_fallbackErr) {
                return false;
            }
        }
    }
    
    async function callGeminiImageAPI(apiKey, promptText, options) {
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
            throw new Error(errData.error?.message || 'Image generation request failed');
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            const inlineData = part.inlineData || part.inline_data;
            if (inlineData?.data) {
                const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
                const base64 = inlineData.data;
                const byteCharacters = atob(base64);
                const byteArrays = [];
                for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                    const slice = byteCharacters.slice(offset, offset + 512);
                    const byteNumbers = new Array(slice.length);
                    for (let i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }
                    byteArrays.push(new Uint8Array(byteNumbers));
                }
                return new Blob(byteArrays, { type: mimeType });
            }
        }
        throw new Error('No image context returned from Gemini model.');
    }

    generateBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showError("Please enter your Gemini API Key.");
            return;
        }
        if (!currentPlaceInfo) {
            showError("No place info. Map might not be loaded properly.");
            return;
        }

        const enableImages = enableImagesToggle.checked;
        const imgCount = parseInt(imageCountInput.value, 10) || 1;
        
        generateBtn.disabled = true;
        loader.style.display = 'block';
        resultsCard.classList.add('hidden');
        statusMessage.classList.add('hidden');
        imagesContainer.innerHTML = '';
        
        try {
            const result = await callGeminiAPI(apiKey, currentPlaceInfo, {
                sentiment: sentimentSelect.value,
                personaStyle: personaStyleSelect.value,
                languageMode: languageModeSelect.value,
                reviewLength: lengthSelect.value,
                userVibe: userVibeInput.value.trim(),
                enableImages: enableImages
            });

            const reviewText = result.review || 'No review generated';
            const promptText = result.image_prompt || '';

            reviewOutput.value = reviewText;
            promptOutput.value = promptText;

            // Auto-Copy review to clipboard natively
            reviewOutputContainer.style.display = 'block';
            const copied = await copyToClipboard(reviewText);
            if (!copied) {
                statusMessage.textContent = 'Review generated. Auto-copy is blocked by browser policy, use "Copy Review".';
                statusMessage.classList.remove('hidden');
            }
            
            if (enableImages) {
                promptOutputContainer.style.display = 'block';
                
                const imageOptions = {
                    imageStyle: imageStyleSelect.value,
                    aspectRatio: aspectRatioSelect.value,
                    imageQuality: imageQualitySelect.value,
                    useWebGrounding: useWebGroundingInput.checked,
                    useImageGrounding: useImageGroundingInput.checked
                };
                
                for(let i=0; i < imgCount; i++) {
                    const imgWrapper = document.createElement('div');
                    imgWrapper.style.marginBottom = '10px';
                    
                    const img = document.createElement('img');
                    img.style.width = '100%';
                    img.style.borderRadius = '4px';
                    img.style.minHeight = '150px';
                    img.style.backgroundColor = '#e8eaed';
                    img.alt = `Generating Image ${i+1}...`;
                    
                    const dlBtn = document.createElement('button');
                    dlBtn.textContent = `Generating...`;
                    dlBtn.style.backgroundColor = '#80868b';
                    dlBtn.style.marginTop = '4px';
                    dlBtn.disabled = true;

                    imgWrapper.appendChild(img);
                    imgWrapper.appendChild(dlBtn);
                    imagesContainer.appendChild(imgWrapper);

                    // Fetch natively from Gemini 3.1 Flash Image Preview API concurrently
                    callGeminiImageAPI(apiKey, promptText, imageOptions)
                        .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            img.src = blobUrl;
                            img.style.minHeight = 'auto';
                            
                            dlBtn.textContent = `Download Image ${i+1}`;
                            dlBtn.style.backgroundColor = '#0b8043';
                            dlBtn.disabled = false;
                            
                            const filename = `Maps_${currentPlaceInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${i+1}.jpg`;
                            
                            // Reliable manual download logic
                            dlBtn.onclick = () => {
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = filename;
                                a.click();
                            };

                            // Auto-download as soon as it's ready
                            const autoA = document.createElement('a');
                            autoA.href = blobUrl;
                            autoA.download = filename;
                            autoA.click();
                        })
                        .catch(err => {
                            console.error('Image gen error:', err);
                            img.alt = `Failed to load image ${i+1}`;
                            dlBtn.textContent = 'Failed to Load';
                        });
                }
            } else {
                promptOutputContainer.style.display = 'none';
            }

            resultsCard.classList.remove('hidden');
        } catch (error) {
            showError("Failed to generate: " + error.message);
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
            if (tabUrl && tabUrl.includes("google.com/maps")) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: (text) => {
                        // Very basic paste to the maps review box, if open
                        const box = document.querySelector('textarea, div[role="textbox"]');
                        if (box) {
                            box.focus();
                            document.execCommand('insertText', false, text);
                        } else {
                            alert("Please open the Write a Review box first.");
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
