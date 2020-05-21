/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('DataExportController',
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
    $scope.dataEntryOuLevel = 3;
    $scope.showReportFilters = true;
    $scope.reportReady = false;
    $scope.noDataExists = false;    
    $scope.model = {
        ouModes: [],
        periods: [],
        indicators: [],
        indicatorsMappedByNumerator: [],
        selectedIndicators: [],
        dataSets: null,
        selectedDataSets: [],
        targetDataSets: null,
        ouLevels: [],
        dataEntryLevel: null,
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
        dataExportCols: null,
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
        $scope.model.dataExportCols = [];
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
                    if( program.actionCode && program.programStages && program.programStages[0] && program.programStages[0].programStageDataElements ){
                        angular.forEach(program.programStages[0].programStageDataElements, function(prStDe){
                            if( prStDe.dataElement && prStDe.dataElement.id && !$scope.model.roleDataElementsById[prStDe.dataElement.id]){                                
                                $scope.model.roleDataElementsById[prStDe.dataElement.id] = {displayName:  prStDe.dataElement.displayName, sortOrder: prStDe.sortOrder};
                            }                            
                        });
                        $scope.model.programsByCode[program.actionCode] = program;
                        $scope.model.programCodesById[program.id] = program.actionCode;
                    }                    
                });
                
                for( var k in $scope.model.roleDataElementsById ){
                    if( $scope.model.roleDataElementsById.hasOwnProperty( k ) ){
                        var de = $scope.model.roleDataElementsById[k];
                        $scope.model.roleDataElements.push( {id: k, displayName: de.displayName, sortOrder: de.sortOrder, domain: 'EV', code: de.code} );
                    }
                }
            });
                        
            MetaDataFactory.getAll('ouLevels').then(function(ouLevels){
                angular.forEach(ouLevels, function(ol){
                    $scope.model.ouLevels[ol.level] = ol.displayName;
                    if( ol.level === $scope.dataEntryOuLevel ){
                        $scope.model.dataEntryLevel = ol;
                    }
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
            $scope.model.dmCategoryId = null;
            $scope.model.orgCategory = null;
            $scope.model.dmCategory = null;
            $scope.model.fiCategory = null;
            $scope.model.keyCategories = [];
            MetaDataFactory.getAll('categoryCombos').then(function(ccs){                
                angular.forEach(ccs, function(cc){
                    if( cc.code === 'DM-FI' && cc.categories && cc.categories.length > 0 ){
                        $scope.model.keyCategories = cc.categories;
                        angular.forEach(cc.categories, function(ca){
                            ca.domain = 'EV';
                            if( ca.code === 'ORG' ){                                
                                $scope.model.orgCategory = ca;
                            }
                            else if( ca.code === 'FI') {
                                $scope.model.fiCategory = ca;
                            }
                            else if( ca.code === 'DM') {
                                $scope.model.dmCategory = ca;
                            }
                        });
                    }
                    $scope.model.categoryCombos[cc.id] = cc;
                });
                
                $scope.model.indicators = [];
                $scope.model.dataSets = [];
                $scope.model.targetDataSets = [];
                $scope.model.indicatorsMappedByNumerator = [];
                MetaDataFactory.getAll('indicatorGroups').then(function(idgs){                
                    idgs = $filter('filter')(idgs, {isAction: true});
                    angular.forEach(idgs, function(idg){                    
                        if( idg.indicators && idg.indicators.length > 0 ){
                            $scope.model.indicators = $scope.model.indicators.concat( idg.indicators );
                        }
                    });
                    
                    angular.forEach($scope.model.indicators, function(ind){
                        ind = CommonUtils.getNumeratorAndDenominatorIds( ind );
                        if( ind.numerator ){
                            $scope.model.indicatorsMappedByNumerator[ind.numerator] = ind;
                        }
                    });

                    DataSetFactory.getActionAndTargetDataSets().then(function(dataSets){
                        $scope.model.dataSets = $filter('filter')(dataSets, {dataSetType: 'action'});
                        $scope.model.targetDataSets = $filter('filter')(dataSets, {dataSetType: 'targetGroup'});
                        
                        angular.forEach(dataSets, function(ds){
                            if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code ){
                                $scope.model.dataElementsByCode[ds.dataElements[0].code] = ds.dataElements[0];
                                $scope.model.dataSetsByDataElementId[ds.dataElements[0].id] = ds;
                                var res = CommonUtils.getStakeholderCategoryFromDataSet(ds, $scope.model.categoryCombos, $scope.model.stakeholderCategories, $scope.model.pushedCategoryIds);
                                $scope.model.stakeholderCategories = res.categories;
                                $scope.model.pushedCategoryIds = res.categoryIds;
                            }
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
            return false;
        }
        
        if( !$scope.model.selectedDataSets.length || $scope.model.selectedDataSets.length < 1 ){            
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
        
        $scope.model.selectedDataSets = $scope.model.selectedDataSets.concat( $scope.model.targetDataSets );       
        
        var dataValueSetUrl = 'period=' + $scope.model.selectedPeriod.id;
        angular.forEach($scope.model.selectedDataSets, function(ds){
            dataValueSetUrl += '&dataSet=' + ds.id;
        });
        
        if( $scope.selectedOrgUnit.l === $scope.dataEntryOuLevel ){
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
        
        resetParams();
        $scope.reportStarted = true;
        $scope.showReportFilters = false;
        
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
        $scope.model.dataHeaders = [
            {id: 'action', displayName: $translate.instant('action'), domain:'HD'},
            {id: 'actionCategory', displayName: $translate.instant('action_category') ,domain:'HD'},
            {id: 'parentOrgUnit', displayName: $translate.instant('sub_national_1') ,domain:'HD'},
            {id: 'orgUnit', displayName: $translate.instant('sub_national_2') ,domain:'HD'},
            {id: 'targetGroup', displayName: $translate.instant('target_group') ,domain:'HD'},
            {id: 'targetPopulation', displayName: $translate.instant('target_population') ,domain:'HD'},
            {id: 'beneficiaries', displayName: $translate.instant('beneficiaries') ,domain:'HD'}
        ];
        
        if( $scope.model.orgCategory !== null ){
            $scope.model.dataHeaders.splice(0, 0, $scope.model.orgCategory);
        }
        
        if( $scope.model.dmCategory !== null){
            $scope.model.dataHeaders.push( $scope.model.dmCategory );
        }
        
        if( $scope.model.fiCategory !== null){
            $scope.model.dataHeaders.push( $scope.model.fiCategory );
        }
        
        $scope.model.dataHeaders = $scope.model.dataHeaders.concat( $scope.model.roleDataElements );
        $scope.model.dataHeaders.push( {id: 'mappingYear', displayName: $translate.instant('mapping_year') ,domain:'HD'} );
        
        $scope.model.dataRows = [];
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
            $scope.noDataExists = false;
            
            var pushDataRows = function( de, oc, ou ){
                
                var targetPopulation = '', beneficiaries = 0, roles = {};
                var values = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: de.id, categoryOptionCombo: oc.id, orgUnit: ou.id});                
                
                angular.forEach(values, function(value){
                    beneficiaries = CommonUtils.getSum(beneficiaries, value.value);
                    
                    angular.forEach($scope.model.keyCategories, function(cat){
                        if(value[cat.id]){
                            if(!roles[cat.id]){
                                roles[cat.id]=[];
                            }
                            angular.forEach(value[cat.id], function(v){
                                if(v && roles[cat.id].indexOf(v) === -1){
                                    roles[cat.id].push(v);
                                }
                            });                            
                        }
                    });                    
                    
                    angular.forEach($scope.model.roleDataElements, function(rde){
                        if(value[rde.id]){
                            if(!roles[rde.id]){
                                roles[rde.id] = [];
                            }
                            angular.forEach(value[rde.id], function(v){
                                if(v && roles[rde.id].indexOf(v) === -1){
                                    roles[rde.id].push(v);
                                }
                            });
                        }
                    });
                });
                
                var ind = $scope.model.indicatorsMappedByNumerator[de.id];            
                if( ind && ind.denominator && ind.denominatorOptionCombo && $scope.model.mappedTargetValues[ind.denominator] && $scope.model.mappedTargetValues[ind.denominator][ou.id] ){
                    targetPopulation = $scope.model.mappedTargetValues[ind.denominator][ou.id][ind.denominatorOptionCombo]; 
                }
                
                $scope.model.dataRows.push({
                    action:  de.displayName,
                    actionCategory: de.displayName,
                    parentOrgUnit: ou.parent.displayName,
                    orgUnit: ou.displayName,
                    targetGroup: oc.displayName,
                    targetPopulation: targetPopulation,
                    beneficiaries: beneficiaries,
                    mappingYear: $scope.model.selectedPeriod.id,
                    roles: roles
                });
            };
            
            angular.forEach($scope.model.reportDataElements, function(de){
                angular.forEach($scope.model.categoryCombos[de.categoryCombo.id].categoryOptionCombos, function(oc){
                    if( $scope.selectedOrgUnit.l === 1 ){
                        var ous = orderByFilter($filter('filter')($scope.model.allChildren, {level: 2}), '-displayName').reverse();                        
                        angular.forEach(ous, function(ou){
                            var _ous = orderByFilter($filter('filter')($scope.model.allChildren, {parent: {id: ou.id}}), '-displayName').reverse();                            
                            angular.forEach(_ous, function(ou){
                               pushDataRows(de, oc, ou);
                            });
                        });
                    }
                    else if( $scope.selectedOrgUnit.l === 2 ){
                        angular.forEach($scope.model.children, function(ou){
                            pushDataRows(de, oc, ou);
                        });
                    }
                    else if( $scope.selectedOrgUnit.l === 3 ){
                        var ou = $scope.model.allChildren[0];
                        pushDataRows(de, oc, ou);
                    }
                });
            });
        });
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
