/* global angular, selection */

'use strict';

var sunFinance = angular.module('sunFinance');

//Controller for reports page
sunFinance.controller('reportTypesController', function($scope, $location) {
    
    $scope.sectorLevelReport = function(){
        selection.load();
        $location.path('/report-sector-level').search();
    };
    
    $scope.districtLevelReport = function(){   
        selection.load();
        $location.path('/report-district-level').search();
    };
    
});
