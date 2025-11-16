// ==UserScript==
// @name         WME Venue Data Crawler (POC)
// @namespace    https://github.com/manchesterjm
// @version      0.1.1
// @description  Proof of concept: Scan venues for missing data and prepare for automated extraction
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
 * WME Venue Data Crawler - Proof of Concept
 *
 * This script demonstrates the core functionality for scanning venues,
 * identifying missing data, and preparing for automated web scraping.
 *
 * Version: 0.1.1 (Added scan report download)
 *
 * @file wme-venue-data-crawler-v0.1.1.user.js
 */

/* global W */

(function() {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const SCRIPT_NAME = 'WME Venue Data Crawler';
    const SCRIPT_VERSION = '0.1.1';
    const SCRIPT_ID = 'wme-venue-data-crawler';

    /**
     * Severity levels for venues based on missing data
     * @enum {number}
     */
    const SEVERITY = {
        COMPLETE: 0,    // Green - All data present
        MINOR: 1,       // Yellow - Minor issues (1-2 fields missing)
        MAJOR: 2,       // Red - Major issues (3+ fields missing)
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

    // ============================================================================
    // STATE
    // ============================================================================

    /**
     * Global state for the script
     */
    const state = {
        initialized: false,
        scanning: false,
        scannedVenues: new Map(), // venueId -> { venue, severity, missing }
        lastScanTime: null
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

        for (const venue of venues) {
            // Skip if not a venue
            if (!venue || venue.type !== 'venue') continue;

            // Skip residential places (RPPs) - not business venues
            const categories = venue.attributes.categories || [];
            if (categories.includes('RESIDENCE_HOME')) continue;

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
                address: venue.attributes.streetName || ''
            });

            scanned++;
        }

        state.lastScanTime = new Date();
        log(`Scanned ${scanned} venues`);

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
            report += `  Address: ${data.address || 'N/A'}\n`;
            report += `  Phone: ${data.phone || 'MISSING'}\n`;
            report += `  Website: ${data.url || 'MISSING'}\n`;
            report += `  Missing Fields: ${data.missing.length > 0 ? data.missing.join(', ') : 'None'}\n`;
            report += `  Has Contact Info: ${data.hasContactInfo ? 'Yes' : 'NO'}\n`;
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
                width: 300px;
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
                        max-height: 400px;
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

        for (const data of venuesWithIssues.slice(0, 20)) { // Limit to 20
            html += `
                <div style="
                    margin: 6px 0;
                    padding: 8px;
                    background: #f5f5f5;
                    border-left: 4px solid ${getSeverityColor(data.severity)};
                    border-radius: 4px;
                    font-size: 12px;
                ">
                    <div style="font-weight: 600; margin-bottom: 4px;">
                        ${data.name}
                    </div>
                    <div style="color: #666; font-size: 11px;">
                        Missing: ${data.missing.join(', ')}
                    </div>
                </div>
            `;
        }

        if (venuesWithIssues.length > 20) {
            html += `<div style="padding: 8px; text-align: center; color: #666; font-size: 12px;">...and ${venuesWithIssues.length - 20} more</div>`;
        }

        listDiv.innerHTML = html;
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
