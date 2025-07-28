# Hello World Data Fetcher Chrome Extension

## Overview
The **Hello World Data Fetcher** is a Chrome extension that fetches product nomenclature data from the European Union's Access to Markets API and displays a "Hello World!" message on the active webpage. Upon clicking the extension's button, it retrieves hierarchical product data, processes it, and downloads the results as a JSON file named `data.json`.

## Features
- **Display Message**: Shows a "Hello World!" message on the active webpage or in the extension popup (if Chrome APIs are unavailable).
- **Data Fetching**: Retrieves product nomenclature data from the EU's Access to Markets API for Germany (DE) in English (EN).
- **Data Processing**: Organizes data into a structured format including HS codes, descriptions, sections, chapters, headings, and subheadings.
- **File Download**: Automatically downloads the processed data as a `data.json` file.
- **Rate Limiting Handling**: Implements random delays (2-5 seconds) between API requests to avoid rate-limiting issues (HTTP 429 errors).
- **Error Handling**: Ensures data is saved even if an error occurs during fetching.

## Installation
1. **Clone or Download the Repository**:
   - Clone this repository or download the source code as a ZIP file.
2. **Load the Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select the folder containing the extension files.
3. **Verify Files**:
   - Ensure the folder includes:
     - `manifest.json` (Chrome extension configuration)
     - `popup.html` (UI for the extension popup)
     - `popup.js` (The provided JavaScript code)
     - Any additional CSS or assets (if applicable)

## Usage
1. **Open the Extension**:
   - Click the extension icon in the Chrome toolbar to open the popup.
2. **Click the Button**:
   - Click the button (with `id="helloButton"`) in the popup.
   - This triggers:
     - A "Hello World!" message displayed on the active webpage (or in the popup if Chrome APIs are unavailable).
     - Fetching of product nomenclature data from the API.
3. **Download Data**:
   - The extension processes the API data and automatically downloads a `data.json` file to your downloads folder.
   - The JSON file contains structured data with fields: `hs_code`, `description`, `section`, `section_name`, `chapter`, `heading`, and `subheading`.
4. **Check Console**:
   - Open the Chrome Developer Tools (`Ctrl+Shift+J` or `Cmd+Option+J`) to view console logs for debugging or to confirm the download.

## How It Works
- **Popup Interaction**:
  - The extension listens for a click on the `helloButton` in the popup.
  - If Chrome APIs are available, it injects a content script into the active tab to display "Hello World!" and fetch data.
  - If Chrome APIs are unavailable (e.g., in a Canvas environment), it displays the message in the popup and proceeds with data fetching.
- **Data Fetching**:
  - The extension queries the EU's Access to Markets API (`https://trade.ec.europa.eu/access-to-markets/api/v2/nomenclature/products?country=DE&lang=EN`).
  - It recursively fetches child nodes of the product nomenclature hierarchy, handling rate limits with random delays.
  - Data is structured into an array of objects with relevant fields.
- **File Download**:
  - The processed data is saved as a JSON file using the Blob API and automatically downloaded.
  - The download occurs even if an error is encountered during fetching, ensuring partial data is preserved.

## File Structure
- `manifest.json`: Defines the extension's metadata, permissions, and popup configuration.
- `popup.html`: Contains the HTML for the popup UI, including the `helloButton`.
- `popup.js`: Contains the JavaScript logic for button clicks, API fetching, and data processing.
- `styles.css` (optional): Styles for the popup or message display (if applicable).

## Example Output
The downloaded `data.json` file will have a structure like:
```json
[
  {
    "hs_code": "010121",
    "description": "Live horses, pure-bred breeding animals",
    "section": "I",
    "section_name": "Live animals; animal products",
    "chapter": "01",
    "heading": "0101",
    "subheading": "21"
  },
  ...
]
```

## Notes
- **Permissions**: Ensure the `manifest.json` includes permissions for `activeTab`, `scripting`, and possibly `https://trade.ec.europa.eu/*` for API access.
- **Rate Limiting**: The API may return a `429 Too Many Requests` error. The extension mitigates this with random delays (2-5 seconds) between requests.
- **Error Handling**: If the API request fails (non-200 status or other errors), the extension still downloads any collected data.
- **Environment**: The extension includes a fallback for non-Chrome environments (e.g., Canvas), displaying messages in the popup instead of the webpage.

## Troubleshooting
- **No Download Occurs**:
  - Check the console for errors (e.g., API rate limits or network issues).
  - Ensure the API URL is accessible and not blocked by your network.
- **Message Not Displayed**:
  - Verify the `helloButton` ID exists in `popup.html`.
  - Check if Chrome APIs are available or if the fallback is being used.
- **Incomplete Data**:
  - The API may have rate limits or incomplete responses. Check the console for errors and verify the `data.json` content.

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -m 'Add YourFeature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a pull request.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

## Contact
For questions or support, please open an issue on the repository or contact the developer.