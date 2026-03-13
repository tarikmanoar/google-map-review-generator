document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const generateBtn = document.getElementById('generateBtn');
    const statusMessage = document.getElementById('statusMessage');
    const placeCard = document.getElementById('placeCard');
    const placeNameEl = document.getElementById('placeName');
    const placeAddressEl = document.getElementById('placeAddress');
    const sentimentSelect = document.getElementById('sentiment');
    const loader = document.getElementById('loader');
    const resultsCard = document.getElementById('resultsCard');
    const reviewOutput = document.getElementById('reviewOutput');
    const promptOutput = document.getElementById('promptOutput');

    let currentPlaceInfo = null;

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

        // UI Loading state
        generateBtn.disabled = true;
        loader.style.display = 'block';
        resultsCard.classList.add('hidden');
        statusMessage.classList.add('hidden');

        try {
            const result = await callGeminiAPI(apiKey, currentPlaceInfo, sentiment);
            reviewOutput.value = result.review;
            promptOutput.value = result.image_prompt;
            resultsCard.classList.remove('hidden');
        } catch (error) {
            showError("Failed to generate: " + error.message);
        } finally {
            generateBtn.disabled = false;
            loader.style.display = 'none';
        }
    });

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

            // Attempt to fetch existing reviews for context
            const reviewEls = document.querySelectorAll('.wiI7pd');
            const reviews = Array.from(reviewEls).map(el => el.innerText).slice(0, 8); // Get up to 8 reviews

            return { name, address, reviews };
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
            }
        });
    }

    async function callGeminiAPI(apiKey, placeInfo, sentiment) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const systemPrompt = `You are an expert copywriter and local guide.`;
        const userPrompt = `
        Place Name: ${placeInfo.name}
        Address: ${placeInfo.address}
        Recent Reviews Context: ${placeInfo.reviews.length > 0 ? placeInfo.reviews.join(' || ') : 'No recent reviews available.'}
        
        Task 1: Write a highly authentic, naturally sounding ${sentiment} review for this place. Base it loosely on the context provided if available, otherwise make it generally applicable to the type of place. Keep it under 100 words.
        Task 2: Write a descriptive image generation prompt that visualizes this location based on its name and address.

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
                    }
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