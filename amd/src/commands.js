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
import ModalFactory from 'core/modal_factory';
import ModalEvents from 'core/modal_events';
import {getTinyMCE} from 'editor_tiny/loader';

// 🛑 STATE VARIABLE: Tracks whether the custom mode is active.
let isGapfillModeActive = false;

// 💾 CACHE: Store the clean, original HTML before highlighting.
let cachedOriginalContent = '';

// 🎯 CLICK HANDLER: Store reference to the click handler for cleanup
let clickHandler = null;

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

            // 2. Set the background of the bracketed content to WHITE and add clickable class
            span.innerHTML = text.replace(/\[([^\]]+)\]/g,
                '<span class="gapfill-highlight gapfill-clickable" style="background-color: white; cursor: pointer;">[$1]</span>');

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
 * Display a modal dialog with gap settings - similar to the image provided
 * @param {String} gapText - The text content of the clicked gap
 * @param {Object} editor - TinyMCE editor instance
 */
const displayGapDialog = async(gapText, editor) => {
    // Get string for modal title
    const modalTitle = await getString('gapsettings', component);

    // Get TinyMCE instance
    const tinymce = await getTinyMCE();

    // Create modal body HTML with TinyMCE editors for feedback fields
    const bodyContent = `
        <div class="container-fluid">
            <div class="form-group row mb-3">
                <label class="col-md-12 col-form-label font-weight-bold">Feedback for correct.</label>
                <div class="col-md-12">
                    <div id="gapfill-feedback-correct" class="form-control" style="min-height: 150px; border: 1px solid #ced4da;">
                    </div>
                </div>
            </div>
            <div class="form-group row mb-3">
                <label class="col-md-12 col-form-label font-weight-bold">Feedback for incorrect.</label>
                <div class="col-md-12">
                    <div id="gapfill-feedback-incorrect" class="form-control" style="min-height: 150px; border: 1px solid #ced4da;">
                    </div>
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
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize TinyMCE for feedback correct
        tinymce.init({
            selector: '#gapfill-feedback-correct',
            inline: true,
            menubar: false,
            toolbar: 'undo redo | formatselect | bold italic | bullist numlist | link unlink',
            plugins: 'lists link',
            setup: (ed) => {
                ed.on('init', () => {
                    ed.setContent('');
                });
            }
        });

        // Initialize TinyMCE for feedback incorrect
        tinymce.init({
            selector: '#gapfill-feedback-incorrect',
            inline: true,
            menubar: false,
            toolbar: 'undo redo | formatselect | bold italic | bullist numlist | link unlink',
            plugins: 'lists link',
            setup: (ed) => {
                ed.on('init', () => {
                    ed.setContent('');
                });
            }
        });
    });

    // Handle save button
    modal.getRoot().on(ModalEvents.save, () => {
        // Get content from TinyMCE editors
        let correctFeedback = '';
        let incorrectFeedback = '';

        const correctEditor = tinymce.get('gapfill-feedback-correct');
        const incorrectEditor = tinymce.get('gapfill-feedback-incorrect');

        if (correctEditor) {
            correctFeedback = correctEditor.getContent();
        }
        if (incorrectEditor) {
            incorrectFeedback = incorrectEditor.getContent();
        }

        // Here you would save the feedback data
        // For now, just log it
        window.console.log('Gap:', gapText);
        window.console.log('Correct feedback:', correctFeedback);
        window.console.log('Incorrect feedback:', incorrectFeedback);
    });

    // Handle modal cleanup
    modal.getRoot().on(ModalEvents.hidden, () => {
        // Clean up TinyMCE editors
        const correctEditor = tinymce.get('gapfill-feedback-correct');
        const incorrectEditor = tinymce.get('gapfill-feedback-incorrect');

        if (correctEditor) {
            correctEditor.remove();
        }
        if (incorrectEditor) {
            incorrectEditor.remove();
        }
        modal.destroy();
    });
};

/**
 * Register click event handler for gapfill items
 * @param {Object} editor - TinyMCE editor instance
 */
const registerClickHandler = (editor) => {
    clickHandler = (e) => {
        const target = e.target;

        // Check if clicked element has the gapfill-clickable class
        if (target.classList.contains('gapfill-clickable')) {
            e.preventDefault();
            e.stopPropagation();

            // Extract the text content (including brackets)
            const fullText = target.textContent;

            // Extract just the content between brackets
            const match = fullText.match(/\[([^\]]+)\]/);
            const gapText = match ? match[1] : fullText;

            // Show modal dialog similar to the image
            displayGapDialog(gapText, editor);
        }
    };

    // Add click event listener to editor body
    editor.getBody().addEventListener('click', clickHandler);
};

/**
 * Unregister click event handler
 * @param {Object} editor - TinyMCE editor instance
 */
const unregisterClickHandler = (editor) => {
    if (clickHandler) {
        editor.getBody().removeEventListener('click', clickHandler);
        clickHandler = null;
    }
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

    // 3. Remove click handler
    unregisterClickHandler(editor);
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

                    // 3. Register click handler for bracketed content
                    registerClickHandler(editor);

                    // 4. SET READ-ONLY MODE (This is the only reliable way to disable typing)
                    editor.mode.set('readonly');

                    // 5. FIX: Re-enable the button immediately after TinyMCE disables it.
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
                // NOTE: We only need to check if it should be active; the enabling/disabling
                // is handled within onAction now for reliability in readonly mode.
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
                    registerClickHandler(editor);
                    editor.mode.set('readonly'); // Disable typing
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