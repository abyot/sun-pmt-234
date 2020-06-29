/* global directive, selection, dhis2, angular */

'use strict';

/* Directives */

var actionMappingDirectives = angular.module('actionMappingDirectives', [])

.directive('d2Blur', function () {
    return function (scope, elem, attrs) {
        elem.change(function () {
            scope.$apply(attrs.d2Blur);
        });
    };
})

.directive('d2MultiSelect', function ($q) {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {
            selectedLabel: "@",
            availableLabel: "@",
            displayAttr: "@",
            available: "=",
            model: "=ngModel"
        },
        template:   '<div class="row">'+
                        '<div class="col-sm-5">' + 
                            '<div class="select-list-labels">{{ availableLabel }}</div>' +
                            '<div><select id="multiSelectAvailable" ng-dblclick="add()" ng-model="selected.available" multiple ng-options="e as e[displayAttr] for e in available | filter:filterText | orderBy: \'displayName\'"></select></div>' + 
                        '</div>' + 
                        '<div class="col-sm-2">' + 
                            '<div class="select-list-buttons">' + 
                                '<button title="{{\'select\' | translate}}" class="btn btn-primary btn-block" ng-click="add()" ng-disabled="selected.available.length == 0">' + 
                                    '<i class="fa fa-angle-right fa-2x"></i>' + 
                                '</button>' + 
                                '<div class="vertical-spacing">' + 
                                    '<button title="{{\'select_all\' | translate}}" class="btn btn-success btn-block" ng-click="addAll()" ng-disabled="available.length == 0">' + 
                                        '<i class="fa fa-angle-double-right fa-2x"></i>' + 
                                    '</button>' +
                                '</div>' +
                            '</div>' +   
                            '<div class="vertical-spacing">' + 
                                '<button title="{{\'remove\' | translate}}" class="btn btn-warning btn-block" ng-click="remove()" ng-disabled="selected.current.length == 0">' + 
                                    '<i class="fa fa-angle-left fa-2x"></i>' + 
                                '</button>' +
                            '</div>' +                            
                            '<div class="vertical-spacing">' + 
                                '<button title="{{\'remove_all\' | translate}}" class="btn btn-danger btn-block" ng-click="removeAll()" ng-disabled="model.length == 0">' + 
                                    '<i class="fa fa-angle-double-left fa-2x"></i>' + 
                                '</button>' +
                            '</div>' + 
                        '</div>' +     
                        '<div class="col-sm-5">' +
                            '<div class="select-list-labels">{{ selectedLabel }}<span class="required">*</span></div>' +
                            '<div><select id="multiSelectSelected" ng-dblclick="remove()" name="multiSelectSelected" ng-model="selected.current" multiple ng-options="e as e[displayAttr] for e in model | orderBy: \'displayName\'"></select></div>' +
                        '</div>' +
                    '</div>',
        link: function (scope, elm, attrs) {
            scope.selected = {
                available: [],
                current: []
            };

            // Handles cases where scope data hasn't been initialized yet
            var dataLoading = function (scopeAttr) {
                var loading = $q.defer();
                if (scope[scopeAttr]) {
                    loading.resolve(scope[scopeAttr]);
                } else {
                    scope.$watch(scopeAttr, function (newValue, oldValue) {
                        if (newValue !== undefined)
                            loading.resolve(newValue);
                    });
                }
                return loading.promise;
            };

            // Filters out items in original that are also in toFilter. Compares by reference. 
            var filterOut = function (original, toFilter) {
                var filtered = [];
                angular.forEach(original, function (entity) {
                    var match = false;
                    for (var i = 0; i < toFilter.length; i++) {
                        if (toFilter[i][attrs.displayAttr] === entity[attrs.displayAttr]) {
                            match = true;
                            break;
                        }
                    }
                    if (!match) {
                        filtered.push(entity);
                    }
                });
                return filtered;
            };

            scope.refreshAvailable = function () {
                scope.available = filterOut(scope.available, scope.model);
                scope.selected.available = [];
                scope.selected.current = [];
            };

            scope.add = function () {
                scope.model = scope.model.concat(scope.selected.available);
                scope.refreshAvailable();
            };
            
            scope.addAll = function() {
                scope.model = scope.model.concat( scope.available );
                scope.refreshAvailable();
            };
            
            scope.remove = function () {
                scope.available = scope.available.concat(scope.selected.current);
                scope.model = filterOut(scope.model, scope.selected.current);
                scope.refreshAvailable();
            };
            
            scope.removeAll = function() {
                scope.available = scope.available.concat(scope.model);
                scope.model = [];
                scope.refreshAvailable();
            };

            $q.all([dataLoading("model"), dataLoading("available")]).then(function (results) {
                scope.refreshAvailable();
            });
        }
    };
});

