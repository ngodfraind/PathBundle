'use strict';

/**
 * Resource Factory
 */ 
function ResourceFactory(PathFactory) {
    // Base template used to create new resource
    var baseResource = {
        id                  : null,
        resourceId          : null,
        name                : null,
        type                : null,
        propagateToChildren : true
    };
    
    return {
        /**
         * Create a new Resource shell
         * @returns object
         */
        generateNewResource: function () {
            var newResource = angular.extend({}, baseResource);
            newResource.id = PathFactory.getNextResourceId();
            
            return newResource;
        },
        
        /**
         * Get inherited resources for a given step
         * @param   {object} stepToFind
         * @returns {object}
         */
        getInheritedResources: function (stepToFind) {
            var stepFound = false;
            var inheritedResources = [];

            var path = PathFactory.getPath();
            if (path && path.steps) {
                for (var i = 0; i < path.steps.length; i++) {
                    var currentStep = path.steps[i];
                    stepFound = this.retrieveInheritedResources(stepToFind, currentStep, inheritedResources);
                    if (stepFound) {
                        break;
                    }
                }
            }
            
            return inheritedResources;
        },
        
        /**
         * Search inherited resources for a given step
         * @param {object} stepToFind
         * @param {object} currentStep
         * @param {Array} inheritedResources
         * @returns {boolean}
         */
        retrieveInheritedResources: function (stepToFind, currentStep, inheritedResources) {
            var stepFound = false;
            
            if (stepToFind.id !== currentStep.id && typeof currentStep.children !== 'undefined' && null !== currentStep.children) {
                // Not the step we search for => search in children
                for (var i = 0; i < currentStep.children.length; i++) {
                    stepFound = this.retrieveInheritedResources(stepToFind, currentStep.children[i], inheritedResources);
                    if (stepFound) {
                        if (typeof currentStep.resources !== 'undefined' && null !== currentStep.resources) {
                            // Get all resources which must be sent to children
                            for (var j = currentStep.resources.length - 1; j >= 0; j--) {
                                if (currentStep.resources[j].propagateToChildren) {
                                    // Current resource must be available for children
                                    var resource = currentStep.resources[j];
                                    resource.parentStep = {
                                        id: currentStep.id,
                                        lvl: currentStep.lvl,
                                        name: currentStep.name
                                    };
                                    resource.isExcluded = stepToFind.excludedResources.indexOf(resource.id) != -1;
                                    inheritedResources.unshift(resource);
                                }
                            }
                        }
                        break;
                    }
                }
            }
            else {
                stepFound = true;
            }
            
            return stepFound;
        }
    }
}