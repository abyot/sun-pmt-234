/* global angular */

'use strict';

var sunFinance = angular.module('sunFinance');

//Controller for reports page
sunFinance.controller('SectorReportController',
                function($scope,
                $filter,
                $translate,
                SessionStorageService,
                DialogService,
                PeriodService,
                MetaDataFactory,
                DataSetFactory,
                CommonUtils,
                OptionComboService,
                ReportService,
                NotificationService) {
    $scope.periodOffset = 0;
    $scope.showReportFilters = true;
    $scope.reportReady = false;
    $scope.noDataExists = false;    
    $scope.model = {
        ouModes: [],
        periods: [],
        actionDataSets: [],
        budgetDataSets: [],
        selectedDataSets: [],
        ouLevels: [],
        mappedOptionCombos: null,
        mappedValues: null,
        selectedAttributeCategoryCombo: null,
        selectedAttributeOptionCombos: {},
        childrenIds: [],
        children: []};
    
    function resetParams(){
        $scope.showReportFilters = true;
        $scope.reportStarted = false;
        $scope.reportReady = false;
        $scope.noDataExists = false;
    }
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() { 
        $scope.model.selectedIndicators = [];
        $scope.model.selectedDataSets = [];
        $scope.model.selectedPeriod = null;
        resetParams();
        if( angular.isObject($scope.selectedOrgUnit)){
            
            CommonUtils.getChildrenIds($scope.selectedOrgUnit).then(function(response){
                $scope.model.childrenIds = response.childrenIds;
                $scope.model.children = response.children;
                $scope.model.childrenByIds = response.childrenByIds;
                $scope.model.allChildren = response.allChildren;
            });

            MetaDataFactory.getAll('ouLevels').then(function(ouLevels){
                angular.forEach(ouLevels, function(ol){
                    $scope.model.ouLevels[ol.level] = ol.displayName;
                });                    
                var res = CommonUtils.populateOuLevels($scope.selectedOrgUnit, $scope.model.ouLevels);
                $scope.model.ouModes = res.ouModes;
                $scope.model.selectedOuMode = res.selectedOuMode;
                
                $scope.model.mappedOptionCombos = [];
                OptionComboService.getMappedOptionCombos().then(function(ocos){
                    $scope.model.mappedOptionCombos = ocos;
                });
            });
            
            $scope.model.budgetDataSets = [];
            DataSetFactory.getSectorBudgetDataSets().then(function(dataSets){
                $scope.model.budgetDataSets = dataSets;
                var acos = [];
                angular.forEach($scope.model.budgetDataSets, function(ds){
                    if ( ds.categoryCombo && ds.categoryCombo.id && acos.indexOf( ds.categoryCombo.id ) === - 1 ){
                        acos.push( ds.categoryCombo.id );
                    }
                });

                if ( acos.length !== 1 )
                {
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_budget_dataset_dimension_configuration"));
                    return;
                }

                $scope.model.selectedAttributeOptionCombos = {};
                MetaDataFactory.get('categoryCombos', acos[0]).then(function(coc){
                    $scope.model.selectedAttributeCategoryCombo = coc;
                    angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(oco){
                        $scope.model.selectedAttributeOptionCombos['"' + oco.displayName + '"'] = oco.id;
                    });
                });
            });

            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit);
            $scope.model.periods = PeriodService.getPeriods('Yearly', $scope.periodOffset);
        }
    });

    $scope.getPeriods = function(mode){
        
        if( mode === 'NXT'){
            $scope.periodOffset = $scope.periodOffset + 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods('Yearly', $scope.periodOffset);
        }
        else{
            $scope.periodOffset = $scope.periodOffset - 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods('Yearly', $scope.periodOffset);
        }
    };
    
    $scope.interacted = function(field) {        
        var status = false;
        if(field){            
            status = $scope.sectorForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.getReport = function(){
        
        //check for form validity
        $scope.sectorForm.submitted = true;        
        if( $scope.sectorForm.$invalid ){
            return false;
        }
        
        if( !$scope.model.budgetDataSets || $scope.model.budgetDataSets.length < 1 ){            
            var dialogOptions = {
                headerText: $translate.instant('error'),
                bodyText: $translate.instant('please_select_actions')
            };		
            DialogService.showDialog({}, dialogOptions);
            return;
        }

        var selectedAgency = null;
        if( $scope.model.selectedAttributeCategoryCombo && 
                $scope.model.selectedAttributeCategoryCombo.categories &&
                $scope.model.selectedAttributeCategoryCombo.categories.length &&
                $scope.model.selectedAttributeCategoryCombo.categories[0].selectedOption ){
            selectedAgency = $scope.model.selectedAttributeCategoryCombo.categories[0].selectedOption;
        }

        if(selectedAgency){
            $scope.model.selectedAttributeOptionCombo = CommonUtils.getOptionComboIdFromOptionNames($scope.model.selectedAttributeOptionCombos, [selectedAgency]);
        }

        $scope.orgUnits = [];
        if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
            $scope.orgUnits = $scope.model.children;
        }
        else{
            $scope.orgUnits = [$scope.selectedOrgUnit];
        }
        
        resetParams();
        $scope.reportStarted = true;
        $scope.showReportFilters = false;
        
        var dataValueSetUrl = 'period=' + $scope.model.selectedPeriod.id;
        angular.forEach($scope.model.budgetDataSets, function(ds){
            dataValueSetUrl += '&dataSet=' + ds.id;
        });
        
        if( $scope.model.selectedAttributeOptionCombo ){
            dataValueSetUrl += '&attributeOptionCombo=' + $scope.model.selectedAttributeOptionCombo;
        }

        if( $scope.selectedOrgUnit.l === 3 ){
            dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;
        }        
        else{            
            if( $scope.selectedOrgUnit.l+1 < 3 ){
                angular.forEach($scope.selectedOrgUnit.c, function(c){
                    dataValueSetUrl += '&orgUnit=' + c;
                });
            }
            else {
                dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;
            }
            dataValueSetUrl += '&children=true';
        }

        var reportParams = {
            orgUnit: $scope.selectedOrgUnit.id,
            period: $scope.model.selectedPeriod, 
            dataValueSetUrl: dataValueSetUrl
        };
        
        var reportData = {
            mappedOptionCombos: $scope.model.mappedOptionCombos,
            budgetDataSets: $scope.model.budgetDataSets,
            budgetDataValues: []
        };
        
        ReportService.getBudgetReport( reportParams, reportData ).then(function(response){
            if( response.budgetDataElements ){                
                $scope.model.budgetDataElements = Object.keys( response.budgetDataElements ).map(key => ({id: key, displayName: response.budgetDataElements[key]}));
            }
            $scope.model.budgetDataValues = response.budgetDataValues;
            $scope.reportReady = response.reportReady;
            $scope.showReportFilters = response.showReportFilters;
            $scope.noDataExists = response.noDataExists;
            $scope.reportStarted = response.reportStarted;
        });
    };
    
    $scope.getRowValues = function(ou){
        var values = [];
        angular.forEach($scope.model.budgetDataValues, function(val){            
            if( val.orgUnit === $scope.selectedOrgUnit.id || 
                    ( $scope.model.childrenByIds[val.orgUnit] &&
                    $scope.model.childrenByIds[val.orgUnit].path &&
                    $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
                    ){
                
                if( val.value ){
                    val.value = parseInt( val.value );
                }
                else{
                    val.value = parseInt( 0 );
                }
                values.push( val );
            }
        });
        return values;
    };
    
    $scope.getCellValue = function(col, rowValues){
        if( col && col.id && rowValues && rowValues.length > 0 ){
            if( col.id === 'agency' && col.group ){
                var values = $filter('filter')(rowValues, {dataElement: col.group});
                var agencyList = [];
                angular.forEach(values, function(val){
                    var aoc = $scope.model.mappedOptionCombos[val.attributeOptionCombo].displayName;
                    if( agencyList.indexOf( aoc ) === -1 ){
                        agencyList.push( aoc );
                    }
                });
                if( agencyList.length > 0 ){
                    return agencyList.join(',');
                }
            }
            else if ( col.id === 'total' ){
                var res = 0;
                angular.forEach(rowValues, function(val){
                   res += val.value; 
                });
                return res;
            }
            else{
                if( col.type && col.type === 'dataElement' ){
                    var values = $filter('filter')(rowValues, {dataElement: col.id});
                    if( values.length > 0 ){
                        var res = 0;
                        angular.forEach(values, function(val){
                           res += val.value; 
                        });
                        return res;
                    }
                }
            }
        }
    };
    
    $scope.getTotal = function(rowValues){
        var res = 0;
        angular.forEach(rowValues, function(val){
           res += val.value; 
        });
        return res;
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        
        var reportName = CommonUtils.getReportName($translate.instant('sector_level_financial_report'), 
                                        $scope.model.selectedRole,
                                        $scope.selectedOrgUnit.n,
                                        $scope.model.selectedOuMode,
                                        $scope.model.selectedPeriod.name);
        
        saveAs(blob, reportName);
    };
});
