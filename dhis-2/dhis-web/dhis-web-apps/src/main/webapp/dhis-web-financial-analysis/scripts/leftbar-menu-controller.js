/* global sunFinance, selection */

//Controller for column show/hide
sunFinance.controller('LeftBarMenuController',
        function($scope, $location) {
    $scope.showDataEntry = function(){
        selection.load();
        $location.path('/dataentry').search();
    };
    
    $scope.showReports = function(){
        selection.load();
        $location.path('/reports').search();
    };
});