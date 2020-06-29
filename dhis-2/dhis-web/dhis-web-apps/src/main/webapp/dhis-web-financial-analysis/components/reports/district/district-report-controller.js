/* global angular */

'use strict';

var sunFinance = angular.module('sunFinance');

//Controller for reports page
sunFinance.controller('DistrictReportController',
        function($scope,
                $filter,
                $translate,
                orderByFilter,
                SessionStorageService,
                DialogService,
                PeriodService,
                MetaDataFactory,
                DataSetFactory,
                CommonUtils,
                OptionComboService,
                ReportService) {
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
        reportColumns: [],
        mappedOptionCombos: null,
        mappedValues: null,
        
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
            $scope.model.actionDataSets = [];
            $scope.model.reportColumns = [];
            var agencyLabel = $translate.instant('contributing_agency');
            var actionsImplemenetedLabel = $translate.instant('actions_implemented');
            var totalLabel = $translate.instant('total');
            
            DataSetFactory.getActionAndBudgetDataSets().then(function(dataSets){
                angular.forEach(dataSets, function(ds){
                    if( ds.dataSetType === 'budget' ){
                        $scope.model.budgetDataSets.push( ds );                        
                        if( ds.dataElements && ds.dataElements.length > 0){
                            ds.dataElements = orderByFilter(ds.dataElements, '-displayFormName').reverse();
                            angular.forEach(ds.dataElements, function(de){
                                $scope.model.reportColumns.push({id: de.id, displayName: de.displayFormName, type: 'dataElement'});
                                $scope.model.reportColumns.push({id: 'agency', displayName: agencyLabel, group: de.id});
                            });
                        }
                    }
                    else{
                        $scope.model.actionDataSets.push( ds );
                    }
                });
                
                if ( $scope.model.reportColumns.length > 0 ){
                    $scope.model.reportColumns.push({id: 'actionsImplemented', displayName: actionsImplemenetedLabel});
                    $scope.model.reportColumns.push({id: 'total', displayName: totalLabel});
                }
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
            status = $scope.districtForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.getReport = function(){
        
        //check for form validity
        $scope.districtForm.submitted = true;        
        if( $scope.districtForm.$invalid ){
            return false;
        }
        
        var selectedDataSets = $scope.model.budgetDataSets.concat( $scope.model.actionDataSets );
        
        if( !selectedDataSets || selectedDataSets.length < 1 ){            
            var dialogOptions = {
                headerText: $translate.instant('error'),
                bodyText: $translate.instant('please_select_actions')
            };		
            DialogService.showDialog({}, dialogOptions);
            return;
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
        angular.forEach(selectedDataSets, function(ds){
            dataValueSetUrl += '&dataSet=' + ds.id;
        });
        
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
            actionDataSets: $scope.model.actionDataSets,
            budgetDataValues: [],
            actionDataValues: []
        };
        
        ReportService.getBudgetReport( reportParams, reportData ).then(function(response){
            $scope.model.budgetDataValues = response.budgetDataValues;
            $scope.model.actionDataValues = response.actionDataValues;
            $scope.model.budgetDataElements = response.budgetDataElements;
            $scope.reportReady = response.reportReady;
            $scope.showReportFilters = response.showReportFilters;
            $scope.noDataExists = response.noDataExists;
            $scope.reportStarted = response.reportStarted;
        });
    };
    
    $scope.getRequiredCols = function(){
        return CommonUtils.getRequiredCols($scope.model.availableRoles, $scope.model.selectedRole);
    };
    
    $scope.getRowValues = function(ou){
        var values = [];
        angular.forEach($scope.model.budgetDataValues, function(val){            
            if( val.orgUnit === $scope.selectedOrgUnit.id || 
                    ( $scope.model.childrenByIds[val.orgUnit] &&
                    $scope.model.childrenByIds[val.orgUnit].path &&
                    $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
                    ){
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
    
    $scope.getTotal = function(col){
        if( col.type && col.type === 'dataElement' ){
            var values = $filter('filter')($scope.model.budgetDataValues, {dataElement: col.id});
            if( values.length > 0 ){
                var res = 0;
                angular.forEach(values, function(val){
                   res += val.value; 
                });
                return res;
            }
        }
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        
        var reportName = CommonUtils.getReportName($translate.instant('district_level_financial_report'), 
                                        $scope.model.selectedRole,
                                        $scope.selectedOrgUnit.n,
                                        $scope.model.selectedOuMode,
                                        $scope.model.selectedPeriod.name);
        
        saveAs(blob, reportName);
    };
});