/*.directive('d2MultiSelect', function ($q) {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {
            selectedLabel: "@",
            availableLabel: "@",
            displayAttr: "@",
            available: "=",
            model: "=ngModel"
        },
        template: '<div class="row">' + 
                    '<div class="col-sm-12 vertical-spacing"> ' +
                        '<input class="form-control" placeholder="{{\'your_filter_text\' | translate}}" ng-model="filterText"/>'+
                    '</div>' +
                  '</div>' +
                  '<div class="row">'+
                    '<div class="col-sm-5">' + 
                        '<div class="select-list-labels">{{ availableLabel }}</div>' +
                        '<div><select id="multiSelectAvailable" ng-model="selected.available" multiple ng-options="e as e[displayAttr] for e in available | filter:filterText | orderBy: \'displayName\'"></select></div>' + 
                    '</div>' + 
                    '<div class="col-sm-2">' + 
                      '<div class="select-list-buttons"><button class="btn btn-default btn-block" ng-click="add()" ng-disabled="selected.available.length == 0">' + 
                        '{{\'select\' | translate}}' + 
                      '</div></button>' + 
                      '<div class="vertical-spacing"><button class="btn btn-default btn-block" ng-click="remove()" ng-disabled="selected.current.length == 0">' + 
                        '{{\'remove\' | translate}}' + 
                      '</div></button>' +
                    '</div>' + 
                    '<div class="col-sm-5">' +
                        '<div class="select-list-labels">{{ selectedLabel }}<span class="required">*</span></div>' +
                        '<div><select id="multiSelectSelected" name="multiSelectSelected" ng-model="selected.current" multiple ng-options="e as e[displayAttr] for e in model | orderBy: \'name\'"></select></div>' +
                    '</div>' +
                  '</div>',
        link: function (scope, elm, attrs) {
            scope.selected = {
                available: [],
                current: []
            };

            // Handles cases where scope data hasn't been initialized yet
            var dataLoading = function (scopeAttr) {
                var loading = $q.defer();
                if (scope[scopeAttr]) {
                    loading.resolve(scope[scopeAttr]);
                } else {
                    scope.$watch(scopeAttr, function (newValue, oldValue) {
                        if (newValue !== undefined)
                            loading.resolve(newValue);
                    });
                }
                return loading.promise;
            };

            // Filters out items in original that are also in toFilter. Compares by reference. 
            var filterOut = function (original, toFilter) {
                var filtered = [];
                angular.forEach(original, function (entity) {
                    var match = false;
                    for (var i = 0; i < toFilter.length; i++) {
                        if (toFilter[i][attrs.displayAttr] === entity[attrs.displayAttr]) {
                            match = true;
                            break;
                        }
                    }
                    if (!match) {
                        filtered.push(entity);
                    }
                });
                return filtered;
            };

            scope.refreshAvailable = function () {
                scope.available = filterOut(scope.available, scope.model);
                scope.selected.available = [];
                scope.selected.current = [];
            };

            scope.add = function () {
                scope.model = scope.model.concat(scope.selected.available);
                scope.refreshAvailable();
            };
            scope.remove = function () {
                scope.available = scope.available.concat(scope.selected.current);
                scope.model = filterOut(scope.model, scope.selected.current);
                scope.refreshAvailable();
            };

            $q.all([dataLoading("model"), dataLoading("available")]).then(function (results) {
                scope.refreshAvailable();
            });
        }
    };
});*/  