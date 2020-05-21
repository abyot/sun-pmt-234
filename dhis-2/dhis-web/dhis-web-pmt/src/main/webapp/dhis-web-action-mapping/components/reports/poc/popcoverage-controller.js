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
        programs: null,
        programsByCode: [],
        programCodesById: [],
        dataElementsByCode: [],
        dataElementCodesById: [],
        dataSetsByDataElementId: [],
        selectedPrograms: null,
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
            
            CommonUtils.getChildrenIds($scope.selectedOrgUnit).then(function(response){
                $scope.model.childrenIds = response.childrenIds;
                $scope.model.children = response.children;
                $scope.model.childrenByIds = response.childrenByIds;
                $scope.model.allChildren = response.allChildren;
            });
            
            $scope.model.programs = [];
            $scope.model.roleDataElementsById = [];
            $scope.model.roleDataElements = [];
            MetaDataFactory.getAll('programs').then(function(programs){
                $scope.model.programs = programs;
                angular.forEach(programs, function(program){
                    if( program.programStages && program.programStages[0] && program.programStages[0].programStageDataElements ){
                        angular.forEach(program.programStages[0].programStageDataElements, function(prStDe){
                            if( prStDe.dataElement && prStDe.dataElement.id && !$scope.model.roleDataElementsById[prStDe.dataElement.id]){                                
                                $scope.model.roleDataElementsById[prStDe.dataElement.id] = {displayName:  prStDe.dataElement.displayName, sortOrder: prStDe.sortOrder};
                            }                            
                        });
                    }                    
                    $scope.model.programsByCode[program.actionCode] = program;
                    $scope.model.programCodesById[program.id] = program.actionCode;
                });
                
                for( var k in $scope.model.roleDataElementsById ){
                    if( $scope.model.roleDataElementsById.hasOwnProperty( k ) ){
                        $scope.model.roleDataElements.push( {id: k, displayName: $scope.model.roleDataElementsById[k].displayName, sortOrder: $scope.model.roleDataElementsById[k].sortOrder, domain: 'EV'} );
                    }
                }
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
            
            $scope.model.categoryCombos = {};
            $scope.model.stakeholderCategories = [];
            $scope.model.pushedCategoryIds = [];
            MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                angular.forEach(ccs, function(cc){
                    $scope.model.categoryCombos[cc.id] = cc;
                });
                
                $scope.model.indicators = [];
                $scope.model.dataSets = [];
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
                            if( ds.dataSetType === 'action'){
                                if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code ){
                                    $scope.model.dataElementsByCode[ds.dataElements[0].code] = ds.dataElements[0];
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
                        
                        var len = angular.copy( $scope.model.roleDataElements.length );
                        var count = 1;
                        angular.forEach($scope.model.stakeholderCategories, function(c){
                            var ops = [];
                            angular.forEach(c.categoryOptions, function(o){
                                ops.push( o.displayName );
                            });
                            $scope.model.roleDataElements.push( {id: c.id, displayName: c.displayName, sortOrder: len + count, domain: 'CA', categoryOptions: ops});
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
        if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
            $scope.orgUnits = $scope.model.children;
        }
        else{
            $scope.orgUnits = [$scope.selectedOrgUnit];
        }
        
        resetParams();
        $scope.reportStarted = true;
        $scope.showReportFilters = false; 
        $scope.model.selectedDataSets = [];
        $scope.model.selectedDataSets = $scope.model.selectedDataSets.concat( $scope.model.targetDataSets );
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
        
        $scope.model.selectedPrograms = [];
        $scope.model.dataElementCodesById = [];
        $scope.model.mappedRoles = {};
        $scope.optionCombos = [];
        angular.forEach($scope.model.selectedDataSets, function(ds){
            if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code && $scope.model.programsByCode[ds.dataElements[0].code] ){                
                var pr = $scope.model.programsByCode[ds.dataElements[0].code]; 
                if( pr && pr.actionCode ){
                    $scope.model.selectedPrograms.push( pr );
                    $scope.model.reportDataElements.push( ds.dataElements[0] );
                    $scope.model.dataElementCodesById[ds.dataElements[0].id] = ds.dataElements[0].code;
                    $scope.optionCombos = $scope.optionCombos.concat($scope.model.categoryCombos[ds.dataElements[0].categoryCombo.id].categoryOptionCombos);
                    $scope.model.mappedRoles[pr.actionCode] = {};
                }                
            }
        });
        
        $scope.model.availableRoles = {};
        var reportParams = {orgUnit: $scope.selectedOrgUnit.id, 
                        programs: $scope.model.selectedPrograms, 
                        period: $scope.model.selectedPeriod, 
                        dataValueSetUrl: dataValueSetUrl};
        var reportData = {mappedRoles: $scope.model.mappedRoles,
                        programCodesById: $scope.model.programCodesById,
                        roleDataElementsById: $scope.model.roleDataElementsById,
                        whoDoesWhatCols: $scope.model.whoDoesWhatCols,
                        availableRoles: $scope.model.availableRoles,
                        mappedOptionCombos: $scope.model.mappedOptionCombos,
                        dataElementCodesById: $scope.model.dataElementCodesById};
        
        ReportService.getReportData( reportParams, reportData ).then(function(response){            
            $scope.model.mappedRoles = response.mappedRoles;
            $scope.model.whoDoesWhatCols = response.whoDoesWhatCols;
            $scope.model.availableRoles = response.availableRoles;
            $scope.model.mappedValues = response.mappedValues;
            $scope.model.mappedTargetValues = response.mappedTargetValues;
            $scope.reportReady = response.reportReady;
            $scope.showReportFilters = response.showReportFilters;
            $scope.noDataExists = response.noDataExists;
            $scope.reportStarted = response.reportStarted;
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
                        ( $scope.model.childrenByIds[val.orgUnit] &&
                        $scope.model.childrenByIds[val.orgUnit].path &&
                        $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
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
                if( $scope.model.childrenIds.indexOf( val.orgUnit ) === -1 ){
                    console.log('missing orgunit:  ', val.orgUnit);
                    return;
                }
                
                if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){                    
                    if( val.orgUnit === $scope.selectedOrgUnit.id || 
                            ( $scope.model.childrenByIds[val.orgUnit] &&
                            $scope.model.childrenByIds[val.orgUnit].path &&
                            $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
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
                if( $scope.model.childrenIds.indexOf( val.orgUnit ) === -1 ){
                    console.log('missing orgunit:  ', val.orgUnit);
                    return;
                }
                
                if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){                    
                    if( val.orgUnit === $scope.selectedOrgUnit.id || 
                            ( $scope.model.childrenByIds[val.orgUnit] &&
                            $scope.model.childrenByIds[val.orgUnit].path &&
                            $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
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
