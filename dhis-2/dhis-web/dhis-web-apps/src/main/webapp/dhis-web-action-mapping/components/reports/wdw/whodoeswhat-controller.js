/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('WhoDoesWhatController',
        function($scope,
                $filter,
                $translate,
                SessionStorageService,
                DialogService,
                PeriodService,
                MetaDataFactory,
                OptionComboService,
                ReportService,
                NotificationService,
                CommonUtils) {
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
        mappedOptionCombos: null,
        roleDataElementsById: null,
        reportDataElements: null,
        whoDoesWhatCols: null,
        mappedValues: null,
        stakeholderInfo: null,
        orgUnitsById: [],
        orgUnits: []};
    
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

            $scope.model.programs = [];
            $scope.model.roleDataElementsById = [];
            $scope.model.roleDataElements = [];
            $scope.model.mappedRoles = {};
            
            $scope.model.mappedOptionCombos = [];
            OptionComboService.getMappedOptionCombos().then(function(ocos){
                $scope.model.mappedOptionCombos = ocos;
            });
            
            $scope.model.categoryCombos = {};
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
                            
                            if( ca.code === 'FI') {
                                $scope.model.fiCategory = ca;
                                $scope.model.whoDoesWhatCols.push( {id: ca.code, displayName: ca.displayName, sortOrder: 1, domain: 'str'} );
                            }
                            else if( ca.code === 'DM') {
                                $scope.model.dmCategory = ca;
                                $scope.model.whoDoesWhatCols.push( {id: ca.code, displayName: ca.displayName, sortOrder: 0, domain: 'dme'} );
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
                    });

                    MetaDataFactory.getAll('ouLevels').then(function(ouLevels){
                        angular.forEach(ouLevels, function(ol){
                            $scope.model.ouLevels[ol.level] = ol.displayName;
                        });                    
                        var res = CommonUtils.populateOuLevels($scope.selectedOrgUnit, $scope.model.ouLevels, $scope.lowestLevel);
                        $scope.model.ouModes = res.ouModes;
                        $scope.model.selectedOuMode = res.selectedOuMode;

                        MetaDataFactory.getByProperty('optionSets', 'code', 'str').then(function(optionSet){

                            $scope.model.stakeholderInfo = optionSet;
                            if(!$scope.model.stakeholderInfo || $scope.model.stakeholderInfo.code !== 'str'){                
                                NotificationService.showNotifcationDialog('error', 'invalid_stakeholder_info_configuration');
                                return;
                            }
                            
                            var i=0;
                            angular.forEach(optionSet.options, function(option){
                                if(option.code){
                                    option.code = option.code.toLocaleLowerCase();
                                }
                                $scope.model.whoDoesWhatCols.push( {id: option.code, displayName: option.displayName, sortOrder: i, domain: 'str'} );
                                $scope.model.mappedRoles[option.code] = {};
                                i++;
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
            status = $scope.reportForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.getReport = function(){
        //check for form validity        
        $scope.reportForm.submitted = true;        
        if( $scope.reportForm.$invalid ){
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

            $scope.model.mappedRoles = {};
            $scope.optionCombos = [];
            angular.forEach($scope.model.selectedDataSets, function(ds){
                if( ds.dataElements && ds.dataElements[0] ){
                    $scope.model.reportDataElements.push( ds.dataElements[0] );
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
                roleDataElementsById: $scope.model.roleDataElementsById,
                whoDoesWhatCols: $scope.model.whoDoesWhatCols,
                availableRoles: $scope.model.availableRoles,
                mappedOptionCombos: $scope.model.mappedOptionCombos,
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
            });
            
        });
    };
    
    $scope.valueExists = function(ou, de, oc){        
        var filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: de});        
        if( !filteredValues || !filteredValues.length || filteredValues.length === 0 ){
            return "empty-data-row";
        }
        
        if( oc ){
            filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {categoryOptionCombo: oc});
            if( !filteredValues || !filteredValues.length || filteredValues.length === 0 ){
                return "empty-data-row";
            }
        }        
        
        if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
            var values = [];
            angular.forEach(filteredValues, function(val){            
                if( val.orgUnit === $scope.selectedOrgUnit.id || 
                        ( $scope.model.orgUnitsById[val.orgUnit] &&
                        $scope.model.orgUnitsById[val.orgUnit].path &&
                        $scope.model.orgUnitsById[val.orgUnit].path.indexOf(ou.id) !== -1)
                        ){                    
                    values.push( val );
                }
            });
            
            if( values.length === 0 ){
                return "empty-data-row";
            }
        }        
    };
    
    $scope.getStakeholders = function( ou, col, deId, ocId ){
        var filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: deId, categoryOptionCombo: ocId});
        var role = [];        
        angular.forEach(filteredValues, function(val){            
            if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
                
                if( val.orgUnit === $scope.selectedOrgUnit.id || 
                        ( $scope.model.orgUnitsById[val.orgUnit] &&
                        $scope.model.orgUnitsById[val.orgUnit].path &&
                        $scope.model.orgUnitsById[val.orgUnit].path.indexOf(ou.id) !== -1)
                        ){                    
                    if( val[col.id] ){
                        angular.forEach(val[col.id], function(v){
                            if( role.indexOf(v) === -1){
                                role.push( v );
                            }
                        });
                    }
                }
            }
            else{
                if( val[col.id] ){
                    angular.forEach(val[col.id], function(v){
                        if( role.indexOf(v) === -1){
                            role.push( v );
                        }
                    });
                }
            }            
        });
        var r = role.sort().join(", ");
        return r;
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        
        var reportName = CommonUtils.getReportName($translate.instant('who_does_what'), 
                                        $scope.model.selectedRole,
                                        $scope.selectedOrgUnit.n,
                                        $scope.model.selectedOuMode,
                                        $scope.model.selectedPeriod.name);
        
        saveAs(blob, reportName);
    };
});
