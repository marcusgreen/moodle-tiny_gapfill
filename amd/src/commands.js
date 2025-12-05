// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.
/**
 * Tiny gapfill commands
 *
 * @module     tiny_gapfill/commands
 * @copyright  2025 2024 Marcus Green
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import {getButtonImage} from 'editor_tiny/utils';
import {get_string as getString} from 'core/str';
import {component, buttonName, icon} from 'tiny_gapfill/common';

/**
 * Highlight text between brackets with grey background
 * This uses DOM traversal to preserve existing formatting
 * @param {Object} editor - TinyMCE editor instance
 */
const highlightGapfillText = (editor) => {
    const body = editor.getBody();
    const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const nodesToProcess = [];
    let node;

    // Collect all text nodes
    // FIX: Assign the node outside and check the condition inside the while loop
    node = walker.nextNode(); // Assign the first node
    while (node) { // Check if the node is not null/undefined
        nodesToProcess.push(node);
        node = walker.nextNode(); // Assign the next node
    }

    // Process each text node
    nodesToProcess.forEach(textNode => {
        const text = textNode.textContent;
        const regex = /\[([^\]]+)\]/g;

        if (regex.test(text)) {
            // Create a temporary container
            const span = document.createElement('span');
            span.innerHTML = text.replace(/\[([^\]]+)\]/g,
                '<span style="background-color: #e0e0e0;">[$1]</span>');

            // Replace the text node with the new content
            const parent = textNode.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, textNode);
            }
            parent.removeChild(textNode);
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
        // Register the toolbar Button.
        editor.ui.registry.addButton(buttonName, {
            icon,
            tooltip: buttonTitle,
            onAction: () => {
                // Highlight text between brackets with grey background
                highlightGapfillText(editor);
            },
        });
        // Register the Menu item.
        editor.ui.registry.addMenuItem(buttonName, {
            icon,
            text: buttonTitle,
            onAction: () => {
                // Highlight text between brackets with grey background
                highlightGapfillText(editor);
            },
        });
    };
};