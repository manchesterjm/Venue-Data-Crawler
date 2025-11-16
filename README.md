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

## Current Version: 0.2.0 - Web Scraping Foundation

### ✅ Implemented Features

**v0.2.0 - Web Scraping:**
- **Google Search Integration**: Smart query building with city/state from WME
- **Automated Data Extraction**: Three-method extraction (Schema.org, Microdata, Regex)
- **Extract Data Button**: Per-venue extraction with real-time status
- **Category Hints**: 25+ category mappings for better search accuracy
- **Typo Tolerance**: Google auto-corrects venue name misspellings
- **Extraction Results**: Color-coded display of found/missing data
- **Enhanced Reports**: Downloaded reports include extracted data

**v0.1.x - Scanning Foundation:**
- **Venue Scanning**: Scan all loaded venues in visible area
- **Missing Data Detection**: Identify venues missing name, phone, website
- **Severity Classification**: 4-level system (Complete, Minor, Major, Critical)
- **Smart Filtering**: Excludes unnamed venues and natural features
- **Location Context**: Extracts city/state from WME for each venue
- **Interactive UI**: Draggable panel with statistics and venue list
- **Downloadable Reports**: Detailed text reports of scan results

### 🚧 Planned Features

- **v0.3.0**: Visual highlighting on map (OpenLayers layer)
- **v0.4.0**: Data confirmation UI with editing before applying
- **v0.5.0**: Automated venue updates using WME Actions system
- **v1.0.0**: Production release

See [SESSION_PROGRESS.md](SESSION_PROGRESS.md) for complete development roadmap.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. **Option A - From File**: Press Ctrl+O, open `wme-venue-data-crawler-v0.2.0.user.js`, click Install
3. **Option B - From GitHub**: Go to the [raw file](https://github.com/manchesterjm/Venue-Data-Crawler/blob/master/wme-venue-data-crawler-v0.2.0.user.js), click Raw, click Install
4. Navigate to [Waze Map Editor](https://www.waze.com/editor)

## Usage

1. **Scan venues**: Click "Scan Visible Venues" button
2. **Extract data**: Click "🔍 Extract Data" button next to any venue
3. **View results**: See extracted phone/website with color coding
4. **Download report**: Click "📥 Download Scan Report" for detailed results

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
