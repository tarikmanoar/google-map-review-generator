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
            imageCount: imageCountInput.value,
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
        imageCountInput.value = prefs.imageCount || imageCountInput.value;
        imageQualitySelect.value = prefs.imageQuality || imageQualitySelect.value;
        aspectRatioSelect.value = prefs.aspectRatio || aspectRatioSelect.value;
        imageStyleSelect.value = prefs.imageStyle || imageStyleSelect.value;
        responseModeSelect.value = prefs.responseMode || responseModeSelect.value;
        thinkingLevelSelect.value = prefs.thinkingLevel || thinkingLevelSelect.value;
        includeThoughtsInput.checked = Boolean(prefs.includeThoughts);
        useWebGroundingInput.checked = Boolean(prefs.useWebGrounding);
        useImageGroundingInput.checked = Boolean(prefs.useImageGrounding);
        userVibeInput.value = prefs.vibe || '';
    }

    applyPreferences();

    [
        sentimentSelect, personaStyleSelect, languageModeSelect, lengthSelect,
        imageCountInput, imageQualitySelect, aspectRatioSelect, imageStyleSelect,
        responseModeSelect, thinkingLevelSelect, includeThoughtsInput,
        useWebGroundingInput, useImageGroundingInput, userVibeInput
    ].forEach(el => {
        el.addEventListener('change', savePreferences);
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
        const { sentiment, personaStyle, languageMode, reviewLength, userVibe } = options;
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

        const userPrompt = `
        Place Name: ${placeInfo.name}
        Address: ${placeInfo.address}
        Place Category: ${placeInfo.category || 'Not specified'}
        Rating: ${placeInfo.rating || 'Not specified'}
        Recent Reviews Context: ${recentReviews.join(' || ')}
        
        Task 1: Write an authentic, human-like ${sentiment} review. ${lengthInstruction} ${vibeInstruction}
        Task 2: Write a descriptive image generation prompt matching the atmosphere described.

        Return strictly as a JSON object with keys "review" and "image_prompt".
        `;

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
    
    // Generate Pollinations URL
    function generateImageUrl(prompt, options, seed) {
        const urlPrompt = encodeURIComponent(prompt.substring(0, 800));
        let params = `?seed=${seed}&width=${options.width}&height=${options.height}&model=flux&nologo=true&enhance=true`;
        return `https://image.pollinations.ai/prompt/${urlPrompt}${params}`;
    }

    function getDimensions(aspectRatio) {
        const [w, h] = aspectRatio.split(':').map(Number);
        const base = 1024;
        return { width: Math.round((w/h) * base), height: base };
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

        const responseMode = responseModeSelect.value;
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
                userVibe: userVibeInput.value.trim()
            });

            const reviewText = result.review || 'No review generated';
            const promptText = result.image_prompt || 'A scenic view of the location';

            reviewOutput.value = reviewText;
            promptOutput.value = promptText;

            // Auto-Copy review to clipboard natively
            if (responseMode !== 'image-only') {
                reviewOutputContainer.style.display = 'block';
                const copied = await copyToClipboard(reviewText);
                if (!copied) {
                    statusMessage.textContent = 'Review generated. Auto-copy is blocked by browser policy, use "Copy Review".';
                    statusMessage.classList.remove('hidden');
                }
            } else {
                reviewOutputContainer.style.display = 'none';
            }
            
            if (responseMode !== 'text-only') {
                promptOutputContainer.style.display = 'block';
                const dims = getDimensions(aspectRatioSelect.value);
                
                for(let i=0; i < imgCount; i++) {
                    const seed = Math.floor(Math.random() * 1000000);
                    const imgUrl = generateImageUrl(promptText, dims, seed);
                    
                    const imgWrapper = document.createElement('div');
                    imgWrapper.style.marginBottom = '10px';
                    
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.style.width = '100%';
                    img.style.borderRadius = '4px';
                    
                    const dlBtn = document.createElement('button');
                    dlBtn.textContent = `Download Image ${i+1}`;
                    dlBtn.style.backgroundColor = '#0b8043';
                    dlBtn.style.marginTop = '4px';
                    dlBtn.onclick = () => {
                        chrome.downloads.download({
                            url: imgUrl,
                            filename: `Maps/${currentPlaceInfo.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${i+1}.png`,
                            saveAs: false
                        });
                    };

                    imgWrapper.appendChild(img);
                    imgWrapper.appendChild(dlBtn);
                    imagesContainer.appendChild(imgWrapper);
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
