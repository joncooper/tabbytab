# TabbyTab - Chrome Extension for Tab Management

## Project Overview
TabbyTab is a Chrome extension for efficient tab management with history tracking. It helps users manage their browser tabs by providing features to organize, close, and track tab history.

## Features
- Group tabs by window, domain, or title
- Close individual tabs, groups, or entire windows
- Protected URL patterns (using regex) to prevent accidental tab closure
- Tab history tracking with grouping by time, window, domain, or title
- Search functionality for both active tabs and history
- Expand/collapse tab groups

## Technical Stack
- Preact for UI components (3KB alternative to React)
- TypeScript for type safety
- Vite for build system
- Chrome Extension Manifest V3

## Installation

1. Clone this repository or download the source code
2. Add icon files to the `icons/` directory:
   - You need icon16.png (16x16 pixels) and icon48.png (48x48 pixels)
   - Recommended free icon sources:
     - [Material Design Icons](https://material.io/resources/icons/) - Minimal, clean icons
     - [Feather Icons](https://feathericons.com) - Light, simple icons
     - [Font Awesome Free](https://fontawesome.com/icons?d=gallery&p=1&m=free) - Popular icon set with browser tab icons
   - Download icon files using the included script:
     ```
     chmod +x download-icons.sh
     ./download-icons.sh
     ```
   - Or use any tab-related icons from your preferred source
3. Install dependencies:
   ```
   npm install
   ```
4. Build the extension:
   ```
   npm run build
   ```
5. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `dist` directory from the project

## Development Workflow

1. Make changes to the source code
2. Use our simplified build script which is more reliable:
   ```
   chmod +x build-fixed.sh
   ./build-fixed.sh
   ```
   This script will:
   - Install dependencies
   - Clean up previous build
   - Build TypeScript files
   - Bundle with esbuild (simpler and more reliable than Vite)
   - Copy static assets and update HTML files
   
   This approach bypasses Vite's complex bundling which can sometimes cause issues with Chrome extensions.

3. Alternatively, for the original build process:
   ```
   chmod +x build.sh
   ./build.sh
   ```

4. For quick development during active work, you can also use:
   ```
   npm run dev
   ```
   This will watch for changes and rebuild automatically, but you'll need to:
   - Copy the manifest.json to dist/ manually
   - Create the dist/icons directory and copy icons there
   - Reload the extension in Chrome

4. To test your changes:
   - If the extension is already loaded in Chrome:
     - Go to `chrome://extensions/`
     - Find TabbyTab in the list
     - Click the "Reload" icon (circular arrow)
   - If testing a new installation:
     - Follow the installation steps above

5. For debugging:
   - Open the extension popup
   - Right-click and select "Inspect" to open Chrome DevTools
   - The Console tab will show any error messages
   - You can add `console.log()` statements to debug your code

6. When you're satisfied with your changes, build the production version:
   ```
   ./build.sh
   ```

## Troubleshooting

### Build Issues
- **Missing dependencies**: Run `npm install` to ensure all dependencies are installed
- **TypeScript errors**: Check the specific error messages in the console and fix type issues
- **Vite config errors**: Make sure the vite.config.ts file is correctly set up and the plugins are configured properly

### Extension Issues
- **Extension not appearing in Chrome**: Check that you've loaded the correct directory (should be 'dist')
- **Icons not displaying**: Verify that icon files exist in the icons/ directory and are correctly referenced in the manifest.json
- **Tabs not showing**: Check if the extension has the necessary permissions in manifest.json ('tabs' and 'storage')
- **Protected patterns not working**: Ensure that the regular expressions you've entered are valid
- **Tab history not updating**: Check the background script console for errors by going to chrome://extensions, finding TabbyTab, and clicking "background page" under Inspect views

## Usage

1. Click on the TabbyTab icon in your browser's toolbar to open the tab management interface
2. Use the controls to:
   - Group tabs by window, domain, or title
   - Search for specific tabs
   - Expand or collapse tab groups
   - Close individual tabs or entire groups
3. Access the Protected Patterns page to set URL patterns that should be protected from accidental closure
4. View your tab history to see previously opened and closed tabs

## Roadmap
- Tab statistics and insights (most visited domains, time spent on tabs)
- Customizable keyboard shortcuts for quick tab navigation
- Tab session management - save and restore groups of tabs
- Tab suspension for inactive tabs to reduce memory usage
- Sync tab history and settings across devices
- Tab notes and tagging for better organization
- Focus mode - temporarily hide distracting tabs
- Integration with productivity tools and services
- Export tab history and sessions to various formats
- Smart tab suggestions based on browsing patterns
- Advanced search filters (by date range, frequency of visit, etc.)
- Visual tab organization with drag-and-drop interface
- Automated tab cleanup based on custom rules
- Tab bookmarking with custom categories
- Browser resource monitoring (memory/CPU usage per tab)
- Tab prioritization system for important tabs
- Split screen view for comparing tabs side by side
- Integration with calendar/task apps for context-aware tab suggestions
- Privacy mode for selected tab history exclusion
- Workspace profiles for different contexts (work, personal, research, etc.)

# PRIOR Q&A WITH COPILOT EDITS

## Copilot Asked

Before I start implementing TabbyTab, I have several clarifying questions:

What's the current project structure? Do you already have a Vite setup with Chrome extension manifest?

Do you have a specific UI design or layout in mind for the tab management interface?

How should tab history be stored - Chrome's storage API, IndexedDB, or another solution?

Which features should be prioritized for the initial implementation?

How should protected URL patterns be managed - through user settings or configuration?

Are there any requirements for history retention (time limit, entry count)?

Do you have icon assets ready, or should we create those?

For the tab history grouping, should users be able to switch between different grouping methods?

Any specific browser compatibility requirements beyond Chrome?

For the "pop up in a new tab" requirement, should this happen automatically on click or give users an option?

## My Response

Only README.md exists. 2. No. Make it modern, crisp, and highly usable 3. Your choice 4. Only the ones in the Features section of README.md 5. User facing UI 6. Forever 7. No, please create or download with wget 8. Yes 9. No 10. Automatically

