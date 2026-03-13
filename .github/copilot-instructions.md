# Project Guidelines

## Code Style
- Use Vanilla JavaScript (ES6+), HTML5, and CSS3. No additional frameworks.
- UI should follow Material Design 3 principles to resemble a sleek Google Workspace add-on with smooth loading states and robust error handling.
- Keep architecture simple with modular functions and proper async/await error handling.

## Architecture
- Chrome Extension (Manifest V3) designed to operate on Google Maps.
- Uses the `scripting` API to inject a lightweight content scraper into the active tab for extracting Place Name, Address, and Recent Reviews.
- Communicates directly with the Gemini API (`gemini-2.5-flash`) generating highly authentic, localized reviews and image prompts based on user sentiment choice.

## Build and Test
- No build step required.
- Load unpacked in Chrome via `chrome://extensions/` pointing to the repository root directory.

## Conventions
- **Robust DOM Scraping:** Google Maps heavily obfuscates CSS classes. Always use highly resilient ways to select DOM elements (like `aria-labels`, roles, or generic hierarchies) so the scraper doesn't break upon UI updates.
- **Secure Handling:** Ensure the Gemini API key is always stored securely using `chrome.storage.local` and that the UI accurately reflects its saved state.
- **Prompt Optimization:** Refined system instructions to the Gemini API must request responses strictly formatted as JSON to avoid markdown code blocks breaking `JSON.parse()`.