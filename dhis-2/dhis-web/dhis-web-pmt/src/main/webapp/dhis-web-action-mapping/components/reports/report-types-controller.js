/* global angular, selection */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('reportTypesController',
        function($scope,
                $location) {
    $scope.whoDoesWhat = function(){
        selection.load();
        $location.path('/report-whodoeswhat').search();
    };
    
    $scope.geoCoveragePerSh = function(){   
        selection.load();
        $location.path('/report-geocoverage').search();
    };
    
    $scope.popCoveragePerSh = function(){   
        selection.load();
        $location.path('/report-popcoverage').search();
    };
    
    $scope.dataExport = function(){   
        selection.load();
        $location.path('/report-dataexport').search();
    };
});
