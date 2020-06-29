/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('PopCoverageController',
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
                NotificationService,
                ReportService) {
    $scope.periodOffset = 0;
    $scope.showReportFilters = true;
    $scope.reportReady = false;
    $scope.noDataExists = false;
    $scope.model = {
        ouModes: [],
        periods: [],
        indicators: [],
        selectedIndicators: [],
        dataSets: null,
        selectedDataSets: [],
        targetDataSets: null,
        ouLevels: [],
        dataSetsByDataElementId: [],
        selectedRole: null,
        mappedOptionCombos: null,
        roleDataElementsById: null,
        reportDataElements: null,
        whoDoesWhatCols: null,
        mappedValues: null,
        mappedTargetValues: null,
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
    }
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() { 
        $scope.model.selectedIndicators = [];
        $scope.model.selectedDataSets = [];
        $scope.model.selectedPeriod = null;
        $scope.model.selectedRole = null;
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

                $scope.model.availableRoles = {};

                $scope.model.stakeholderCategories = [];
                $scope.model.pushedCategoryIds = [];
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

                    $scope.model.indicators = [];
                    $scope.model.dataSets = [];
                    $scope.lowestLevel = 0;
                    $scope.model.targetDataSets = [];
                    MetaDataFactory.getAll('indicatorGroups').then(function(idgs){
                        idgs = $filter('filter')(idgs, {isAction: true});
                        angular.forEach(idgs, function(idg){
                            if( idg.indicators && idg.indicators.length > 0 ){
                                $scope.model.indicators = $scope.model.indicators.concat( idg.indicators );
                            }
                        });

                        DataSetFactory.getActionAndTargetDataSets().then(function(dataSets){
                            $scope.model.dataSets = dataSets;
                            angular.forEach($scope.model.dataSets, function(ds){
                                for( var key in ds.organisationUnits ){
                                    if($scope.lowestLevel < ds.organisationUnits[key]){
                                        $scope.lowestLevel = ds.organisationUnits[key];
                                    }
                                }

                                if( ds.dataSetType === 'action'){
                                    if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code ){
                                        $scope.model.dataSetsByDataElementId[ds.dataElements[0].id] = ds;
                                        var res = CommonUtils.getStakeholderCategoryFromDataSet(ds, $scope.model.categoryCombos, $scope.model.stakeholderCategories, $scope.model.pushedCategoryIds);
                                        $scope.model.stakeholderCategories = res.categories;
                                        $scope.model.pushedCategoryIds = res.categoryIds;
                                    }
                                }
                                else{
                                    $scope.model.targetDataSets.push( ds );
                                }
                            });
                            MetaDataFactory.getAll('ouLevels').then(function(ouLevels){
                                angular.forEach(ouLevels, function(ol){
                                    $scope.model.ouLevels[ol.level] = ol.displayName;
                                });
                                var res = CommonUtils.populateOuLevels($scope.selectedOrgUnit, $scope.model.ouLevels, $scope.lowestLevel);
                                $scope.model.ouModes = res.ouModes;
                                $scope.model.selectedOuMode = res.selectedOuMode;
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
            status = $scope.popCoverageForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.getReport = function(){
        
        //check for form validity
        $scope.popCoverageForm.submitted = true;        
        if( $scope.popCoverageForm.$invalid ){
            return false;
        }
        
        if( !$scope.model.selectedIndicators.length || $scope.model.selectedIndicators.length < 1 ){            
            var dialogOptions = {
                headerText: $translate.instant('error'),
                bodyText: $translate.instant('please_select_actions')
            };		
            DialogService.showDialog({}, dialogOptions);
            return;
        }
        
        $scope.orgUnits = [];
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

            $scope.model.selectedDataSets = [];
            $scope.model.selectedDataSets = $scope.model.selectedDataSets.concat( $scope.model.targetDataSets );
            $scope.model.mappedRoles = {};

            angular.forEach($scope.model.selectedIndicators, function(ind){
                ind = CommonUtils.getNumeratorAndDenominatorIds( ind );
                if( $scope.model.dataSetsByDataElementId[ind.numerator] ){
                    $scope.model.selectedDataSets.push( $scope.model.dataSetsByDataElementId[ind.numerator] );
                }
            });

            var dataValueSetUrl = 'period=' + $scope.model.selectedPeriod.id;
            angular.forEach($scope.model.selectedDataSets, function(ds){
                dataValueSetUrl += '&dataSet=' + ds.id;
            });

            angular.forEach($scope.model.orgUnits, function(ou){
                dataValueSetUrl += '&orgUnit=' + ou.id;
            });

            var reportParams = {
                orgUnit: $scope.selectedOrgUnit.id,
                period: $scope.model.selectedPeriod,
                dataValueSetUrl: dataValueSetUrl
            };

            var reportData = {
                mappedRoles: $scope.model.mappedRoles,
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
                $scope.model.mappedTargetValues = response.mappedTargetValues;
                $scope.reportReady = response.reportReady;
                $scope.showReportFilters = response.showReportFilters;
                $scope.noDataExists = response.noDataExists;
                $scope.reportStarted = response.reportStarted;
                $scope.requiredCols = CommonUtils.getRequiredCols($scope.model.availableRoles, $scope.model.selectedRole);
            });
        });
    };
    
    $scope.getRequiredCols = function(){
        return CommonUtils.getRequiredCols($scope.model.availableRoles, $scope.model.selectedRole);
    };
    
    $scope.valueExists = function(ou, ind){        
        ind = CommonUtils.getNumeratorAndDenominatorIds( ind );
        var filteredNumerators = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: ind.numerator, categoryOptionCombo: ind.numeratorOptionCombo});
        var filteredDenominators = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: ind.denominator, categoryOptionCombo: ind.denominatorOptionCombo});
        
        if( !filteredNumerators || !filteredNumerators.length || filteredNumerators.length === 0 ||
            !filteredDenominators || !filteredDenominators.length || filteredDenominators.length === 0 ){
            return "empty-data-row";
        }        
        var values = [];
        angular.forEach(filteredNumerators, function(val){            
            
            if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){                
                if( val.orgUnit === $scope.selectedOrgUnit.id || 
                        ( $scope.model.orgUnitsById[val.orgUnit] &&
                        $scope.model.orgUnitsById[val.orgUnit].path &&
                        $scope.model.orgUnitsById[val.orgUnit].path.indexOf(ou.id) !== -1)
                        ){                    

                    var curDen = $filter('filter')(filteredDenominators, {orgUnit: val.orgUnit});
                    if( curDen && curDen.length && curDen[0] && curDen[0].value ){
                        values.push( val );
                    }
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
    
    $scope.getValuePerRole = function( ou, col, ind ){        
        ind = CommonUtils.getNumeratorAndDenominatorIds( ind );
        var filteredNumerators = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: ind.numerator, categoryOptionCombo: ind.numeratorOptionCombo});
        var filteredDenominators = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: ind.denominator, categoryOptionCombo: ind.denominatorOptionCombo});
        
        var numCheckedOus = {}, denCheckedOus = {};        
        var numerator = 0;
        var denominator = 0;
        var numValueCount = 0, denValueCount = 0;
        angular.forEach(filteredNumerators, function(val){
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
                        if( !numCheckedOus[col] ){
                            numCheckedOus[col] = [];
                        }
                        //if( numCheckedOus[col].indexOf( val.orgUnit ) === -1){

                            var curDen = $filter('filter')(filteredDenominators, {orgUnit: val.orgUnit});
                            
                            if( curDen && curDen.length && curDen[0] && curDen[0].value ){
                                //denominator = CommonUtils.getSum( denominator, curDen[0].value);
                                numerator = CommonUtils.getSum( numerator, val.value);
                                numValueCount++;
                            }

                            numCheckedOus[col].push( val.orgUnit );
                        //}
                    }
                }
                else{
                    if( !numCheckedOus[col] ){
                        numCheckedOus[col] = [];
                    }
                    //if( numCheckedOus[col].indexOf( val.orgUnit ) === -1){
                        
                        var curDen = $filter('filter')(filteredDenominators, {orgUnit: val.orgUnit});
                        if( curDen && curDen.length && curDen[0] && curDen[0].value ){
                            //denominator = CommonUtils.getSum( denominator, curDen[0].value);
                            numerator = CommonUtils.getSum( numerator, val.value);
                            numValueCount++;
                        }

                        numCheckedOus[col].push( val.orgUnit );
                    //}
                }
            }            
        });
        
        angular.forEach(filteredDenominators, function(val){
            //if( val[$scope.model.selectedRole.id] && val[$scope.model.selectedRole.id].length && val[$scope.model.selectedRole.id].indexOf( col ) !== -1){                
                if(!$scope.model.orgUnitsById[val.orgUnit]){
                    console.log('missing orgunit:  ', val.orgUnit);
                    return;
                }
                
                if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){                    
                    if( val.orgUnit === $scope.selectedOrgUnit.id || 
                            ( $scope.model.orgUnitsById[val.orgUnit] &&
                            $scope.model.orgUnitsById[val.orgUnit].path &&
                            $scope.model.orgUnitsById[val.orgUnit].path.indexOf(ou.id) !== -1)
                            ){                    
                        if( !denCheckedOus[col] ){
                            denCheckedOus[col] = [];
                        }
                        if( denCheckedOus[col].indexOf( val.orgUnit ) === -1){

                            var curDen = $filter('filter')(filteredDenominators, {orgUnit: val.orgUnit});
                            
                            if( curDen && curDen.length && curDen[0] && curDen[0].value ){
                                denominator = CommonUtils.getSum( denominator, curDen[0].value);
                                //numerator = CommonUtils.getSum( numerator, val.value);
                                denValueCount++;
                            }

                            denCheckedOus[col].push( val.orgUnit );
                        }
                    }
                }
                else{
                    if( !denCheckedOus[col] ){
                        denCheckedOus[col] = [];
                    }
                    if( denCheckedOus[col].indexOf( val.orgUnit ) === -1){
                        
                        var curDen = $filter('filter')(filteredDenominators, {orgUnit: val.orgUnit});
                        if( curDen && curDen.length && curDen[0] && curDen[0].value ){
                            denominator = CommonUtils.getSum( denominator, curDen[0].value);
                            //numerator = CommonUtils.getSum( numerator, val.value);
                            denValueCount++;
                        }

                        denCheckedOus[col].push( val.orgUnit );
                    }
                }
            //}            
        });
        
        //return numerator + " / " + denominator;
        //return valueCount > 0 ? CommonUtils.getPercent(numerator, denominator) : "";
        return CommonUtils.getPercent(numerator, denominator);
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        
        var reportName = CommonUtils.getReportName($translate.instant('pop_coverage_per_sh'), 
                                        $scope.model.selectedRole,
                                        $scope.selectedOrgUnit.n,
                                        $scope.model.selectedOuMode,
                                        $scope.model.selectedPeriod.name);
        
        saveAs(blob, reportName);
    };
});
