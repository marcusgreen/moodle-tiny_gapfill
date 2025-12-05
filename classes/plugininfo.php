<?php
namespace tiny_gapfill;

use context;
use editor_tiny\editor;
use editor_tiny\plugin;
use editor_tiny\plugin_with_buttons;
use editor_tiny\plugin_with_menuitems;

class plugininfo extends plugin implements plugin_with_buttons, plugin_with_menuitems {

    public static function is_enabled(
        context $context,
        array $options,
        array $fpoptions,
        ?editor $editor = null
    ): bool {
        // Only enable for question editing pages
        if (!isset($options['context'])) {
            return false;
        }

        // Check if we're in a question context
        $context = $options['context'];
        if ($context->contextlevel !== CONTEXT_MODULE &&
            $context->contextlevel !== CONTEXT_COURSE) {
            return false;
        }

        // Check if the element ID indicates this is the question text field
        // The element ID for question text is usually 'id_questiontext'
        if (isset($options['elementid'])) {
            $elementid = $options['elementid'];
            // Only show in the questiontext field
            if (strpos($elementid, 'questiontext') === false) {
                return false;
            }
        }

        // Check if we're editing a gapfill question type
        // This checks the URL parameters
        $qtype = optional_param('qtype', '', PARAM_ALPHA);

        // Also check for existing question being edited
        if (empty($qtype)) {
            $questionid = optional_param('id', 0, PARAM_INT);
            if ($questionid) {
                global $DB;
                $question = $DB->get_record('question', ['id' => $questionid], 'qtype');
                if ($question) {
                    $qtype = $question->qtype;
                }
            }
        }

        // Only enable for gapfill question type
        return ($qtype === 'gapfill');
    }

    public static function get_available_buttons(): array {
        return [
            'tiny_gapfill/gapfill',
        ];
    }

    public static function get_available_menuitems(): array {
        return [
            'tiny_gapfill/gapfill',
        ];
    }
}