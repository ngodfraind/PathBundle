'use strict';

function PreviewStepCtrl($scope, $modal, $http, HistoryFactory, PathFactory, StepFactory, ResourceFactory) {
    // Store resource icons
    $scope.resourceIcons = EditorApp.resourceIcons;

    // Resource Picker config
    $scope.resourcePickerConfig = {
        parentElement: '#resourcePicker',
        isPickerMultiSelectAllowed: true,
        isPickerOnly: true,
        isWorkspace: true,
        webPath: EditorApp.webDir,
        appPath: EditorApp.appDir,
        directoryId: EditorApp.wsDirectoryId,
        resourceTypes: EditorApp.resourceTypes,
        pickerCallback: function (nodes) {
            if (typeof nodes === 'object' && nodes.length !== 0) {
                for (var nodeId in nodes) {
                    var node = nodes[nodeId];

                    if (typeof $scope.previewStep.resources != 'object') {
                        $scope.previewStep.resources = [];
                    }

                    // Check if resource has already been linked to the the step
                    var resourceExists = false;
                    for (var i = 0; i < $scope.previewStep.resources.length; i++) {
                        var res = $scope.previewStep.resources[i];
                        if (res.resourceId === nodeId) {
                            resourceExists = true;
                            break;
                        }
                    }

                    if (!resourceExists) {
                        // Resource need to be linked
                        var resource = ResourceFactory.generateNewResource();
                        resource.name = node[0];
                        resource.type = node[2];
                        resource.resourceId = nodeId;

                        $scope.previewStep.resources.push(resource);
                    }
                }

                // Update history
                HistoryFactory.update($scope.path);

                // Reload preview step data
                $scope.updatePreviewStep();
            }
        }
    };

    // Load who list
    $http.get(Routing.generate('innova_path_get_stepwho')).success(function(data) { 
        $scope.whoList = data; 
    });

    // Load who default
    $http.get(Routing.generate('innova_path_get_stepwho_default')).success(function(data) { 
        StepFactory.setWhoDefault(data);
        $scope.whoDefault = data; 
    });

    // Load where list
    $http.get(Routing.generate('innova_path_get_stepwhere')).success(function(data) { 
        $scope.whereList = data; 
    });

    // Load where default
    $http.get(Routing.generate('innova_path_get_stepwhere_default')).success(function(data) { 
        StepFactory.setWhereDefault(data);
        $scope.whereDefault = data; 
    });

    // Tiny MCE options
    if (typeof(configTinyMCE) != 'undefined' && null != configTinyMCE && configTinyMCE.length != 0) {
        // App as a config for tinyMCE => use it
        $scope.tinymceOptions = configTinyMCE;
    }
    else {
        var home = window.Claroline.Home;

        var language = home.locale.trim();
        var contentCSS = home.asset + 'bundles/clarolinecore/css/tinymce/tinymce.css';
        
        // If no config, add default tiny
        $scope.tinymceOptions = {
            relative_urls: false,
            theme: 'modern',
            language: language,
            browser_spellcheck : true,
            autoresize_min_height: 100,
            autoresize_max_height: 500,
            content_css: contentCSS,
            plugins: [
                'autoresize advlist autolink lists link image charmap print preview hr anchor pagebreak',
                'searchreplace wordcount visualblocks visualchars fullscreen',
                'insertdatetime media nonbreaking save table directionality',
                'template paste textcolor emoticons code'
            ],
            toolbar1: 'styleselect | bold italic | alignleft aligncenter alignright alignjustify | preview fullscreen resourcePicker',
            toolbar2: 'undo redo | forecolor backcolor emoticons | bullist numlist outdent indent | link image media print code',
            paste_preprocess: function (plugin, args) {
                var link = $('<div>' + args.content + '</div>').text().trim(); //inside div because a bug of jquery
                var url = link.match(/^(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)|((mailto:)?[_.\w-]+@([\w][\w\-]+\.)+[a-zA-Z]{2,3})$/);

                if (url) {
                    args.content = '<a href="' + link + '">' + link + '</a>';
                    home.generatedContent(link, function (data) {
                        insertContent(data);
                    }, false);
                }
            }
        };
    }

	/**
     * Select step image in library
     * @returns void
     */
    $scope.selectImage = function() {
        var modalInstance = $modal.open({
            templateUrl: EditorApp.webDir + 'bundles/innovapath/angularjs/Step/Partial/select-image.html',
            controller: 'SelectImageModalCtrl'
        });
        
        // Process modal results
        modalInstance.result.then(function(image) {
            if (image) {
                $scope.previewStep.image = image;
            } 
        });
    };

    $scope.validateEditStep = function() {
        $scope.edit.preview = false;

        // Update history
        HistoryFactory.update($scope.path);
    };

    $scope.cancelEditStep = function () {
        $scope.edit.preview = false;

        // Get previous version of step
        PathFactory.replaceStep($scope.previewStepBackup);
    };

    $scope.incrementDuration = function (type) {
        if ('hour' === type) {
            if (typeof $scope.previewStep.durationHours === 'undefined' || null === $scope.previewStep.durationHours || $scope.previewStep.durationHours.length === 0) {
                $scope.previewStep.durationHours = 0;
            }

            $scope.previewStep.durationHours += 1;
        }
        else if ('minute' === type) {
            if (typeof $scope.previewStep.durationMinutes === 'undefined' || null === $scope.previewStep.durationMinutes || $scope.previewStep.durationMinutes.length === 0) {
                $scope.previewStep.durationMinutes = 0;
            }

            if ($scope.previewStep.durationMinutes + 5 < 60) {
                $scope.previewStep.durationMinutes += 5;
            }
        }
    };

    $scope.decrementDuration = function(type) {
        if ('hour' === type) {
            if (typeof $scope.previewStep.durationHours === 'undefined' || null === $scope.previewStep.durationHours || $scope.previewStep.durationHours.length === 0) {
                $scope.previewStep.durationHours = 0;
            }
            
            if ($scope.previewStep.durationHours - 1 >= 0) { // Negative values are not allowed
                $scope.previewStep.durationHours -= 1;
            }
        }
        else if ('minute' === type) { 
            if (typeof $scope.previewStep.durationMinutes === 'undefined' || null === $scope.previewStep.durationMinutes || $scope.previewStep.durationMinutes.length === 0) {
                $scope.previewStep.durationMinutes = 0;
            }
            
            if ($scope.previewStep.durationMinutes - 5 >= 0) { // Negative values are not allowed
                $scope.previewStep.durationMinutes -= 5;
            }
        }
    };

    $scope.correctDuration = function(type) {
        console.log('correct');
        // Don't allow negative value, so always return absolute value
        if ('hour' === type) {
            if (typeof $scope.previewStep.durationHours === 'undefined' || null === $scope.previewStep.durationHours || $scope.previewStep.durationHours.length === 0) {
                $scope.previewStep.durationHours = 0;
            }

            $scope.previewStep.durationHours = Math.abs($scope.previewStep.durationHours);
        }
        else if ('minute' === type) {
            if (typeof $scope.previewStep.durationMinutes === 'undefined' || null === $scope.previewStep.durationMinutes || $scope.previewStep.durationMinutes.length === 0) {
                $scope.previewStep.durationMinutes = 0;
            }

            $scope.previewStep.durationMinutes = Math.abs($scope.previewStep.durationMinutes);

            // Don't allow more than 60 minutes
            var minutesToHours = Math.floor($scope.previewStep.durationMinutes / 60);
            if (minutesToHours > 0) {
                if (typeof $scope.previewStep.durationHours === 'undefined' || null === $scope.previewStep.durationHours || $scope.previewStep.durationHours.length === 0) {
                    $scope.previewStep.durationHours = 0;
                }

                $scope.previewStep.durationHours += minutesToHours;
                $scope.previewStep.durationMinutes = $scope.previewStep.durationMinutes % 60;
            }
        }
    }

    /**
     * Open modal to modify specified resource properties
     * @returns void
     */
    $scope.editResource = function(resource) {
        var editResource = false;

        if (resource) {
            editResource = true;
            // Edit existing document
            ResourceFactory.setResource(resource);
        }

        var modalInstance = $modal.open({
            templateUrl: EditorApp.webDir + 'bundles/innovapath/angularjs/Resource/Partial/resource-edit.html',
            controller: 'ResourceModalCtrl'
        });

        // Process modal results
        modalInstance.result.then(function(resource) {
            if (resource) {
                if (typeof $scope.previewStep.resources == 'undefined' || null == $scope.previewStep.resources) {
                    $scope.previewStep.resources= [];
                }
                
                // Save resource
                if (editResource) {
                    // Edit existing resource
                    // Replace old resource by the new one
                    for (var i = 0; i < $scope.previewStep.resources.length; i++) {
                        if ($scope.previewStep.resources[i].id === resource.id) {
                            $scope.previewStep.resources[i] = resource;
                            break;
                        }
                    }
                }
                else {
                    // Create new resource
                    $scope.previewStep.resources.push(resource);
                }

                // Update history
                HistoryFactory.update($scope.path);
            }
        });
    };

    /**
     * Delete selected resource from path
     * @returns void
     */
    $scope.removeResource = function(resource) {
        StepFactory.removeResource($scope.previewStep, resource.id);

        // Loop through path to remove reference to resource
        PathFactory.removeResource(resource.id);

        // Update history
        HistoryFactory.update($scope.path);
    };

    /**
     * Exclude a resource herited from parents
     * @returns void
     */
    $scope.excludeParentResource= function(resource) {
        resource.isExcluded = true;
        $scope.previewStep.excludedResources.push(resource.id);

        // Update history
        HistoryFactory.update($scope.path);
    };

    /**
     * Include a resource herited from parents which has been excluded
     * @returns void
     */
    $scope.includeParentResource= function(resource) {
        resource.isExcluded = false;
        
        if (typeof $scope.previewStep.excludedResources !== 'undefined' && null !== $scope.previewStep.excludedResources) {
            for (var i = 0; i < $scope.previewStep.excludedResources.length; i++) {
                if (resource.id == $scope.previewStep.excludedResources[i]) {
                    $scope.previewStep.excludedResources.splice(i, 1);
                }
            }
        }

        // Update history
        HistoryFactory.update($scope.path);
    };
}