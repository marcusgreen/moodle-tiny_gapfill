// This file is part of Moodle - http://www.moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle. If not, see <http://www.gnu.org/licenses/>.
/**
 * Tiny gapfill commands
 *
 * @module      tiny_gapfill/commands
 * @copyright  2025 2024 Marcus Green
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import {getButtonImage} from 'editor_tiny/utils';
import {get_string as getString} from 'core/str';
import {component, buttonName, icon} from 'tiny_gapfill/common';
import {wrapContent} from 'tiny_gapfill/Item'; // <--- MODIFIED IMPORT

// 🛑 STATE VARIABLE: Tracks whether the custom mode is active.
let isGapfillModeActive = false;

// 💾 CACHE: Store the clean, original HTML before highlighting.
let cachedOriginalContent = '';

/**
 * Process text to wrap content within [ and ] delimiters with spans
 * @param {string} content - The HTML content to process
 * @returns {string} - The processed HTML content
 */
const processGapfillContent = (content) => {
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Process all text nodes in the DOM
    const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode()) !== null) {
        textNodes.push(node);
    }

    // Process each text node for gapfill patterns
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const regex = /\[([^\[\]]+)\]/g;
        let match;
        let lastIndex = 0;
        const fragments = [];

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                fragments.push(document.createTextNode(text.substring(lastIndex, match.index)));
            }

            // Create span for the gapfill
            const span = document.createElement('span');
            span.id = `id${fragments.length}`;
            span.textContent = match[0]; // Include the brackets
            fragments.push(span);

            lastIndex = regex.lastIndex;
        }

        // Add remaining text after the last match
        if (lastIndex < text.length) {
            fragments.push(document.createTextNode(text.substring(lastIndex)));
        }

        // Replace the text node with the processed fragments
        if (fragments.length > 0) {
            const parent = textNode.parentNode;
            fragments.forEach(fragment => {
                parent.insertBefore(fragment, textNode);
            });
            parent.removeChild(textNode);
        }
    });

    return tempDiv.innerHTML;
};

/**
 * Apply inverse highlighting to text nodes (grey background for all, white for gaps)
 * This uses DOM traversal to preserve existing formatting
 * @param {Object} editor - TinyMCE editor instance
 */
const applyGapfillHighlight = (editor) => {
    // Hide the TinyMCE instance by setting display to none
    editor.getContainer().style.display = 'none';

    // Create a new editable div in the position where TinyMCE was previously
    const container = editor.getContainer();
    const editableDiv = document.createElement('div');
    editableDiv.id = editor.id + '_editable';
    editableDiv.contentEditable = 'true';
    editableDiv.className = 'clickarea';

    // Copy the text from the TinyMCE editor into the editable div
    const editorContent = editor.getContent();
    const processedContent = processGapfillContent(editorContent);
    editableDiv.innerHTML = processedContent;

    // Add a close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'btn btn-secondary';
    closeButton.onclick = () => {
        // Restore TinyMCE when close button is clicked
        restoreDefaultState(editor);
        editor.mode.set('design');
        isGapfillModeActive = false;

        // Remove the editable div
        editableDiv.remove();

        // Show TinyMCE again
        editor.getContainer().style.display = 'block';
    };

    // Insert the editable div in place of TinyMCE
    container.parentNode.insertBefore(editableDiv, container.nextSibling);
    editableDiv.appendChild(closeButton);
};

/**
 * Restores the editor to its original content and default background.
 * @param {Object} editor - TinyMCE editor instance
 */
const restoreDefaultState = (editor) => {
    // 1. Restore the original HTML content to clean up inserted spans
    editor.setContent(cachedOriginalContent);

    // 2. Restore the editor body's default background by removing the tinybackground class
    editor.getBody().classList.remove('tinybackground');
};


export const getSetup = async() => {
    const [
        buttonTitle,
        buttonImage,
    ] = await Promise.all([
        getString('buttontitle', component),
        getButtonImage('icon', component),
    ]);
    return (editor) => {
        // Register the gapfill icon.
        editor.ui.registry.addIcon(icon, buttonImage.html);
        // Check whether we are editing a Gapfillquestion.
        const body = document.querySelector(
            'body#page-question-type-gapfill'
        );
        if (!body || editor.id.indexOf('questiontext') === -1) {
            return;
        }

        // Use addToggleButton for proper toggle state management.
        editor.ui.registry.addToggleButton(buttonName, {
            icon,
            tooltip: buttonTitle,
            onAction: (api) => {
                // 🛑 TOGGLE LOGIC HERE
                if (!isGapfillModeActive) {
                    // ACTIVATE MODE

                    // 1. Cache the clean HTML content *before* DOM manipulation
                    cachedOriginalContent = editor.getContent();

                    // 2. Apply highlighting (modifies the DOM)
                    applyGapfillHighlight(editor);

                    // 3. SET READ-ONLY MODE (This is the only reliable way to disable typing)
                   // editor.mode.set('readonly');

                    // 4. FIX: Re-enable the button immediately after TinyMCE disables it.
                    api.setEnabled(true);

                    isGapfillModeActive = true;
                    api.setActive(true); // Visually set the button as pressed
                } else {
                    // DEACTIVATE MODE

                    // 1. Restore the original HTML and background
                    restoreDefaultState(editor);

                    // 2. Set back to design (editable) mode
                    editor.mode.set('design');

                    isGapfillModeActive = false;
                    api.setActive(false); // Visually set the button as unpressed
                    // Button is now in 'design' mode, so its enabled state is managed by TinyMCE defaults.
                }
            },
            onSetup: (api) => {
                // Initial setup ensures the button is enabled and reflects initial state.
                if (isGapfillModeActive) {
                    // If the mode is active when loaded, ensure the button is enabled and active.
                    api.setEnabled(true);
                    api.setActive(true);
                } else {
                    api.setActive(false);
                }

                return () => {}; // Cleanup function
            }
        });

        // Register the Menu item.
        editor.ui.registry.addMenuItem(buttonName, {
            icon,
            text: buttonTitle,
            onAction: () => {
                // The menu item logic mirrors the button's logic.
                if (!isGapfillModeActive) {
                    // ACTIVATE MODE
                    cachedOriginalContent = editor.getContent();
                    applyGapfillHighlight(editor);
                    editor.mode.set('readonly'); // Disable typing
                    wrapContent(editor.getBody());
                    // No need to re-enable menu items, only toolbar buttons.
                    isGapfillModeActive = true;
                } else {
                    // DEACTIVATE MODE
                    restoreDefaultState(editor);
                    editor.mode.set('design'); // Enable typing
                    isGapfillModeActive = false;
                }
            },
        });
    };
};
