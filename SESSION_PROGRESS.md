# Venue Data Crawler - Development Session Progress

## Project Vision

Create a WME userscript that:
1. Scans venues on the map to identify missing data
2. Uses Google search to find the venue's website
3. Crawls the website directly to extract business information
4. Presents extracted data to the user for confirmation
5. Auto-populates WME venue fields with confirmed data

**Key Requirement**: Direct website crawling (no external APIs like Google Places)

## Development History

### Version 0.1.0 - Proof of Concept (2025-01-16)

**Goal**: Demonstrate core venue scanning and data analysis capabilities

**Features Implemented**:
1. ✅ Basic userscript structure with proper metadata
2. ✅ WME integration and initialization
3. ✅ Venue scanning engine
   - Scans all loaded venues in visible area
   - Filters out RPPs (residential places)
   - Stores results in Map for efficient lookups
4. ✅ Missing data detection
   - Checks: Name, Phone, Website, Description
   - Identifies venues without any contact information
5. ✅ Severity classification system
   - Complete (Green): All data present
   - Minor (Yellow): 1-2 fields missing, has contact info
   - Major (Red): 3+ fields missing, has contact info
   - Critical (Dark Red): No contact information at all
6. ✅ User interface
   - Draggable panel (top-right corner)
   - Scan button
   - Statistics display
   - Venue list (showing worst 20)
   - Color-coded severity indicators
7. ✅ Statistics calculation
   - Breakdown by severity level
   - Total venue count

**Technical Decisions**:
- Used `Map` for storing scanned venues (efficient lookups by venue ID)
- Severity based on both quantity and quality of missing data
- Contact info (phone OR website) is key differentiator
- Limited UI list to 20 venues to prevent performance issues
- Made panel draggable for user customization

**Code Structure**:
```
├── Constants (60 lines)
│   ├── SEVERITY enum
│   └── REQUIRED_FIELDS array
├── State (10 lines)
│   └── scannedVenues Map
├── Utilities (30 lines)
│   ├── log()
│   └── isEmpty()
├── Venue Analysis (80 lines)
│   ├── analyzeVenue()
│   ├── getSeverityLabel()
│   └── getSeverityColor()
├── Scanning (60 lines)
│   ├── scanLoadedVenues()
│   └── getStatistics()
├── UI (250 lines)
│   ├── createUI()
│   ├── makeDraggable()
│   ├── updateStatsDisplay()
│   └── updateVenueList()
└── Initialization (30 lines)
    └── init()
```

**Total Lines**: ~520 lines (including comments)

**Documentation**:
- ✅ JSDoc for all major functions
- ✅ Inline comments explaining logic
- ✅ POC-README.md with usage instructions
- ✅ SESSION_PROGRESS.md (this file)

**Testing Status**: Not yet tested in live WME environment

**Known Limitations**:
- Only scans on button click (not automatic)
- No visual highlighting on map
- No persistent storage
- No web scraping yet

---

## Planned Features (Future Versions)

### Version 0.2.0 - Visual Highlighting (Planned)

**Goals**:
1. Add OpenLayers layer for venue highlighting
2. Color-code venues on map by severity
3. Automatic scanning on map data load (mergeend event)
4. Toggle button to show/hide highlights

**Technical Approach**:
- Create custom OpenLayers.Layer.Vector
- Use OpenLayers.Rule with filters based on custom venue property
- Similar to WMEPH highlighting system
- Store severity on `venue.attributes.crawlerSeverity`

**Reference**: See WMEPH lines 2614-2737 for OpenLayers styling approach

---

### Version 0.3.0 - Google Search Integration (Planned)

**Goals**:
1. Add "Search" button next to venues in list
2. Perform Google search for venue name + location
3. Extract first result URL
4. Display URL to user for confirmation

