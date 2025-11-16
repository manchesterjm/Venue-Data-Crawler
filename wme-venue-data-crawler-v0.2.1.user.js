// ==UserScript==
// @name         WME Venue Data Crawler
// @namespace    https://github.com/manchesterjm
// @version      0.2.1
// @description  Scan venues for missing data and extract from websites
// @author       manchesterjm
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/editor*
// @exclude      https://www.waze.com/user/editor*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=waze.com
// @grant        GM_xmlhttpRequest
// @connect      *
// @license      MIT
// ==/UserScript==

/**
 * WME Venue Data Crawler
 *
 * Scans venues for missing data and extracts information from their websites.
 *
 * Version: 0.2.1 - Fixed location extraction
 *
 * @file wme-venue-data-crawler-v0.2.1.user.js
 */

/* global W, GM_xmlhttpRequest */

(function() {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const SCRIPT_NAME = 'WME Venue Data Crawler';
    const SCRIPT_VERSION = '0.2.1';
    const SCRIPT_ID = 'wme-venue-data-crawler';

    /**
     * Severity levels for venues based on missing data
     * @enum {number}
     */
    const SEVERITY = {
        COMPLETE: 0,    // Green - All data present
        MINOR: 1,       // Yellow - Minor issues (1 field missing)
        MAJOR: 2,       // Red - Major issues (2+ fields missing)
        CRITICAL: 3     // Dark Red - Critical issues (no contact info at all)
    };

    /**
     * Fields to check for completeness
     * Note: Description is intentionally excluded - not important for venue data quality
     * @type {Array<{field: string, label: string, required: boolean}>}
     */
    const REQUIRED_FIELDS = [
        { field: 'name', label: 'Name', required: true },
        { field: 'phone', label: 'Phone', required: false },
        { field: 'url', label: 'Website', required: false }
    ];

    /**
     * Categories to exclude from scanning (natural features, non-business venues)
     * These venues don't need business data like phone/website
     * @type {Array<string>}
     */
    const EXCLUDED_CATEGORIES = [
        'RESIDENCE_HOME',        // RPPs - residential places
        'NATURAL_FEATURES',      // Natural features
        'SCENIC_LOOKOUT_VIEW_POINT', // Scenic lookouts
        'PARK',                  // Parks (may not have phone/website)
        'JUNCTION_INTERCHANGE',  // Road junctions
        'BRIDGE',                // Bridges
        'TUNNEL',                // Tunnels
        'ISLAND',                // Islands
        'SEA_LAKE_POOL',         // Lakes, seas, pools
        'RIVER_STREAM',          // Rivers and streams
        'CANAL',                 // Canals
        'FOREST_GROVE'           // Forests
    ];

    /**
     * Category to search hint mapping
     * Used to improve Google search accuracy
     */
    const CATEGORY_HINTS = {
        'SCHOOL': 'school',
        'CAFE': 'cafe',
        'COFFEE_SHOP': 'coffee',
        'FOOD_AND_DRINK': 'restaurant',
        'RESTAURANT': 'restaurant',
        'FAST_FOOD': 'restaurant',
        'GAS_STATION': 'gas station',
        'CONVENIENCE_STORE': 'convenience store',
        'DOCTOR_CLINIC': 'medical clinic',
        'HOSPITAL_MEDICAL_CARE': 'hospital',
        'PHARMACY': 'pharmacy',
        'GARAGE_AUTOMOTIVE_SHOP': 'auto repair',
        'CAR_WASH': 'car wash',
        'SHOPPING_AND_SERVICES': 'store',
        'DEPARTMENT_STORE': 'store',
        'GROCERY_STORE': 'grocery',
        'HOTEL': 'hotel',
        'BANK_FINANCIAL': 'bank',
        'POST_OFFICE': 'post office',
        'LIBRARY': 'library',
        'GYM_FITNESS': 'gym',
        'OUTDOORS': 'outdoor recreation',
        'PET_STORE_VETERINARIAN_SERVICES': 'veterinary',
        'OFFICES': 'office'
    };

    // ============================================================================
    // STATE
    // ============================================================================

    /**
     * Global state for the script
     */
    const state = {
        initialized: false,
        scanning: false,
        scannedVenues: new Map(), // venueId -> { venue, severity, missing, extracted }
        lastScanTime: null,
        extractionInProgress: new Set() // venueIds currently being processed
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Log message to console with script prefix
     * @param {...*} args - Arguments to log
     */
    function log(...args) {
        console.log(`[${SCRIPT_NAME} v${SCRIPT_VERSION}]`, ...args);
    }

    /**
     * Log error to console with script prefix
     * @param {...*} args - Arguments to log
     */
    function logError(...args) {
        console.error(`[${SCRIPT_NAME} v${SCRIPT_VERSION}]`, ...args);
    }

    /**
     * Check if a string value is empty or null
     * @param {*} value - Value to check
     * @returns {boolean} True if empty or null
     */
    function isEmpty(value) {
        return value === null || value === undefined ||
               (typeof value === 'string' && value.trim() === '');
    }

    /**
     * Download a file to the user's computer
     * @param {string} filename - Name of the file
     * @param {string} content - File content
     */
    function downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        log(`Downloaded: ${filename}`);
    }

    // ============================================================================
    // LOCATION HELPERS
    // ============================================================================

    /**
     * Get city and state information from the currently loaded map view
     * Note: We query the EDITOR for location, not the venue itself,
     * because venue data may be incomplete/incorrect (that's what we're fixing!)
     * @returns {{cityName: string, stateName: string, stateAbbr: string}}
     */
    function getVenueLocation() {
        try {
            // Get all loaded cities in the current map view
            const cities = W.model.cities.getObjectArray();

            if (cities.length === 0) {
                logError('No cities loaded in current view');
                return { cityName: '', stateName: '', stateAbbr: '' };
            }

            // Use the first loaded city (user is zoomed into a specific area)
            const city = cities[0];
            const cityName = city.attributes.name || '';

            // Get state from the city
            const stateID = city.attributes.stateID;
            const state = stateID ? W.model.states.getObjectById(stateID) : null;
            const stateName = state ? state.attributes.name : '';
            const stateAbbr = state ? state.attributes.abbreviation : '';

            log(`Location context: ${cityName}, ${stateAbbr}`);
            return { cityName, stateName, stateAbbr };
        } catch (error) {
            logError('Error getting location from editor:', error);
            return { cityName: '', stateName: '', stateAbbr: '' };
        }
    }

    /**
     * Get search hint for a category
     * @param {string} category - WME category string
     * @returns {string} Search hint
     */
    function getCategoryHint(category) {
        return CATEGORY_HINTS[category] || '';
    }

    /**
     * Build a Google search query for a venue
     * @param {string} venueName - Name of venue (may have typos)
     * @param {Array<string>} categories - Venue categories
     * @param {string} cityName - City name
     * @param {string} stateAbbr - State abbreviation (CO, CA, etc.)
     * @returns {string} Search query
     */
    function buildSearchQuery(venueName, categories, cityName, stateAbbr) {
        let query = venueName;

        // Add category hint for context (helps Google understand and correct typos)
        if (categories.length > 0) {
            const categoryHint = getCategoryHint(categories[0]);
            if (categoryHint) {
                query += ' ' + categoryHint;
            }
        }

        // Add location (critical for disambiguation)
        if (cityName && stateAbbr) {
            query += ' ' + cityName + ' ' + stateAbbr;
        }

        return query;
    }

    // ============================================================================
    // WEB SCRAPING
    // ============================================================================

    /**
     * Extract phone number from text using regex
     * @param {string} text - Text to search
     * @returns {string|null} Phone number or null
     */
    function extractPhoneRegex(text) {
        // Match common phone formats: (123) 456-7890, 123-456-7890, 123.456.7890, etc.
        const phoneRegex = /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/;
        const match = text.match(phoneRegex);
        return match ? match[0] : null;
    }

    /**
     * Extract data from Schema.org JSON-LD
     * @param {string} html - HTML content
     * @returns {Object|null} Extracted data or null
     */
    function extractSchemaOrg(html) {
        try {
            // Find all script tags with type="application/ld+json"
            const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
            let match;

            while ((match = scriptRegex.exec(html)) !== null) {
                try {
                    const jsonText = match[1];
                    const data = JSON.parse(jsonText);

                    // Handle both single objects and arrays
                    const items = Array.isArray(data) ? data : [data];

                    for (const item of items) {
                        const type = item['@type'];
                        // Check if it's a LocalBusiness or any business-related type
                        if (type && (type.includes('LocalBusiness') ||
                                   type.includes('Restaurant') ||
                                   type.includes('Organization') ||
                                   type.includes('Store'))) {

                            return {
                                phone: item.telephone || null,
                                website: item.url || null,
                                address: item.address?.streetAddress || null,
                                name: item.name || null
                            };
                        }
                    }
                } catch (e) {
                    // Invalid JSON in this script tag, continue to next
                    continue;
                }
            }
        } catch (error) {
            logError('Error extracting Schema.org:', error);
        }
        return null;
    }

    /**
     * Extract data from microdata meta tags
     * @param {string} html - HTML content
     * @returns {Object|null} Extracted data or null
     */
    function extractMicrodata(html) {
        const data = {
            phone: null,
            website: null,
            address: null
        };

        try {
            // Business phone patterns
            const phonePatterns = [
                /<meta[^>]*property=["']business:contact_data:phone_number["'][^>]*content=["']([^"']+)["']/i,
                /<meta[^>]*name=["']telephone["'][^>]*content=["']([^"']+)["']/i,
                /<meta[^>]*itemprop=["']telephone["'][^>]*content=["']([^"']+)["']/i
            ];

            for (const pattern of phonePatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    data.phone = match[1];
                    break;
                }
            }

            // Business website patterns
            const websitePatterns = [
                /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i,
                /<meta[^>]*itemprop=["']url["'][^>]*content=["']([^"']+)["']/i
            ];

            for (const pattern of websitePatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    data.website = match[1];
                    break;
                }
            }

            // Street address
            const addressPatterns = [
                /<meta[^>]*property=["']business:contact_data:street_address["'][^>]*content=["']([^"']+)["']/i,
                /<meta[^>]*itemprop=["']streetAddress["'][^>]*content=["']([^"']+)["']/i
            ];

            for (const pattern of addressPatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    data.address = match[1];
                    break;
                }
            }
        } catch (error) {
            logError('Error extracting microdata:', error);
        }

        // Return null if nothing was found
        if (!data.phone && !data.website && !data.address) {
            return null;
        }

        return data;
    }

    /**
     * Extract data using regex fallback
     * @param {string} html - HTML content
     * @returns {Object|null} Extracted data or null
     */
    function extractWithRegex(html) {
        const data = {
            phone: extractPhoneRegex(html),
            website: null,
            address: null
        };

        // Return null if nothing was found
        if (!data.phone) {
            return null;
        }

        return data;
    }

    /**
     * Scrape a website for venue data
     * @param {string} url - Website URL
     * @param {Function} callback - Callback with (error, data)
     */
    function scrapeWebsite(url, callback) {
        log(`Scraping: ${url}`);

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                try {
                    const html = response.responseText;

                    // Try extraction methods in order of reliability
                    let extractedData = extractSchemaOrg(html);
                    const method = extractedData ? 'Schema.org' : null;

                    if (!extractedData) {
                        extractedData = extractMicrodata(html);
                        if (extractedData) method = 'Microdata';
                    }

                    if (!extractedData) {
                        extractedData = extractWithRegex(html);
                        if (extractedData) method = 'Regex';
                    }

                    if (extractedData) {
                        log(`Extraction successful (${method}):`, extractedData);
                        callback(null, { ...extractedData, method, sourceUrl: url });
                    } else {
                        log('No data extracted from website');
                        callback(null, { method: 'None', sourceUrl: url });
                    }
                } catch (error) {
                    logError('Error processing website:', error);
                    callback(error, null);
                }
            },
            onerror: function(error) {
                logError('Failed to fetch website:', error);
                callback(error, null);
            },
            ontimeout: function() {
                logError('Website fetch timed out');
                callback(new Error('Timeout'), null);
            },
            timeout: 10000 // 10 second timeout
        });
    }

    /**
     * Perform Google search and extract first result
     * @param {string} query - Search query
     * @param {Function} callback - Callback with (error, url)
     */
    function googleSearch(query, callback) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        log(`Google search: ${query}`);

        GM_xmlhttpRequest({
            method: 'GET',
            url: searchUrl,
            onload: function(response) {
                try {
                    const html = response.responseText;

                    // Extract first organic result URL
                    // Google search results use specific patterns
                    const urlRegex = /<a[^>]*href=["']\/url\?q=([^"'&]+)[&"']/i;
                    const match = html.match(urlRegex);

                    if (match && match[1]) {
                        const resultUrl = decodeURIComponent(match[1]);
                        log(`Found URL: ${resultUrl}`);
                        callback(null, resultUrl);
                    } else {
                        log('No Google results found');
                        callback(new Error('No results'), null);
                    }
                } catch (error) {
                    logError('Error parsing Google results:', error);
                    callback(error, null);
                }
            },
            onerror: function(error) {
                logError('Google search failed:', error);
                callback(error, null);
            },
            timeout: 10000
        });
    }

    // ============================================================================
    // VENUE ANALYSIS
    // ============================================================================

    /**
     * Analyze a venue and determine what data is missing
     * @param {Object} venue - WME venue object
     * @returns {{severity: number, missing: Array<string>, hasContactInfo: boolean}}
     */
    function analyzeVenue(venue) {
        const attrs = venue.attributes;
        const missing = [];

        // Check each required field
        for (const fieldDef of REQUIRED_FIELDS) {
            const value = attrs[fieldDef.field];
            if (isEmpty(value)) {
                missing.push(fieldDef.label);
            }
        }

        // Determine if venue has ANY contact information
        const hasPhone = !isEmpty(attrs.phone);
        const hasWebsite = !isEmpty(attrs.url);
        const hasContactInfo = hasPhone || hasWebsite;

        // Calculate severity
        // Note: We only check 3 fields (name, phone, website) - description excluded
        let severity;
        if (missing.length === 0) {
            severity = SEVERITY.COMPLETE;
        } else if (!hasContactInfo) {
            // No phone AND no website = critical
            severity = SEVERITY.CRITICAL;
        } else if (missing.length >= 2) {
            // Missing 2+ fields but has contact info = major
            severity = SEVERITY.MAJOR;
        } else {
            // Missing 1 field and has contact info = minor
            severity = SEVERITY.MINOR;
        }

        return { severity, missing, hasContactInfo };
    }

    /**
     * Get human-readable severity label
     * @param {number} severity - Severity level
     * @returns {string} Severity label
     */
    function getSeverityLabel(severity) {
        switch (severity) {
            case SEVERITY.COMPLETE: return 'Complete';
            case SEVERITY.MINOR: return 'Minor Issues';
            case SEVERITY.MAJOR: return 'Major Issues';
            case SEVERITY.CRITICAL: return 'Critical';
            default: return 'Unknown';
        }
    }

    /**
     * Get color for severity level
     * @param {number} severity - Severity level
     * @returns {string} CSS color
     */
    function getSeverityColor(severity) {
        switch (severity) {
            case SEVERITY.COMPLETE: return '#4CAF50'; // Green
            case SEVERITY.MINOR: return '#FFC107';    // Yellow
            case SEVERITY.MAJOR: return '#FF5722';     // Red
            case SEVERITY.CRITICAL: return '#B71C1C';  // Dark Red
            default: return '#9E9E9E';                 // Grey
        }
    }

    // ============================================================================
    // VENUE SCANNING
    // ============================================================================

    /**
     * Scan all currently loaded venues
     * @returns {number} Number of venues scanned
     */
    function scanLoadedVenues() {
        if (!W || !W.model || !W.model.venues) {
            logError('WME model not ready');
            return 0;
        }

        const venues = W.model.venues.getObjectArray();
        let scanned = 0;
        let skipped = 0;

        // Get location info once for all venues (they're all in the same view)
        const location = getVenueLocation();

        for (const venue of venues) {
            // Skip if not a venue
            if (!venue || venue.type !== 'venue') continue;

            // Skip unnamed venues - nothing we can do without a name
            const venueName = venue.attributes.name;
            if (!venueName || venueName.trim() === '') {
                skipped++;
                continue;
            }

            // Skip excluded categories (RPPs, natural features, etc.)
            const categories = venue.attributes.categories || [];
            const hasExcludedCategory = categories.some(cat => EXCLUDED_CATEGORIES.includes(cat));
            if (hasExcludedCategory) {
                skipped++;
                continue;
            }

            // Analyze venue
            const analysis = analyzeVenue(venue);

            // Store results
            state.scannedVenues.set(venue.attributes.id, {
                venue: venue,
                severity: analysis.severity,
                missing: analysis.missing,
                hasContactInfo: analysis.hasContactInfo,
                name: venue.attributes.name || 'Unnamed Venue',
                categories: categories,
                phone: venue.attributes.phone || '',
                url: venue.attributes.url || '',
                address: venue.attributes.streetName || '',
                location: location,
                extracted: null // Will be populated when web scraping is done
            });

            scanned++;
        }

        state.lastScanTime = new Date();
        log(`Scanned ${scanned} venues (skipped ${skipped} excluded/unnamed venues)`);

        return scanned;
    }

    /**
     * Get statistics about scanned venues
     * @returns {{total: number, complete: number, minor: number, major: number, critical: number}}
     */
    function getStatistics() {
        const stats = {
            total: state.scannedVenues.size,
            complete: 0,
            minor: 0,
            major: 0,
            critical: 0
        };

        for (const [, data] of state.scannedVenues) {
            switch (data.severity) {
                case SEVERITY.COMPLETE: stats.complete++; break;
                case SEVERITY.MINOR: stats.minor++; break;
                case SEVERITY.MAJOR: stats.major++; break;
                case SEVERITY.CRITICAL: stats.critical++; break;
            }
        }

        return stats;
    }

    // ============================================================================
    // DATA EXTRACTION
    // ============================================================================

    /**
     * Extract data for a venue
     * @param {string} venueId - Venue ID
     */
    function extractVenueData(venueId) {
        const venueData = state.scannedVenues.get(venueId);
        if (!venueData) {
            logError('Venue not found:', venueId);
            return;
        }

        // Check if already extracting
        if (state.extractionInProgress.has(venueId)) {
            log('Extraction already in progress for:', venueData.name);
            return;
        }

        state.extractionInProgress.add(venueId);
        updateVenueItemUI(venueId, 'searching');

        // Build search query
        const query = buildSearchQuery(
            venueData.name,
            venueData.categories,
            venueData.location.cityName,
            venueData.location.stateAbbr
        );

        log(`Starting extraction for: ${venueData.name}`);
        log(`Search query: ${query}`);

        // Step 1: Google search
        googleSearch(query, (searchError, websiteUrl) => {
            if (searchError || !websiteUrl) {
                logError('Google search failed for:', venueData.name);
                venueData.extracted = {
                    error: 'No search results found',
                    searchQuery: query
                };
                state.extractionInProgress.delete(venueId);
                updateVenueItemUI(venueId, 'error');
                return;
            }

            // Step 2: Scrape website
            scrapeWebsite(websiteUrl, (scrapeError, extractedData) => {
                if (scrapeError) {
                    logError('Scraping failed for:', venueData.name);
                    venueData.extracted = {
                        error: 'Failed to fetch website',
                        searchQuery: query,
                        websiteUrl: websiteUrl
                    };
                } else {
                    venueData.extracted = {
                        ...extractedData,
                        searchQuery: query
                    };
                }

                state.extractionInProgress.delete(venueId);
                updateVenueItemUI(venueId, 'complete');
            });
        });
    }

    // ============================================================================
    // REPORT GENERATION
    // ============================================================================

    /**
     * Generate a detailed scan report
     * @returns {string} Report content
     */
    function generateScanReport() {
        const stats = getStatistics();
        const timestamp = new Date().toISOString();

        let report = '';
        report += '='.repeat(80) + '\n';
        report += 'WME Venue Data Crawler - Scan Report\n';
        report += '='.repeat(80) + '\n';
        report += `\n`;
        report += `Script Version: ${SCRIPT_VERSION}\n`;
        report += `Scan Time: ${timestamp}\n`;
        report += `Scan Location: ${W.map.getCenter().lon.toFixed(6)}, ${W.map.getCenter().lat.toFixed(6)}\n`;
        report += `Zoom Level: ${W.map.getZoom()}\n`;
        report += `\n`;
        report += `Excluded Categories: ${EXCLUDED_CATEGORIES.join(', ')}\n`;
        report += `Note: Unnamed venues and excluded categories are automatically skipped\n`;
        report += `\n`;

        // Statistics
        report += '-'.repeat(80) + '\n';
        report += 'SUMMARY STATISTICS\n';
        report += '-'.repeat(80) + '\n';
        report += `Total Venues Scanned: ${stats.total}\n`;
        report += `  - Complete (Green):    ${stats.complete}\n`;
        report += `  - Minor Issues (Yellow): ${stats.minor}\n`;
        report += `  - Major Issues (Red):    ${stats.major}\n`;
        report += `  - Critical (Dark Red):   ${stats.critical}\n`;
        report += `\n`;

        // Detailed venue list
        report += '-'.repeat(80) + '\n';
        report += 'DETAILED VENUE LIST\n';
        report += '-'.repeat(80) + '\n';
        report += `\n`;

        // Sort by severity (worst first)
        const sortedVenues = Array.from(state.scannedVenues.values())
            .sort((a, b) => b.severity - a.severity);

        for (const data of sortedVenues) {
            report += `Venue: ${data.name}\n`;
            report += `  Severity: ${getSeverityLabel(data.severity)}\n`;
            report += `  Categories: ${data.categories.join(', ')}\n`;
            report += `  Location: ${data.location.cityName}, ${data.location.stateAbbr}\n`;
            report += `  Address: ${data.address || 'N/A'}\n`;
            report += `  Phone: ${data.phone || 'MISSING'}\n`;
            report += `  Website: ${data.url || 'MISSING'}\n`;
            report += `  Missing Fields: ${data.missing.length > 0 ? data.missing.join(', ') : 'None'}\n`;
            report += `  Has Contact Info: ${data.hasContactInfo ? 'Yes' : 'NO'}\n`;

            // Add extracted data if available
            if (data.extracted) {
                report += `  --- Extracted Data ---\n`;
                if (data.extracted.error) {
                    report += `  Error: ${data.extracted.error}\n`;
                } else {
                    report += `  Method: ${data.extracted.method}\n`;
                    report += `  Source URL: ${data.extracted.sourceUrl}\n`;
                    report += `  Extracted Phone: ${data.extracted.phone || 'Not found'}\n`;
                    report += `  Extracted Website: ${data.extracted.website || 'Not found'}\n`;
                    report += `  Extracted Address: ${data.extracted.address || 'Not found'}\n`;
                }
            }

            report += `\n`;
        }

        report += '='.repeat(80) + '\n';
        report += 'END OF REPORT\n';
        report += '='.repeat(80) + '\n';

        return report;
    }

    /**
     * Handle download report button click
     */
    function handleDownloadReport() {
        if (state.scannedVenues.size === 0) {
            alert('No scan data available. Please run a scan first.');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `venue-scan-report-${timestamp}.txt`;
        const report = generateScanReport();

        downloadFile(filename, report);
        log('Report downloaded successfully');
    }

    // ============================================================================
    // USER INTERFACE
    // ============================================================================

    /**
     * Update a venue item's UI to show extraction status
     * @param {string} venueId - Venue ID
     * @param {string} status - 'searching', 'complete', 'error'
     */
    function updateVenueItemUI(venueId, status) {
        const venueData = state.scannedVenues.get(venueId);
        if (!venueData) return;

        const itemDiv = document.getElementById(`${SCRIPT_ID}-venue-${venueId}`);
        if (!itemDiv) return;

        const extractBtn = itemDiv.querySelector('.extract-btn');
        const resultsDiv = itemDiv.querySelector('.extraction-results');

        if (status === 'searching') {
            extractBtn.textContent = '⏳ Searching...';
            extractBtn.disabled = true;
            resultsDiv.innerHTML = '<div style="color: #666; font-size: 11px;">Searching Google and extracting data...</div>';
        } else if (status === 'complete') {
            extractBtn.textContent = '🔄 Re-extract';
            extractBtn.disabled = false;

            if (venueData.extracted) {
                if (venueData.extracted.error) {
                    resultsDiv.innerHTML = `<div style="color: #f44336; font-size: 11px;">❌ ${venueData.extracted.error}</div>`;
                } else {
                    let html = '<div style="font-size: 11px; margin-top: 4px;">';
                    html += `<div style="color: #666;">Method: ${venueData.extracted.method}</div>`;

                    if (venueData.extracted.phone) {
                        html += `<div style="color: #4CAF50;">✓ Phone: ${venueData.extracted.phone}</div>`;
                    } else {
                        html += `<div style="color: #f44336;">✗ Phone: Not found</div>`;
                    }

                    if (venueData.extracted.website || venueData.extracted.sourceUrl) {
                        const url = venueData.extracted.website || venueData.extracted.sourceUrl;
                        html += `<div style="color: #4CAF50;">✓ Website: ${url}</div>`;
                    } else {
                        html += `<div style="color: #f44336;">✗ Website: Not found</div>`;
                    }

                    html += '</div>';
                    resultsDiv.innerHTML = html;
                }
            }
        } else if (status === 'error') {
            extractBtn.textContent = '🔄 Retry';
            extractBtn.disabled = false;
            resultsDiv.innerHTML = '<div style="color: #f44336; font-size: 11px;">❌ Extraction failed</div>';
        }
    }

    /**
     * Create and inject the UI panel
     */
    function createUI() {
        // Create main panel
        const panel = document.createElement('div');
        panel.id = `${SCRIPT_ID}-panel`;
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 80px;
                right: 20px;
                width: 350px;
                background: white;
                border: 2px solid #0074D9;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                z-index: 1000;
            ">
                <div style="
                    background: #0074D9;
                    color: white;
                    padding: 12px;
                    border-radius: 6px 6px 0 0;
                    font-weight: 600;
                    cursor: move;
                    user-select: none;
                " id="${SCRIPT_ID}-header">
                    ${SCRIPT_NAME} v${SCRIPT_VERSION}
                    <span style="float: right; cursor: pointer;" id="${SCRIPT_ID}-close">×</span>
                </div>

                <div style="padding: 12px;">
                    <button id="${SCRIPT_ID}-scan" style="
                        width: 100%;
                        padding: 10px;
                        background: #0074D9;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        margin-bottom: 8px;
                    ">
                        Scan Visible Venues
                    </button>

                    <button id="${SCRIPT_ID}-download" style="
                        width: 100%;
                        padding: 8px;
                        background: #2ECC40;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        margin-bottom: 12px;
                    ">
                        📥 Download Scan Report
                    </button>

                    <div id="${SCRIPT_ID}-stats" style="
                        font-size: 13px;
                        line-height: 1.6;
                        display: none;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                            Scan Results:
                        </div>
                        <div id="${SCRIPT_ID}-stats-content"></div>
                    </div>

                    <div id="${SCRIPT_ID}-list" style="
                        margin-top: 12px;
                        max-height: 500px;
                        overflow-y: auto;
                        display: none;
                    "></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Make panel draggable
        makeDraggable(panel, document.getElementById(`${SCRIPT_ID}-header`));

        // Add event listeners
        document.getElementById(`${SCRIPT_ID}-scan`).addEventListener('click', handleScanClick);
        document.getElementById(`${SCRIPT_ID}-download`).addEventListener('click', handleDownloadReport);
        document.getElementById(`${SCRIPT_ID}-close`).addEventListener('click', () => {
            panel.style.display = 'none';
        });

        log('UI created');
    }

    /**
     * Make an element draggable
     * @param {HTMLElement} element - Element to make draggable
     * @param {HTMLElement} handle - Drag handle
     */
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + 'px';
            element.style.left = (element.offsetLeft - pos1) + 'px';
            element.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    /**
     * Handle scan button click
     */
    function handleScanClick() {
        log('Scan button clicked');

        // Clear previous results
        state.scannedVenues.clear();

        // Scan venues
        const count = scanLoadedVenues();

        // Update UI
        updateStatsDisplay();
        updateVenueList();
    }

    /**
     * Update the statistics display
     */
    function updateStatsDisplay() {
        const stats = getStatistics();
        const statsDiv = document.getElementById(`${SCRIPT_ID}-stats`);
        const statsContent = document.getElementById(`${SCRIPT_ID}-stats-content`);

        if (stats.total === 0) {
            statsDiv.style.display = 'none';
            return;
        }

        statsDiv.style.display = 'block';

        statsContent.innerHTML = `
            <div style="margin: 4px 0;">
                <span style="color: ${getSeverityColor(SEVERITY.COMPLETE)};">●</span> Complete: ${stats.complete}
            </div>
            <div style="margin: 4px 0;">
                <span style="color: ${getSeverityColor(SEVERITY.MINOR)};">●</span> Minor Issues: ${stats.minor}
            </div>
            <div style="margin: 4px 0;">
                <span style="color: ${getSeverityColor(SEVERITY.MAJOR)};">●</span> Major Issues: ${stats.major}
            </div>
            <div style="margin: 4px 0;">
                <span style="color: ${getSeverityColor(SEVERITY.CRITICAL)};">●</span> Critical: ${stats.critical}
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd; font-weight: 600;">
                Total: ${stats.total} venues
            </div>
        `;
    }

    /**
     * Update the venue list display
     */
    function updateVenueList() {
        const listDiv = document.getElementById(`${SCRIPT_ID}-list`);

        if (state.scannedVenues.size === 0) {
            listDiv.style.display = 'none';
            return;
        }

        listDiv.style.display = 'block';

        // Sort venues by severity (worst first)
        const sortedVenues = Array.from(state.scannedVenues.values())
            .sort((a, b) => b.severity - a.severity);

        // Only show venues with issues
        const venuesWithIssues = sortedVenues.filter(v => v.severity !== SEVERITY.COMPLETE);

        if (venuesWithIssues.length === 0) {
            listDiv.innerHTML = '<div style="padding: 8px; text-align: center; color: #4CAF50;">All venues are complete!</div>';
            return;
        }

        // Build list HTML
        let html = '<div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Venues Needing Work:</div>';

        for (const data of venuesWithIssues) {
            const venueId = data.venue.attributes.id;
            html += `
                <div id="${SCRIPT_ID}-venue-${venueId}" style="
                    margin: 6px 0;
                    padding: 8px;
                    background: #f5f5f5;
                    border-left: 4px solid ${getSeverityColor(data.severity)};
                    border-radius: 4px;
                    font-size: 12px;
                ">
                    <div style="font-weight: 600; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${data.name}</span>
                        <button class="extract-btn" data-venue-id="${venueId}" style="
                            padding: 4px 8px;
                            background: #FF9800;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                            font-weight: 600;
                        ">🔍 Extract Data</button>
                    </div>
                    <div style="color: #666; font-size: 11px;">
                        Missing: ${data.missing.join(', ')}
                    </div>
                    <div style="color: #999; font-size: 10px;">
                        ${data.location.cityName}, ${data.location.stateAbbr}
                    </div>
                    <div class="extraction-results" style="margin-top: 4px;"></div>
                </div>
            `;
        }

        listDiv.innerHTML = html;

        // Add event listeners to extract buttons
        const extractBtns = listDiv.querySelectorAll('.extract-btn');
        extractBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const venueId = e.target.dataset.venueId;
                extractVenueData(venueId);
            });
        });
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize the script
     */
    function init() {
        // Check if WME is ready
        if (typeof W === 'undefined' || !W.model || !W.model.venues) {
            setTimeout(init, 200);
            return;
        }

        if (state.initialized) {
            log('Already initialized');
            return;
        }

        log('Initializing...');

        // Create UI
        createUI();

        // Set up event listeners for automatic scanning
        W.model.events.register('mergeend', null, () => {
            log('Map data merged - ready for scanning');
        });

        state.initialized = true;
        log('Initialized successfully');
    }

    // Start initialization
    init();

})();
