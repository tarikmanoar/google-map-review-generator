document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const generateBtn = document.getElementById('generateBtn');
    const statusMessage = document.getElementById('statusMessage');
    const placeCard = document.getElementById('placeCard');
    const placeNameEl = document.getElementById('placeName');
    const placeAddressEl = document.getElementById('placeAddress');
    const sentimentSelect = document.getElementById('sentiment');
    const lengthSelect = document.getElementById('reviewLength');
    const userVibeInput = document.getElementById('userVibe');
    const loader = document.getElementById('loader');
    const resultsCard = document.getElementById('resultsCard');
    const reviewOutput = document.getElementById('reviewOutput');
    const promptOutput = document.getElementById('promptOutput');
    const imagePreview = document.getElementById('imagePreview');
    const autoPasteBtn = document.getElementById('autoPasteBtn');

    let currentPlaceInfo = null;

    // Persist UI states so if popup closes, inputs are not lost
    const restoreInputs = () => {
        chrome.storage.local.get(['savedSentiment', 'savedLength', 'savedVibe'], (result) => {
            if (result.savedSentiment) sentimentSelect.value = result.savedSentiment;
            if (result.savedLength) lengthSelect.value = result.savedLength;
            if (result.savedVibe) userVibeInput.value = result.savedVibe;
        });
    };
    
    restoreInputs();

    // Save inputs automatically on change
    [sentimentSelect, lengthSelect, userVibeInput].forEach(el => {
        el.addEventListener('change', () => {
            chrome.storage.local.set({
                savedSentiment: sentimentSelect.value,
                savedLength: lengthSelect.value,
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
        const reviewLength = lengthSelect.value;
        const userVibe = userVibeInput.value.trim();

        // Check Cache first
        const cacheKey = `${currentPlaceInfo.name}_${sentiment}_${reviewLength}_${userVibe}`;
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
            const result = cachedContent[cacheKey];
            displayResults(result);
            return;
        }

        try {
            const result = await callGeminiAPI(apiKey, currentPlaceInfo, sentiment, reviewLength, userVibe);
            if (chrome.storage.session) {
                chrome.storage.session.set({ [cacheKey]: result });
            }
            displayResults(result);
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
        reviewOutput.value = result.review || "Review could not be generated.";
        
        let promptText = result.image_prompt || result.imagePrompt || "Could not generate image prompt.";
        promptOutput.value = promptText;
        
        if (promptText && promptText !== "Could not generate image prompt.") {
            // Generate real image via Pollinations API
            const encodedPrompt = encodeURIComponent(promptText);
            imagePreview.src = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=350&height=200&nologo=true`;
            imagePreview.style.display = 'block';
        }

        resultsCard.classList.remove('hidden');
        generateBtn.disabled = false;
        loader.style.display = 'none';
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
                chrome.storage.local.get(['savedSentiment', 'savedLength', 'savedVibe'], async (localData) => {
                    const sentiment = localData.savedSentiment || sentimentSelect.value;
                    const length = localData.savedLength || lengthSelect.value;
                    const vibe = localData.savedVibe || userVibeInput.value.trim();
                    const cacheKey = `${data.name}_${sentiment}_${length}_${vibe}`;
                    
                    const cachedContent = await chrome.storage.session?.get([cacheKey]);
                    if (cachedContent && cachedContent[cacheKey]) {
                        displayResults(cachedContent[cacheKey]);
                    }
                });
            }
        });
    }

    async function callGeminiAPI(apiKey, placeInfo, sentiment, reviewLength, userVibe) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        let systemPrompt = `You are a trusted local guide who has personally visited and explored this place. You pay close attention to both the good and bad aspects based on the place's category and name. Your writing tone is highly natural, genuine, and relatable—written exactly like a real human leaving a Google Maps review. You avoid corporate or overly robotic phrasing.`;
        
        let lengthInstruction = "";
        if (reviewLength === "short") lengthInstruction = "Keep it brief and concise, around 1-2 sentences.";
        else if (reviewLength === "medium") lengthInstruction = "Write a standard paragraph, around 3-4 sentences.";
        else lengthInstruction = "Write a comprehensive and detailed review covering multiple aspects, around 5-7 sentences.";

        const vibeInstruction = userVibe ? `\nMake sure to explicitly weave this specific user sentiment/experience into the review naturally: "${userVibe}"` : "";

        // Simple language detection logic based on address (a realistic fallback since Gemini handles this well if prompted)
        systemPrompt += `\nIf the address implies a non-English speaking country, write the review in the dominant local language of that region, but keep the image prompt in English.`;

        const userPrompt = `
        Place Name: ${placeInfo.name}
        Address: ${placeInfo.address}
        Place Category & Pricing: ${placeInfo.category || 'Not specified'}
        Current Rating: ${placeInfo.rating || 'Not specified'}
        Recent Reviews Context: ${placeInfo.reviews.length > 0 ? placeInfo.reviews.join(' || ') : 'No recent reviews available.'}
        
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
        const jsonText = data.candidates[0].content.parts[0].text;

        return JSON.parse(jsonText);
    }
});