**Technical Approach**:
```javascript
function searchGoogle(venueName, address) {
    const query = encodeURIComponent(`${venueName} ${address}`);
    const searchUrl = `https://www.google.com/search?q=${query}`;

    GM_xmlhttpRequest({
        method: 'GET',
        url: searchUrl,
        onload: function(response) {
            // Parse HTML to extract first result URL
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            // Extract URL from search results
        }
    });
}
```

**Challenges**:
- Google search results are heavily JavaScript-dependent
- May need to use Google Custom Search API or alternative approach
- Rate limiting considerations

---

### Version 0.4.0 - Web Scraping Engine (Planned)

**Goals**:
1. Fetch website HTML using GM_xmlhttpRequest
2. Extract data using multiple methods:
   - Schema.org JSON-LD (highest priority)
   - Microdata meta tags
   - Regex patterns (fallback)
3. Display extracted data in confirmation dialog

**Technical Approach**:

**1. Schema.org JSON-LD Extraction**:
```javascript
function extractSchemaOrg(html) {
    const scriptTags = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
    if (!scriptTags) return null;

    for (const tag of scriptTags) {
        const json = tag.replace(/<script.*?>/, '').replace(/<\/script>/, '');
        try {
            const data = JSON.parse(json);
            if (data['@type'] === 'LocalBusiness' || data['@type'] === 'Restaurant') {
                return {
                    name: data.name,
                    phone: data.telephone,
                    address: data.address?.streetAddress,
                    website: data.url,
                    description: data.description,
                    hours: data.openingHoursSpecification
                };
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}
```

**2. Microdata Extraction**:
```javascript
function extractMicrodata(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return {
        phone: doc.querySelector('meta[property="business:contact_data:phone_number"]')?.content,
        website: doc.querySelector('meta[property="business:contact_data:website"]')?.content,
        address: doc.querySelector('meta[property="business:contact_data:street_address"]')?.content
    };
}
```

**3. Regex Fallback**:
```javascript
function extractWithRegex(html) {
    return {
        phone: html.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/)?.[0],
        email: html.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0]
    };
}
```

**4. Combined Extraction**:
```javascript
function extractVenueData(websiteUrl) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: websiteUrl,
        onload: function(response) {
            const html = response.responseText;

            // Try methods in order of reliability
            let data = extractSchemaOrg(html);
            if (!data) data = extractMicrodata(html);
            if (!data) data = extractWithRegex(html);

            // Show confirmation dialog
            showConfirmationDialog(data);
        },
        onerror: function(error) {
            logError('Failed to fetch website:', error);
        }
    });
}
```

---

### Version 0.5.0 - Data Confirmation UI (Planned)

**Goals**:
1. Modal dialog showing extracted data
2. Editable fields for user corrections
3. "Apply" button to update venue
4. "Cancel" button to discard

**Technical Approach**:
```javascript
function showConfirmationDialog(extractedData, venue) {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Confirm Extracted Data</h3>
                <form id="data-form">
                    <label>Name: <input name="name" value="${extractedData.name || ''}"></label>
                    <label>Phone: <input name="phone" value="${extractedData.phone || ''}"></label>
                    <label>Website: <input name="url" value="${extractedData.website || ''}"></label>
                    <label>Description: <textarea name="description">${extractedData.description || ''}</textarea></label>
                    <button type="submit">Apply to Venue</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </form>
            </div>
        </div>
    `;

    modal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        applyDataToVenue(venue, new FormData(e.target));
        closeModal();
    });

    document.body.appendChild(modal);
}
```

---

### Version 0.6.0 - Venue Updates (Planned)

**Goals**:
1. Apply confirmed data to venue using WME Actions system
2. Proper undo/redo support
3. Success notification

**Technical Approach**:
```javascript
function applyDataToVenue(venue, formData) {
    const UpdateObject = require('Waze/Action/UpdateObject');
    const MultiAction = require('Waze/Action/MultiAction');

    const actions = [];
    const newAttributes = {};

    // Build attribute updates
    for (const [key, value] of formData.entries()) {
        if (value && value.trim() !== '') {
            newAttributes[key] = value.trim();
        }
    }

    // Create update action
    if (Object.keys(newAttributes).length > 0) {
        actions.push(new UpdateObject(venue, newAttributes));

        // Apply actions
        W.model.actionManager.add(new MultiAction(actions));

        log(`Updated venue: ${venue.attributes.name}`);
        showNotification('Venue updated successfully!');
    }
}
```

**CRITICAL**: Must use Actions system, not direct attribute modification!

---

## Technical Reference

### WME API Patterns Used

1. **Venue Access**:
   ```javascript
   W.model.venues.getObjectArray() // Get loaded venues
   ```

2. **Event Listeners**:
   ```javascript
   W.model.events.register('mergeend', null, callback) // Map data loaded
   ```

3. **Actions System** (for future use):
   ```javascript
   const UpdateObject = require('Waze/Action/UpdateObject');
   W.model.actionManager.add(new UpdateObject(venue, { phone: '555-1234' }));
   ```

### External References

- **WMEPH Highlighting**: wme.txt lines 2614-2737 (OpenLayers styling)
- **WMEPH Severity System**: wme.txt lines 325-334 (severity enum)
- **WME PIE**: reference-scripts (venue handling patterns)

---

## Development Notes

### Why Direct Web Scraping?

User explicitly stated: "If we are to do this we would need to crawl the websites directly"

**Advantages**:
- No API rate limits
- No API costs
- No API key management
- Access to all publicly available data

**Challenges**:
- CORS (solved with GM_xmlhttpRequest)
- Varying HTML structures (solved with multiple extraction methods)
- Rate limiting from websites (need to be respectful)
- JavaScript-rendered content (may need alternative approach)

### Design Philosophy

1. **User Control**: Always show data before applying
2. **Transparency**: Log all actions and errors
3. **Reversibility**: Use WME Actions system for undo/redo
4. **Efficiency**: Cache results, scan intelligently
5. **Safety**: Never auto-apply without confirmation

---

## Version History Summary

| Version | Status | Description |
|---------|--------|-------------|
| 0.1.0   | ✅ Complete | POC - Venue scanning and analysis |
| 0.2.0   | 📋 Planned | Visual highlighting on map |
| 0.3.0   | 📋 Planned | Google search integration |
| 0.4.0   | 📋 Planned | Web scraping engine |
| 0.5.0   | 📋 Planned | Data confirmation UI |
| 0.6.0   | 📋 Planned | Venue update system |
| 1.0.0   | 📋 Future | Production release |

---

## Conclusion

Version 0.1.0 successfully demonstrates:
- ✅ Feasibility of venue scanning
- ✅ Accurate missing data detection
- ✅ Severity classification system
- ✅ Clean, functional UI

**Next Priority**: Implement visual highlighting (v0.2.0) to provide on-map feedback

This POC proves the concept is viable and provides a solid foundation for adding web scraping and automated data extraction.
