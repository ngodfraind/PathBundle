/**
 * Identifier Service
 */
(function () {
    'use strict';

    angular.module('UtilsModule').factory('IdentifierService', [
        function IdentifierService() {
            return {
                generateUUID: function () {
                    function s4() {
                        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
                    }

                    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
                }
            };
        }
    ]);
})();