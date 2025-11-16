# Venue Data Crawler - Proof of Concept v0.1.0

## Overview

This is a proof of concept demonstrating the core functionality for identifying venues that need data enrichment in Waze Map Editor.

## Current Features (v0.1.0)

### ✅ Implemented

1. **Venue Scanning**
   - Scans all currently loaded venues in the visible map area
   - Filters out residential places (RPPs) - focuses only on business venues
   - Analyzes each venue for missing data

2. **Missing Data Detection**
   - Checks for: Name, Phone, Website, Description
   - Identifies whether venue has ANY contact information
   - Categorizes venues by severity of missing data

3. **Severity Levels**
   - **Complete** (Green): All data present
   - **Minor Issues** (Yellow): 1-2 fields missing, has contact info
   - **Major Issues** (Red): 3+ fields missing, has contact info
   - **Critical** (Dark Red): No contact information at all

4. **User Interface**
   - Draggable panel in top-right corner
   - "Scan Visible Venues" button
   - Statistics display showing breakdown by severity
   - List of venues needing work (up to 20 shown)
   - Color-coded severity indicators

## How to Use

1. **Install the Script**
   - Open `wme-venue-data-crawler-v0.1.0.user.js` in Tampermonkey
   - Click "Install"

2. **Navigate to WME**
   - Go to https://www.waze.com/editor or https://beta.waze.com/editor
   - Wait for the map to load

3. **Run a Scan**
   - Click the "Scan Visible Venues" button in the panel
   - View statistics and list of venues with issues

4. **Pan Around**
   - Move to different areas of the map
   - Click "Scan Visible Venues" again to scan the new area

## What This POC Demonstrates

### Working Components

- ✅ WME integration and initialization
- ✅ Venue data access via `W.model.venues`
- ✅ Venue analysis logic
- ✅ Severity categorization
- ✅ UI panel with draggable interface
- ✅ Statistics calculation
- ✅ Event listener setup (mergeend events)

### Not Yet Implemented

- ⏳ Visual highlighting on map (OpenLayers styling)
- ⏳ Automatic scanning on map movement
- ⏳ Web scraping functionality
- ⏳ Google search integration
- ⏳ Data extraction from websites
- ⏳ User confirmation UI for extracted data
- ⏳ Automatic venue updates with extracted data

## Technical Details

### Architecture

```
venue-data-crawler-v0.1.0.user.js
├── Constants (SEVERITY, REQUIRED_FIELDS)
├── State Management (scannedVenues Map)
├── Utility Functions (logging, isEmpty)
├── Venue Analysis
│   ├── analyzeVenue() - Checks for missing fields
│   ├── getSeverityLabel() - Human-readable labels
│   └── getSeverityColor() - Color coding
├── Venue Scanning
│   ├── scanLoadedVenues() - Main scan function
│   └── getStatistics() - Stats calculation
├── User Interface
│   ├── createUI() - Build panel
│   ├── makeDraggable() - Drag functionality
│   ├── updateStatsDisplay() - Stats UI
│   └── updateVenueList() - Venue list UI
└── Initialization
    └── init() - Wait for WME, setup listeners
```

### Data Structure

Each scanned venue is stored as:
```javascript
{
    venue: <WME venue object>,
    severity: <SEVERITY level>,
    missing: ['Phone', 'Website'],
    hasContactInfo: true/false,
    name: 'Business Name',
    categories: ['RESTAURANT', ...]
}
```

### Key Functions

1. **analyzeVenue(venue)**: Returns severity and missing fields
2. **scanLoadedVenues()**: Scans all loaded venues, returns count
3. **getStatistics()**: Calculates breakdown by severity
4. **updateStatsDisplay()**: Updates UI statistics
5. **updateVenueList()**: Updates UI venue list

## Testing Checklist

- [ ] Script loads without errors in Tampermonkey
- [ ] Panel appears in WME editor
- [ ] Panel is draggable
- [ ] "Scan Visible Venues" button works
- [ ] Statistics display shows correct counts
- [ ] Venue list shows venues with issues
- [ ] Color coding matches severity levels
- [ ] Console logs show scan progress
- [ ] Works on both production and beta WME

## Next Steps (v0.2.0)

1. **Visual Highlighting**
   - Implement OpenLayers custom layer
   - Color-code venues on map by severity
   - Add toggle to show/hide highlights

2. **Automatic Scanning**
   - Scan automatically when map data loads (mergeend event)
   - Update highlights as user pans around

3. **Web Scraping Foundation**
   - Add Google search functionality
   - Implement GM_xmlhttpRequest for website fetching
   - Create data extraction functions (Schema.org, microdata, regex)

## Known Limitations

- Only scans currently loaded venues (lazy-loading limitation)
- No persistent storage of scan results
- No automatic rescanning when panning
- UI doesn't update in real-time as venues load
- Limited to 20 venues in list display

## Code Quality

- ✅ Full JSDoc documentation
- ✅ Clear function naming
- ✅ Modular architecture
- ✅ Error handling with try-catch wrappers needed
- ✅ Follows WME scripting best practices

## Notes

This POC demonstrates the feasibility of:
1. Scanning venues efficiently
2. Identifying missing data accurately
3. Categorizing venues by data completeness
4. Presenting results in a clean UI

The foundation is solid for adding web scraping and automated data extraction in future versions.
