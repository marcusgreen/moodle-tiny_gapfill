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
import {wrapContent} from 'tiny_gapfill/Item';
import ModalFactory from 'core/modal_factory';
import ModalEvents from 'core/modal_events';
import {tinymce} from 'editor_tiny/loader';

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
    const clickArea = document.createElement('div');
    clickArea.id = editor.id + '_editable';
    clickArea.contentEditable = 'true';
    clickArea.className = 'clickarea';

    // Copy the text from the TinyMCE editor into the editable div
    const editorContent = editor.getContent();
    const processedContent = processGapfillContent(editorContent);
    clickArea.innerHTML = processedContent;

    // Create a header div at the top of clickArea
    const headerDiv = document.createElement('div');
    headerDiv.style.width = '100%';
    headerDiv.style.height = '40px';
    headerDiv.style.backgroundColor = '#f8f9fa';
    headerDiv.style.borderBottom = '1px solid #dee2e6';
    headerDiv.style.padding = '5px';
    headerDiv.style.boxSizing = 'border-box';

    // Add a close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'btn btn-secondary closebutton';
    closeButton.style.float = 'left';
    closeButton.onclick = () => {
        // Restore TinyMCE when close button is clicked
        restoreDefaultState(editor);
        editor.mode.set('design');
        isGapfillModeActive = false;

        // Remove the editable div
        clickArea.remove();

        // Show TinyMCE again
        editor.getContainer().style.display = 'block';
    };

    // Add click event listener to show modal when clickArea is clicked
    clickArea.addEventListener('click', (event) => {
        // Check if the click target is a span (gap)
        if (event.target.tagName === 'SPAN') {
            const gapText = event.target.textContent;
            showGapSettingsModal(gapText);
        }
    });

// Insert the editable div in place of TinyMCE
      container.parentNode.insertBefore(clickArea, container.nextSibling);
      // Insert the header div at the top of clickArea
      clickArea.insertBefore(headerDiv, clickArea.firstChild);
      // Insert the close button in the clickArea (not in the header div)
      clickArea.appendChild(closeButton);
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

/**
 * Show gap settings modal for a specific gap
 * @param {string} gapText - The text content of the gap
 */
const showGapSettingsModal = async(gapText) => {
    const bodyContent = `
        <div class="container-fluid">
            <div class="form-group row mb-3">
                <label for="gapfill-feedback-correct" class="col-md-12 col-form-label font-weight-bold">Feedback
                    for correct.</label>
                <div class="col-md-12">
                    <textarea id="gapfill-feedback-correct" class="form-control" rows="6"></textarea>
                </div>
            </div>
            <div class="form-group row mb-3">
                <label for="gapfill-feedback-incorrect" class="col-md-12 col-form-label font-weight-bold">Feedback
                    for incorrect.</label>
                <div class="col-md-12">
                    <textarea id="gapfill-feedback-incorrect" class="form-control" rows="6"></textarea>
                </div>
            </div>
        </div>
    `;

    // Create and show modal using ModalFactory
    const modal = await ModalFactory.create({
        type: ModalFactory.types.SAVE_CANCEL,
        title: `Add Gap settings: ${gapText}`,
        body: bodyContent,
        large: true,
    });

    // Show the modal
    modal.show();

    // After modal is shown, initialize TinyMCE editors for the feedback fields
    modal.getRoot().on(ModalEvents.shown, async() => {
        // Wait a moment for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            // Get the TinyMCE instance from the global scope
            const tinyMCE = window.tinymce || tinymce;

            if (!tinyMCE) {
                console.error('TinyMCE not found in global scope');
                return;
            }

            // Initialize TinyMCE for feedback correct - this creates a new instance
            await tinyMCE.init({
                selector: '#gapfill-feedback-correct',
                menubar: false,
                toolbar: 'undo redo | formatselect | bold italic | bullist numlist | link unlink',
                plugins: 'lists link',
                setup: (ed) => {
                    ed.on('init', () => {
                        ed.setContent('Quite correct');
                    });
                }
            });

            // Initialize TinyMCE for feedback incorrect - this creates another new instance
            await tinyMCE.init({
                selector: '#gapfill-feedback-incorrect',
                menubar: false,
                toolbar: 'undo redo | formatselect | bold italic | bullist numlist | link unlink',
                plugins: 'lists link',
                setup: (ed) => {
                    ed.on('init', () => {
                        ed.setContent('Not Correct');
                    });
                }
            });
        } catch (error) {
            console.error('Failed to initialize TinyMCE editors:', error);
        }
    });
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
