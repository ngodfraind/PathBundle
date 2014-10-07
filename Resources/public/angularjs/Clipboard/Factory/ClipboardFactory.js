'use strict';

/**
 * Clipboard Factory
 */
function ClipboardFactory($rootScope, PathFactory) {
    // Clipboard content
    var clipboard = null;
    
    // Current clipboard content comes from Templates ?
    var clipboardFromTemplates = false;
    
    // Enable paste buttons when clipboard is not empty
    $rootScope.pasteDisabled = true;
    
    return {
        /**
         * Check if clipboard contains a template or only a part of current Path
         * @returns {boolean}
         */
        isFromTemplate: function () {
            return clipboardFromTemplates;
        },

        /**
         * Empty clipboard
         * @returns {ClipboardFactory}
         */
        clear: function () {
            clipboard = null;
            clipboardFromTemplates = false;
            this.setPasteDisabled(true);
            
            return this;
        },
        
        /**
         * Copy selected steps into clipboard
         * @param   {Array}   steps
         * @param   {boolean} fromTemplates
         * @returns {ClipboardFactory}
         */
        copy: function (steps, fromTemplates) {
            clipboard = steps;
            clipboardFromTemplates = fromTemplates || false;

            this.setPasteDisabled(false);
            
            return this;
        },
        
        /**
         * Paste steps form clipboards into current Path tree
         * @param   {object} step
         * @returns {ClipboardFactory}
         */
        paste: function (step) {
            if (null !== clipboard) {
                var stepCopy = angular.extend({}, clipboard);
                
                // Replace IDs before inject steps in path
                this.replaceStepsId(stepCopy);
                this.replaceResourcesId(stepCopy, []);

                if (!clipboardFromTemplates) {
                    stepCopy.name = stepCopy.name + '_copy';
                }
                
                step.children.push(stepCopy);

                PathFactory.recalculateStepsLevel();
            }
            
            return this;
        },
        
        /**
         * Generate new local ids for resources
         * @param   {object} step
         * @param   {Array}  replacedIds
         * @returns {ClipboardFactory}
         */
        replaceResourcesId: function (step, replacedIds) {
            if (typeof replacedIds === 'undefined' || null === replacedIds) {
                replacedIds = [];
            }

            if (typeof step.resources !== 'undefined' && step.resources !== null && step.resources.length !== 0) {
                for (var i = 0; i < step.resources.length; i++) {
                    // Store ID to update excluded resources
                    replacedIds[step.resources[i].id] = PathFactory.getNextResourceId();

                    // Update resource ID
                    step.resources[i].id = PathFactory.getNextResourceId();

                    // Check excluded resources
                    for (var oldId in replacedIds) {
                        if (replacedIds.hasOwnProperty(oldId)) {
                            var pos = step.excludedResources.indexOf(oldId);
                            if (-1 !== pos) {
                                step.excludedResources[pos] = replacedIds[oldId];
                            }
                        }
                    }
                }
            }
            
            if (step.children.length !== 0) {
                for (var j = 0; j < step.children.length; j++) {
                    this.replaceResourcesId(step.children[j], replacedIds);
                }
            }
            
            return this;
        },
        
        /**
         * Generate new local ids for steps
         * @param   {object} step
         * @returns {ClipboardFactory}
         */
        replaceStepsId: function (step) {
            step.id = PathFactory.getNextStepId();
            step.resourceId = null;

            if (step.children.length != 0) {
                for (var i = 0; i < step.children.length; i++) {
                    this.replaceStepsId(step.children[i]);
                }
            }
            return this;
        },
        
        /**
         * Check if paste feature is enabled or not
         * @returns {boolean}
         */
        getPasteDisabled: function () {
            return $rootScope.pasteDisabled;
        },
        
        /**
         * Enable or Disable paste feature
         * @param   {boolean} disabled
         * @returns {ClipboardFactory}
         */
        setPasteDisabled: function (disabled) {
            $rootScope.pasteDisabled = disabled;

            return this;
        }
    };
}