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
 * JavaScript code for the gapfill question type.
 *
 * @copyright 2017 Marcus Green
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Interface for item settings
 * @typedef {Object} ItemSettings
 * @property {string} itemid - The item ID
 * @property {string|null} questionid - The question ID
 * @property {string} correctfeedback - Feedback for correct answers
 * @property {string} incorrectfeedback - Feedback for incorrect answers
 * @property {string} gaptext - The gap text without delimiters
 */

/**
 * Interface for feedback
 * @typedef {Object} Feedback
 * @property {string} correct - Correct feedback HTML
 * @property {string} incorrect - Incorrect feedback HTML
 */

/**
 * Pull data from hidden settings field on form
 * @returns {Array<ItemSettings>} Array of settings
 */
const getSettings = () => {
    const settings = [];
    const settingsInput = document.querySelector("[name='itemsettings']");
    const settingsdata = settingsInput?.value || "";

    if (settingsdata > "") {
        const obj = JSON.parse(settingsdata);
        for (const o in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, o)) {
                settings.push(obj[o]);
            }
        }

    }
    return settings;
};

/**
 * Converts a NodeList/HTMLCollection to a true Array.
 * @param {NodeList|HTMLCollection} obj
 * @return {Node[]}
 */
const toArray = (obj) => {
    return Array.prototype.slice.call(obj);
};

// --- Exported Utility Method ---

/**
 * Recursively wraps text nodes containing gaps (delimited content) with span elements.
 * These spans are given unique IDs for the item settings feature.
 *
 * @param {HTMLElement} el - The root element to process (e.g., TinyMCE editor body).
 * @param {number} [initialCount=0] - The starting index for item counting.
 * @param {Array<string>} [initialGaps=[]] - The list of previously seen gap texts.
 * @returns {void}
 */
export const wrapContent = (function() {
    // This private scope helps manage state across recursive calls.
    let count = 0;
    let gaps = [];

    const skipTags = {
        script: true,
        button: true,
        input: true,
        select: true,
        textarea: true,
        option: true,
    };

    return function(el) {
        // Reset counter and array if processing the main canvas/body
        if (el.id === 'id_itemsettings_canvas' || el.tagName.toLowerCase() === 'body') {
            count = 0;
            gaps = [];
        }

        const nodes = toArray(el.childNodes);
        const delimiterChars = document.getElementById('id_delimitchars').value;
        const leftDelimiter = delimiterChars.substring(0, 1);
        const rightDelimiter = delimiterChars.substring(1, 2);

        // Regex to find and split on the delimited gaps: /(\[.*?\])/g
        const gapRegex = new RegExp('(\\' + leftDelimiter + '.*?\\' + rightDelimiter + ')', 'g');
        const spanTemplate = document.createElement('span');

        for (let i = 0, iLen = nodes.length; i < iLen; i++) {
            const node = nodes[i];

            if (node.nodeType === 1 && !(node.tagName.toLowerCase() in skipTags)) {
                // Element node: recurse
                wrapContent(node);
            } else if (node.nodeType === 3) {
                // Text node: process for gaps
                const textChunks = node.data.split(gapRegex);
                const fragment = document.createDocumentFragment();

                for (let j = 0, jLen = textChunks.length; j < jLen; j++) {
                    const chunk = textChunks[j];
                    if (!chunk) {
                        continue;
                    }

                    if (gapRegex.test(chunk)) {
                        // This chunk is a gap: wrap it
                        const gapSpan = spanTemplate.cloneNode(false);
                        count++;
                        gapSpan.className = 'item gapfill-clickable'; // Added gapfill-clickable class

                        const item = new Item(chunk, delimiterChars);
                        if (item.gaptext) {
                            let instance = 0;
                            // Calculate instance number for repeated gaps
                            for (let k = 0; k < gaps.length; ++k) {
                                if (gaps[k] === item.gaptext) {
                                    instance++;
                                }
                            }

                            // Set unique ID for the gap: id[count]_[instance]
                            const itemId = 'id' + count + '_' + instance;
                            gapSpan.id = itemId;

                            // Check for existing feedback to set CSS classes
                            const itemSettings = item.getItemSettings(gapSpan);
                            if (item.striptags(itemSettings.correctfeedback)) {
                                gapSpan.className += ' hascorrect';
                            }
                            if (item.striptags(itemSettings.incorrectfeedback)) {
                                gapSpan.className += ' hasnocorrect';
                            }

                            gaps.push(item.gaptext);
                        }
                        gapSpan.appendChild(document.createTextNode(chunk));
                        fragment.appendChild(gapSpan);
                    } else {
                        // This chunk is regular text
                        fragment.appendChild(document.createTextNode(chunk));
                    }
                }
                // Replace the original text node with the fragment
                node.parentNode.replaceChild(fragment, node);
            }
        }
    };
})();


