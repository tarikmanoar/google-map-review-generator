// Single source of truth for "is this a Google Maps place page?".
//
// Loaded by the service worker via importScripts() and by the side panel via a
// <script> tag. Keeping one copy matters: if the worker's matcher is broader
// than the panel's, the panel opens on tabs it then refuses to scrape.
(function (root) {
    function isMapsUrl(url) {
        if (!url) return false;

        let parsed;
        try {
            parsed = new URL(url);
        } catch (_) {
            return false;
        }
        if (parsed.protocol !== 'https:') return false;

        const host = parsed.hostname;
        // maps.google.com, maps.google.co.uk, ...
        if (/^maps\.google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host)) return true;
        // google.com/maps, www.google.com.bd/maps, ...
        if (!/^(www\.)?google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host)) return false;
        return parsed.pathname === '/maps' || parsed.pathname.startsWith('/maps/');
    }

    root.MapsUrl = { isMapsUrl };
})(typeof self !== 'undefined' ? self : globalThis);
