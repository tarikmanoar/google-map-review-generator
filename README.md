🗺️ Maps AI Review Generator

A powerful, lightweight Google Chrome Extension that instantly extracts place information from Google Maps and uses Google's Gemini AI to generate highly contextual, authentic reviews and visual image generation prompts.

Built entirely with Vanilla JavaScript, HTML, and CSS using Manifest V3. No backend required—it communicates directly with the Gemini API!

✨ Features

Smart DOM Scraping: Automatically extracts the Place Name, Address, and Recent Reviews directly from the active Google Maps tab.

AI-Powered Generation: Leverages the Gemini API to write contextual reviews based on the extracted place data.

Customizable Sentiments: Choose the tone of your review: Positive (5-star), Average (3-star), Negative (1-star), or Funny & Witty.

Image Prompts: Automatically generates a descriptive image generation prompt (perfect for Midjourney or DALL-E) based on the location's characteristics.

Privacy First: Your Gemini API key is saved securely in your browser using chrome.storage.local. No data is sent to third-party servers aside from the direct call to Google's Gemini API.

⚙️ How It Works

Extraction: When you open the extension popup on a Google Maps page, it uses Chrome's scripting API to inject a lightweight content scraper into the page.

Context Gathering: It finds the specific HTML elements (like h1 tags and aria-labels) to grab the place's name, address, and up to 8 recent reviews to use as context.

AI Processing: The extension packages this data with a custom system prompt and sends it to the Gemini API, requesting a structured JSON response.

Display: The generated review and image prompt are parsed and displayed beautifully in the popup UI.

🚀 Setup & Installation

Since this is a custom extension, you will need to load it into Chrome manually via "Developer Mode".

Prerequisites

You need a Gemini API Key to power the AI.

Go to Google AI Studio.

Sign in with your Google account and click Get API key.

Create a new API key and copy it.

Installation Steps

Download the Code: Create a new folder on your computer (e.g., Maps-Review-Extension) and save the manifest.json, popup.html, and popup.js files into it.

Open Extensions Page: Open Google Chrome and type chrome://extensions/ into your address bar, or go to the three-dot menu > Extensions > Manage Extensions.

Enable Developer Mode: Toggle the Developer mode switch in the top right corner of the page.

Load the Extension: Click the Load unpacked button that appears in the top left.

Select Folder: Browse to and select the folder you created in Step 1.

Pin It: Click the "Puzzle" icon in your Chrome toolbar and click the pin icon next to "Maps AI Review Generator" so it's always accessible.

💡 Usage Guide

Navigate to Google Maps.

Search for a location or click on a place marker on the map. Make sure the left-hand details panel for that specific place is open.

Click the extension icon in your Chrome toolbar.

Paste your Gemini API Key into the settings field (you only need to do this once).

The extension will automatically detect the place. Select your desired Review Type from the dropdown.

Click Generate AI Review.

Copy your generated review or the image prompt from the text boxes!

🛠️ Tech Stack

Manifest V3: The latest Chrome Extension standard.

Vanilla JavaScript (ES6+): Handles logic, API calls, and DOM manipulation.

HTML5/CSS3: Custom, modern UI inspired by Google Workspace styling.

Gemini API: Generative AI via gemini-2.5-flash.

📝 License

This project is open-source and free to use or modify for personal and educational purposes.