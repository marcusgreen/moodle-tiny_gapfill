// This file is part of Moodle - http://moodle.org/
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

// 🛑 STATE VARIABLE: Tracks whether the custom mode is active.
let isGapfillModeActive = false;

// 💾 CACHE: Store the clean, original HTML before highlighting.
let cachedOriginalContent = '';

/**
 * Apply inverse highlighting to text nodes (grey background for all, white for gaps)
 * This uses DOM traversal to preserve existing formatting
 * @param {Object} editor - TinyMCE editor instance
 */
const applyGapfillHighlight = (editor) => {
    const body = editor.getBody();

    // 1. Set the overall editor body background to Grey (this covers all surrounding text and spaces)
    body.style.backgroundColor = '#e0e0e0';

    const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const nodesToProcess = [];
    let node;

    // Collect all text nodes
    node = walker.nextNode();
    while (node) {
        nodesToProcess.push(node);
        node = walker.nextNode();
    }

    // Process each text node
    nodesToProcess.forEach(textNode => {
        const text = textNode.textContent;
        const regex = /\[([^\]]+)\]/g;

        if (regex.test(text)) {
            // Create a temporary container
            const span = document.createElement('span');

            // 2. Set the background of the bracketed content to WHITE to clear the grey
            span.innerHTML = text.replace(/\[([^\]]+)\]/g,
                '<span class="gapfill-highlight" style="background-color: white;">[$1]</span>');

            // Replace the text node with the new content
            const parent = textNode.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, textNode);
            }
            parent.removeChild(textNode);
        }
    });
};

/**
 * Restores the editor to its original content and default background.
 * @param {Object} editor - TinyMCE editor instance
 */
const restoreDefaultState = (editor) => {
    // 1. Restore the original HTML content to clean up inserted spans
    editor.setContent(cachedOriginalContent);

    // 2. Restore the editor body's default background
    editor.getBody().style.backgroundColor = '';
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

        // 🛑 FIX: Use addToggleButton for proper toggle state management.
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

                    // 3. 🛑 FIX: Explicitly disable the document's designMode to stop typing.
                    // This avoids setting the full editor mode to 'readonly', which disables the toolbar.
                    editor.getDoc().designMode = 'Off';

                    isGapfillModeActive = true;
                    api.setActive(true); // Visually set the button as pressed
                } else {
                    // DEACTIVATE MODE

                    // 1. Restore the original HTML and background
                    restoreDefaultState(editor);

                    // 2. 🛑 FIX: Re-enable the document's designMode to allow typing.
                    editor.getDoc().designMode = 'On';

                    isGapfillModeActive = false;
                    api.setActive(false); // Visually set the button as unpressed
                }
            },
            onSetup: (api) => {
                // Ensure the button is always enabled, overriding the editor's default behavior.
                api.setEnabled(true);
                api.setActive(isGapfillModeActive);

                return () => {}; // Cleanup function
            }
        });

        // Register the Menu item.
        editor.ui.registry.addMenuItem(buttonName, {
            icon,
            text: buttonTitle,
            onAction: () => {
                // The menu item logic remains the same.
                if (!isGapfillModeActive) {
                    // ACTIVATE MODE
                    cachedOriginalContent = editor.getContent();
                    applyGapfillHighlight(editor);
                    editor.getDoc().designMode = 'Off'; // Disable typing
                    isGapfillModeActive = true;
                } else {
                    // DEACTIVATE MODE
                    restoreDefaultState(editor);
                    editor.getDoc().designMode = 'On'; // Enable typing
                    isGapfillModeActive = false;
                }
            },
        });
    };
};