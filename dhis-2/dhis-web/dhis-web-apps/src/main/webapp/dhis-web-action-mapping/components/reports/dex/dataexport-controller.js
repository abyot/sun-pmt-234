/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('DataExportController',
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
        indicatorsMappedByNumerator: [],
        selectedIndicators: [],
        dataSets: null,
        selectedDataSets: [],
        targetDataSets: null,
        ouLevels: [],
        dataElementsByCode: [],
        dataElementCodesById: [],
        dataSetsByDataElementId: [],
        selectedRole: null,
        mappedOptionCombos: null,
        roleDataElementsById: null,
        reportDataElements: null,
        whoDoesWhatCols: null,
        dataExportCols: null,
        mappedValues: null,
        mappedTargetValues: null,
        childrenIds: [],
        mappedRoles: {},
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
                        
                        angular.forEach($scope.model.indicators, function(ind){
                            ind = CommonUtils.getNumeratorAndDenominatorIds( ind );
                            if( ind.numerator ){
                                $scope.model.indicatorsMappedByNumerator[ind.numerator] = ind;
                            }
                        });

                        DataSetFactory.getActionAndTargetDataSets().then(function(dataSets){
                            $scope.model.dataSets = dataSets;
                            angular.forEach($scope.model.dataSets, function(ds){
                                for( var key in ds.organisationUnits ){
                                    if($scope.lowestLevel < ds.organisationUnits[key].level){
                                        $scope.lowestLevel = ds.organisationUnits[key].level;
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
        
        $scope.model.orgUnits = [];
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

            $scope.model.selectedDataSets = $scope.model.selectedDataSets.concat( $scope.model.targetDataSets );
            
            var dataValueSetUrl = 'period=' + $scope.model.selectedPeriod.id;
            angular.forEach($scope.model.selectedDataSets, function(ds){
                dataValueSetUrl += '&dataSet=' + ds.id;
            });

            angular.forEach($scope.model.orgUnits, function(ou){
                dataValueSetUrl += '&orgUnit=' + ou.id;
            });

            angular.forEach($scope.model.selectedDataSets, function(ds){
                if( ds.dataSetType && ds.dataSetType === 'action' && ds.dataElements && ds.dataElements[0] ){
                    $scope.model.reportDataElements.push( ds.dataElements[0] );
                }
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
            
            $scope.model.dataHeaders = [
                {id: 'action', displayName: $translate.instant('action'), domain:'HD'},
                {id: 'orgUnit', displayName: $translate.instant('reporting_level') ,domain:'HD'},
                {id: 'targetGroup', displayName: $translate.instant('target_group') ,domain:'HD'},
                {id: 'targetPopulation', displayName: $translate.instant('target_population') ,domain:'HD'},
                {id: 'beneficiaries', displayName: $translate.instant('beneficiaries') ,domain:'HD'}
            ];
            
            $scope.model.dataHeaders = $scope.model.dataHeaders.concat( $scope.model.whoDoesWhatCols );
            $scope.model.dataHeaders.push( {id: 'mappingYear', displayName: $translate.instant('mapping_year') ,domain:'HD'} );

            $scope.model.dataRows = {};
            ReportService.getReportData( reportParams, reportData ).then(function(response){
                $scope.model.mappedRoles = response.mappedRoles;
                $scope.model.availableRoles = response.availableRoles;
                $scope.model.mappedValues = response.mappedValues;
                $scope.model.mappedTargetValues = response.mappedTargetValues;
                $scope.reportReady = response.reportReady;
                $scope.showReportFilters = response.showReportFilters;
                $scope.noDataExists = response.noDataExists;
                $scope.reportStarted = response.reportStarted;
                $scope.noDataExists = false;

                var pushDataRows = function( de, oc, ou ){
                    
                    var dataRow = $scope.model.dataRows[de.id] || {};
                    var targetPopulation = dataRow.targetPopulation || 0, 
                            beneficiaries = dataRow.beneficiaries || 0, 
                            roles = dataRow.roles || {};
                    
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

                        angular.forEach($scope.model.whoDoesWhatCols, function(wdwc){
                            if(value[wdwc.id]){
                                if(!roles[wdwc.id]){
                                    roles[wdwc.id] = [];
                                }
                                angular.forEach(value[wdwc.id], function(v){
                                    if(v && roles[wdwc.id].indexOf(v) === -1){
                                        roles[wdwc.id].push(v);
                                    }
                                });
                            }
                        });
                    });
                    
                    var ind = $scope.model.indicatorsMappedByNumerator[de.id];
                    if( ind && ind.denominator && ind.denominatorOptionCombo ){
                        var targetValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: ind.denominator, categoryOptionCombo: ind.denominatorOptionCombo, orgUnit: ou.id});
                        angular.forEach(targetValues, function(value){
                            targetPopulation = CommonUtils.getSum(targetPopulation, value.value);
                        });
                    }

                    $scope.model.dataRows[de.id] = {
                        action:  de.displayName,
                        actionCategory: de.displayName,
                        orgUnit: $scope.selectedOrgUnit.n,
                        targetGroup: oc.displayName,
                        targetPopulation: targetPopulation,
                        beneficiaries: beneficiaries,
                        mappingYear: $scope.model.selectedPeriod.id,
                        roles: roles
                    };
                };

                angular.forEach($scope.model.reportDataElements, function(de){
                    angular.forEach($scope.model.categoryCombos[de.categoryCombo.id].categoryOptionCombos, function(oc){
                        angular.forEach($scope.model.orgUnits, function(ou){
                            if(ou.path && ou.path.indexOf($scope.selectedOrgUnit.id) !== -1){
                               pushDataRows(de, oc, ou);
                            }
                        });
                    });
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