/**
 * Item class for managing gap fill items
 */
export class Item {
    // ... (existing properties remain the same) ...

    /** @type {string|null} */
    questionid;

    /** @type {Array<ItemSettings>} */
    settings;

    /** @type {string} */
    gaptext;

    /** @type {string} */
    delimitchars;

    /** @type {string} */
    l;

    /** @type {string} */
    r;

    /** @type {number} */
    len;

    /** @type {string} */
    startchar;

    /** @type {string} */
    endchar;

    /** @type {string} */
    gaptextNodelim;

    /** @type {Feedback} */
    feedback;

    /** @type {number} */
    instance;

    /**
     * Constructor
     * @param {string} text - The gap text
     * @param {string} delimitchars - The delimiter characters (e.g., "[]")
     */
    constructor(text, delimitchars) {
        const questionIdInput = document.querySelector("input[name=id]");
        this.questionid = questionIdInput?.value || null;
        this.settings = getSettings();
        this.gaptext = text;
        this.delimitchars = delimitchars;

        // The l and r is for left and right
        this.l = delimitchars.substr(0, 1);
        this.r = delimitchars.substr(1, 1);
        this.len = this.gaptext.length;
        this.startchar = this.gaptext.substring(0, 1);

        // For checking if the end char is the right delimiter
        this.endchar = this.gaptext.substring(this.len - 1, this.len);
        this.gaptextNodelim = "";
        this.feedback = {
            correct: "",
            incorrect: ""
        };
        this.instance = 0;

        const correctEditableEl = document.getElementById("id_correcteditable");
        const incorrectEditableEl = document.getElementById("id_incorrecteditable");

        this.feedback.correct = correctEditableEl?.innerHTML || "";
        this.feedback.incorrect = incorrectEditableEl?.innerHTML || "";
    }

    /**
     * Strip HTML tags from text
     * @param {string|undefined} gaptext - Text to strip tags from
     * @returns {string} Text without HTML tags
     */
    striptags(gaptext) {
        // This is not a perfect way of stripping html but it may be good enough
        if (gaptext === undefined) {
            return "";
        }
        const regex = /(<([^>]+)>)/gi;
        return gaptext.replace(regex, "");
    }

    /**
     * Strip delimiters from gap text
     * @returns {string} Gap text without delimiters
     */
    stripdelim() {
        if (this.startchar === this.l) {
            this.gaptextNodelim = this.gaptext.substring(1, this.len);
        }
        if (this.endchar === this.r) {
            const len = this.gaptextNodelim.length;
            this.gaptextNodelim = this.gaptextNodelim.substring(0, len - 1);
        }
        return this.gaptextNodelim;
    }

    /**
     * Get settings for a specific item
     * @param {HTMLElement} target - The target element
     * @returns {ItemSettings|Array} Item settings or empty array if not found
     */
    getItemSettings(target) {
        const itemid = target.id;
        const underscore = itemid.indexOf("_");

        // The instance, normally 0 but incremented if a gap has the same text as another
        // instance is not currently used
        this.instance = parseInt(itemid.substr(underscore + 1), 10) || 0;

        let itemsettings = [];
        const text = this.stripdelim();

        for (const set in this.settings) {
            if (Object.prototype.hasOwnProperty.call(this.settings, set)) {
                if (this.settings[set].gaptext === text) {
                    itemsettings = this.settings[set];
                    break;
                }
            }
        }
        return itemsettings;
    }

    /**
     * Update JSON settings with feedback
     * @param {Event} e - The event object
     * @returns {string} JSON stringified settings
     */
    updateJson(e) {
        let found = false;
        const id = e.target.id;
        const correctEditableEl = document.getElementById("id_correcteditable");
        const incorrectEditableEl = document.getElementById("id_incorrecteditable");
        const questionIdInput = document.querySelector("input[name=id]");
        const strippedText = this.stripdelim();

        // Update existing settings
        for (const set in this.settings) {
            if (Object.prototype.hasOwnProperty.call(this.settings, set)) {
                if (this.settings[set].gaptext === strippedText) {
                    this.settings[set].correctfeedback = correctEditableEl?.innerHTML || "";
                    this.settings[set].incorrectfeedback = incorrectEditableEl?.innerHTML || "";
                    found = true;
                    break;
                }
            }
        }

        // If there is no record for this word add one
        if (!found) {
            const newItemSettings = {
                itemid: id,
                questionid: questionIdInput?.value || null,
                correctfeedback: correctEditableEl?.innerHTML || "",
                incorrectfeedback: incorrectEditableEl?.innerHTML || "",
                gaptext: strippedText
            };
            this.settings.push(newItemSettings);
        }

        return JSON.stringify(this.settings);
    }
}

// Default export for compatibility
export default Item;