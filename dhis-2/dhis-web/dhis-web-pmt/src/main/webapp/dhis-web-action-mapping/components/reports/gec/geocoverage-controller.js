/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('GeoCoverageController',
        function($scope,
                $filter,
                $translate,
                SessionStorageService,
                DialogService,
                PeriodService,
                MetaDataFactory,
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
        dataSets: null,
        selectedDataSets: [],
        ouLevels: [],
        dataElementsByCode: [],
        dataSetsByDataElementId: [],
        selectedRole: null,
        mappedOptionCombos: null,
        reportDataElements: null,
        whoDoesWhatCols: [],
        mappedValues: null,
        childrenIds: [],
        children: []};
    
    $scope.model.stakeholderRoles = CommonUtils.getStakeholderNames();
    
    function resetParams(){
        $scope.showReportFilters = true;
        $scope.reportStarted = false;
        $scope.reportReady = false;
        $scope.noDataExists = false;
        $scope.model.reportDataElements = [];
        $scope.model.whoDoesWhatCols = [];
        $scope.model.selectedDataSets = [];
        $scope.model.selectedPeriod = null;
    }
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        resetParams();
        if( angular.isObject($scope.selectedOrgUnit)){

            $scope.model.mappedRoles = {};
            
            $scope.model.mappedOptionCombos = [];
            OptionComboService.getMappedOptionCombos().then(function(ocos){
                $scope.model.mappedOptionCombos = ocos;
            });
            
            $scope.model.categoryCombos = {};            
            $scope.model.categoryCodeById = {};
            $scope.model.mappedCategoryOptions = {};
            
            MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                angular.forEach(ccs, function(cc){
                    if( cc.code === 'DM-FI' && cc.categories && cc.categories.length > 0 ){
                        $scope.model.keyCategories = cc.categories;
                        angular.forEach(cc.categories, function(ca){
                            var options = {};
                            ca.categoryOptions.forEach(function(op){
                                options[op.id] = op.displayName;
                                $scope.model.mappedCategoryOptions[op.displayName] = ca.code;
                            });                            
                            ca.categoryOptions = options;
                            
                            $scope.model.categoryCodeById[ca.id] = ca;
                            if( ca.code === 'FI') {
                                $scope.model.fiCategory = ca;
                                $scope.model.whoDoesWhatCols.push( {id: ca.code, displayName: ca.displayName, sortOrder: 1, domain: 'str'} );
                            }
                            else if( ca.code === 'DM') {
                                $scope.model.dmCategory = ca;
                                $scope.model.whoDoesWhatCols.push( {id: ca.code, displayName: ca.displayName, sortOrder: 0, domain: 'dmc'} );
                            }
                        });
                    }
                    $scope.model.categoryCombos[cc.id] = cc;
                });
            

                $scope.model.dataSets = [];
                $scope.lowestLevel = 0;
                MetaDataFactory.getAll('dataSets').then(function(dataSets){
                    $scope.model.dataSets = $filter('filter')(dataSets, {dataSetType: 'action'});
                    angular.forEach($scope.model.dataSets, function(ds){
                        for( var key in ds.organisationUnits ){
                            if($scope.lowestLevel < ds.organisationUnits[key]){
                                $scope.lowestLevel = ds.organisationUnits[key];
                            }
                        }
                        if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code ){
                            $scope.model.dataElementsByCode[ds.dataElements[0].code] = ds.dataElements[0];
                        }
                    });

                    MetaDataFactory.getAll('ouLevels').then(function(ouLevels){
                        angular.forEach(ouLevels, function(ol){
                            $scope.model.ouLevels[ol.level] = ol.displayName;
                        });                    
                        var res = CommonUtils.populateOuLevels($scope.selectedOrgUnit, $scope.model.ouLevels, $scope.lowestLevel);
                        $scope.model.ouModes = res.ouModes;
                        $scope.model.selectedOuMode = res.selectedOuMode;
                        $scope.model.availableRoles = {};

                        MetaDataFactory.getByProperty('optionSets', 'code', 'str').then(function(optionSet){

                            $scope.model.stakeholderInfo = optionSet;
                            if(!$scope.model.stakeholderInfo || $scope.model.stakeholderInfo.code !== 'str'){                
                                NotificationService.showNotifcationDialog('error', 'invalid_stakeholder_info_configuration');
                                return;
                            }
                            
                            var i=0;
                            angular.forEach(optionSet.options, function(option){
                                var domain = 'str';
                                if(option.code){
                                    option.code = option.code.toLocaleLowerCase();
                                    if(option.code === 'rmi' || option.code === 'sdm'){
                                        domain = option.code;
                                    }
                                }
                                
                                $scope.model.whoDoesWhatCols.push( {id: option.code, displayName: option.displayName, sortOrder: i, domain: domain} );
                                $scope.model.mappedRoles[option.code] = {};
                                i++;
                            });
                            
                            angular.forEach($scope.model.whoDoesWhatCols, function(col){
                                $scope.model.availableRoles[col.id] = [];
                            });
                        });
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
            status = $scope.geoCoverageForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.getReport = function(){
        
        //check for form validity
        $scope.geoCoverageForm.submitted = true;        
        if( $scope.geoCoverageForm.$invalid ){
            return;
        }
        
        if( !$scope.model.selectedDataSets.length || $scope.model.selectedDataSets.length < 1 ){            
            var dialogOptions = {
                headerText: $translate.instant('error'),
                bodyText: $translate.instant('please_select_actions')
            };		
            DialogService.showDialog({}, dialogOptions);
            return;
        }
        
        $scope.reportingOrgUnits = [];
        CommonUtils.getChildrenIds($scope.selectedOrgUnit, $scope.lowestLevel).then(function(response){
            $scope.model.orgUnits = response.orgUnits;
            $scope.model.orgUnitsById = response.orgUnitsById;
            
            angular.forEach($scope.model.orgUnits, function(ou){
                if(ou.level === $scope.model.selectedOuMode.level){
                    $scope.reportingOrgUnits.push((ou));
                }
            });

            $scope.showReportFilters = false;
            $scope.reportStarted = true;
            $scope.reportReady = false;
            $scope.noDataExists = false;
            $scope.model.reportDataElements = [];
            var dataValueSetUrl = 'period=' + $scope.model.selectedPeriod.id;
            angular.forEach($scope.model.selectedDataSets, function(ds){
                dataValueSetUrl += '&dataSet=' + ds.id;
            });

            angular.forEach($scope.model.orgUnits, function(ou){
                dataValueSetUrl += '&orgUnit=' + ou.id;
            });

            $scope.model.dataSetsByDataElementId = [];
            $scope.optionCombos = [];
            angular.forEach($scope.model.selectedDataSets, function(ds){
                if( ds.dataElements && ds.dataElements[0] ){
                    $scope.model.reportDataElements.push( ds.dataElements[0] );
                    $scope.model.dataSetsByDataElementId[ds.dataElements[0].id] = ds;
                    $scope.optionCombos = $scope.optionCombos.concat($scope.model.categoryCombos[ds.dataElements[0].categoryCombo.id].categoryOptionCombos);
                }
            });

            $scope.model.availableRoles = {};
            
            var reportParams = {
                orgUnit: $scope.selectedOrgUnit.id,
                period: $scope.model.selectedPeriod, 
                dataValueSetUrl: dataValueSetUrl
            };
            
            var reportData = {
                mappedRoles: $scope.model.mappedRoles,
                programCodesById: $scope.model.programCodesById,
                whoDoesWhatCols: $scope.model.whoDoesWhatCols,
                availableRoles: $scope.model.availableRoles,
                mappedOptionCombos: $scope.model.mappedOptionCombos,
                dataSetsByDataElementId: $scope.model.dataSetsByDataElementId,
                categoryCodeById: $scope.model.categoryCodeById,
                mappedCategoryOptions: $scope.model.mappedCategoryOptions
            };
            
            ReportService.getReportData( reportParams, reportData ).then(function(response){
                $scope.model.mappedRoles = response.mappedRoles;
                $scope.model.availableRoles = response.availableRoles;
                $scope.model.mappedValues = response.mappedValues;
                $scope.reportReady = response.reportReady;
                $scope.showReportFilters = response.showReportFilters;
                $scope.noDataExists = response.noDataExists;
                $scope.reportStarted = response.reportStarted;
                $scope.requiredCols = CommonUtils.getRequiredCols($scope.model.availableRoles, $scope.model.selectedRole);
            });            
        });    
    };
    
    $scope.valueExists = function(ou, de, oc){
        var filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: de});
        if( !filteredValues || !filteredValues.length || filteredValues.length === 0 ){
            return "empty-data-row";
        }
        
        if( oc ){
            filteredValues = $filter('filter')(filteredValues, {categoryOptionCombo: oc});
            if( !filteredValues || !filteredValues.length || filteredValues.length === 0 ){                
                return "empty-data-row";
            }
        }
        
        var values = [];
        angular.forEach(filteredValues, function(val){
            
            if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
                if( val.orgUnit === $scope.selectedOrgUnit.id || 
                        ( $scope.model.orgUnitsById[val.orgUnit] &&
                        $scope.model.orgUnitsById[val.orgUnit].path &&
                        $scope.model.orgUnitsById[val.orgUnit].path.indexOf(ou.id) !== -1)
                        ){
                    values.push( val );
                }
            }
            else{
                if( $scope.model.selectedRole && $scope.model.selectedRole.id && val[$scope.model.selectedRole.id] ){
                    values.push( val );
                }
            }                        
        });
        
        if( values.length === 0 ){                
            return "empty-data-row";
        }
        
    };
    
    $scope.getValuePerRole = function( ou, col, deId, ocId ){        
        var filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: deId, categoryOptionCombo: ocId});
        var checkedOus = {};        
        var value = 0;
        var selectedDataSet = $scope.model.dataSetsByDataElementId[deId];
        if( !selectedDataSet ){
            NotificationService.showNotifcationDialog('error', 'missing_action');
            return;
        }
        
        angular.forEach(filteredValues, function(val){
            if( val[$scope.model.selectedRole.id] && 
                    val[$scope.model.selectedRole.id].length 
                    && val[$scope.model.selectedRole.id].indexOf( col ) !== -1){
                
                if( !$scope.model.orgUnitsById[val.orgUnit]){
                    console.log('missing orgunit:  ', val.orgUnit);
                    return;
                }
                
                if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
                    
                    if( val.orgUnit === $scope.selectedOrgUnit.id || 
                            ( $scope.model.orgUnitsById[val.orgUnit] &&
                            $scope.model.orgUnitsById[val.orgUnit].path &&
                            $scope.model.orgUnitsById[val.orgUnit].path.indexOf(ou.id) !== -1)
                            ){                    
                        if( !checkedOus[col] ){
                            checkedOus[col] = [];
                        }
                        if( $scope.model.orgUnitsById[val.orgUnit] && checkedOus[col].indexOf( val.orgUnit ) === -1){
                            value++;
                            checkedOus[col].push( val.orgUnit );
                        }
                    }
                }
                else{
                    if( !checkedOus[col] ){
                        checkedOus[col] = [];
                    }
                    if( $scope.model.orgUnitsById[val.orgUnit] && checkedOus[col].indexOf( val.orgUnit ) === -1){
                        value++;
                        checkedOus[col].push( val.orgUnit );
                    }
                }
            }            
        });

        var totalChildren = 0;
        angular.forEach($scope.model.orgUnits, function(o){
            if(o.id !== ou.id && o.path && o.path.indexOf(ou.id) !== -1 ){
               if( selectedDataSet.organisationUnits.hasOwnProperty(o.id) ){
                   totalChildren++;
               }
           } 
        });
        
        totalChildren = totalChildren === 0 ? 1 : totalChildren;
        return value === 0 ? "" : value + " (" + CommonUtils.getPercent( value, totalChildren) + ")";
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        
        var reportName = CommonUtils.getReportName($translate.instant('geo_coverage_per_sh'), 
                                        $scope.model.selectedRole,
                                        $scope.selectedOrgUnit.n,
                                        $scope.model.selectedOuMode,
                                        $scope.model.selectedPeriod.name);
        
        saveAs(blob, reportName);
    };
});
