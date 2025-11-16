# WME Venue Data Crawler

A Tampermonkey userscript that automatically identifies venues missing data in Waze Map Editor and crawls their websites to extract business information.

## Project Vision

This script combines venue scanning capabilities (similar to WME Place Harmonizer) with automated web scraping to help editors quickly populate venue data.

### Planned Features

- **Venue Scanning**:
  - Scan visible venues on the map
  - Identify venues missing: address, phone, website, hours, description
  - Visual highlighting of venues needing work (using OpenLayers styling)
  - Severity levels for prioritization

- **Automated Data Extraction**:
  - Direct website crawling (no external APIs)
  - Schema.org JSON-LD parsing for structured data
  - Microdata extraction from meta tags
  - Regex fallback patterns for phone, address, email
  - Business hours detection

- **User Workflow**:
  - Click on highlighted venue
  - Script automatically searches Google for venue website
  - Crawls website and extracts available data
  - Presents extracted data in confirmation UI
  - User reviews and confirms before applying
  - Auto-populate WME venue fields

- **Data Extraction Techniques**:
  - Schema.org LocalBusiness JSON-LD
  - Open Graph meta tags
  - Microdata properties
  - Pattern matching for common formats
  - CORS bypass using GM_xmlhttpRequest

## Current Version: 0.1.0 (Proof of Concept)

### ✅ Implemented Features (v0.1.0)

- **Venue Scanning**: Scan all loaded venues in visible area
- **Missing Data Detection**: Identify venues missing name, phone, website, description
- **Severity Classification**:
  - Complete (Green) - All data present
  - Minor (Yellow) - 1-2 fields missing
  - Major (Red) - 3+ fields missing
  - Critical (Dark Red) - No contact info
- **Interactive UI**: Draggable panel with statistics and venue list
- **Statistics Display**: Breakdown by severity level
- **Color-Coded Indicators**: Visual severity representation

### 🚧 In Development

- Visual highlighting on map (OpenLayers layer)
- Automatic scanning on map movement
- Web scraping functionality
- Google search integration
- Data extraction and confirmation UI

See [POC-README.md](POC-README.md) for detailed usage instructions and [SESSION_PROGRESS.md](SESSION_PROGRESS.md) for development roadmap.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Open `wme-venue-data-crawler-v0.1.0.user.js` in Tampermonkey
3. Click "Install"
4. Navigate to [Waze Map Editor](https://www.waze.com/editor)

## Documentation

- See [../WME-API-GUIDE.md](../WME-API-GUIDE.md) for WME API reference
- See [../WAZEWRAP-EXPLAINED.md](../WAZEWRAP-EXPLAINED.md) for WazeWrap library
- See [../reference-scripts/](../reference-scripts/) for example scripts:
  - WME Place Harmonizer (highlighting system reference)
  - WME Place Interface Enhancements (venue handling reference)

## Development Notes

### Key Technical Approaches

**Venue Detection** (from WMEPH analysis):
- Use `W.model.venues.getObjectArray()` for loaded venues
- Listen to `mergeend` event for new venue loads
- Store results in cache with venue.updatedOn for invalidation
- Set custom property `venue.attributes.crawlerSeverity` for styling

**Highlighting System** (from WMEPH analysis):
- Create OpenLayers.Rule with filters based on severity property
- Apply fill colors and stroke styles
- Severity levels: GREEN (complete), YELLOW (minor issues), RED (major issues)

**Web Scraping**:
- GM_xmlhttpRequest for CORS bypass
- Parse Schema.org JSON-LD first (most reliable)
- Fall back to microdata meta tags
- Final fallback to regex patterns
- Always present data for user confirmation

## Reference Materials

- [WME Place Harmonizer](../reference-scripts/) - Venue highlighting reference
- [WME Place Interface Enhancements](../reference-scripts/) - Venue UI reference
- [Style Guide](../STYLE_GUIDE.md) - Coding standards

## Future Development

This project will follow the same development practices as RPP-Auto-Fixer:
- Comprehensive JSDoc documentation
- Version tracking in SESSION_PROGRESS.md
- ESLint code quality checks
- User guide and technical documentation

## License

This script is provided as-is for Waze editing community use.
