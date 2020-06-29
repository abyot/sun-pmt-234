'use strict';

/* App Module */

var sunFinance = angular.module('sunFinance',
        ['ui.bootstrap', 
         'ngRoute', 
         'ngCookies',
         'ngSanitize',
         'ngMessages',
         'financialAnalysisServices',
         'financialAnalysisFilters',
         'financialAnalysisDirectives',
         'd2Directives',
         'd2Filters',
         'd2Services',
         'd2Controllers',
         'angularLocalStorage',
         'ui.select',
         'ui.select2',
         'pascalprecht.translate'])
              
.value('DHIS2URL', '../api')

.config(function($httpProvider, $routeProvider, $translateProvider) {    
            
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
    
    $routeProvider.when('/dataentry', {
        templateUrl:'components/dataentry/dataentry.html',
        controller: 'dataEntryController'
    }).when('/reports', {
        templateUrl:'components/reports/report-types.html',
        controller: 'reportTypesController'
    }).when('/report-sector-level',{
        templateUrl:'components/reports/sector/sector.html',
        controller: 'SectorReportController'
    }).when('/report-district-level',{
        templateUrl:'components/reports/district/district.html',
        controller: 'DistrictReportController'
    }).otherwise({
        redirectTo : '/dataentry'
    });  
    
    $translateProvider.preferredLanguage('en');
    $translateProvider.useSanitizeValueStrategy('escaped');
    $translateProvider.useLoader('i18nLoader');    
})

.run(function($rootScope){    
    $rootScope.maxOptionSize = 1000;
});
