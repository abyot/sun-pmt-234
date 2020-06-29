/* global angular */

'use strict';

var sunFinance = angular.module('sunFinance');

//Controller for settings page
sunFinance.controller('dataEntryController',
        function($scope,
                $filter,
                $modal,
                $translate,
                orderByFilter,
                SessionStorageService,
                storage,
                DataSetFactory,
                PeriodService,
                MetaDataFactory,
                CommonUtils,
                DataValueService,
                CompletenessService,
                ModalService,
                DialogService,
                NotificationService) {
    $scope.periodOffset = 0;
    $scope.saveStatus = {};    
    $scope.model = {invalidDimensions: false,
                    categoryCombos: [],
                    selectedAttributeCategoryCombo: null,
                    standardDataSets: [],
                    multiDataSets: [],
                    dataSets: [],
                    optionSets: null,
                    categoryOptionsReady: false,
                    allowMultiOrgUnitEntry: false,
                    dataValues: {},
                    optionCombosById: {},
                    selectedAttributeOptionCombos: {},
                    selectedAttributeOptionCombo: null,
                    attributeCategoryUrl: null,
                    valueExists: false,
                    agenciesWithValue: {},
                    selectedAgency: null};
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        $scope.model.periods = [];
        $scope.model.dataSets = [];
        $scope.model.selectedDataSet = null;
        $scope.model.selectedPeriod = null;
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedAttributeOptionCombos = {};
        $scope.model.selectedAttributeOptionCombo = null;        
        $scope.model.categoryOptionsReady = false;
        resetParams();
        if( angular.isObject($scope.selectedOrgUnit)){
            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit); 
            var systemSetting = storage.get('SYSTEM_SETTING');
            $scope.model.allowMultiOrgUnitEntry = systemSetting && systemSetting.multiOrganisationUnitForms ? systemSetting.multiOrganisationUnitForms : false;
            loadOptionSets();
            $scope.loadDataSets($scope.selectedOrgUnit);
        }
    });
        
    function loadOptionSets() {        
        if(!$scope.model.optionSets){
            $scope.model.optionSets = [];
            MetaDataFactory.getAll('optionSets').then(function(optionSets){
                angular.forEach(optionSets, function(optionSet){
                    $scope.model.optionSets[optionSet.id] = optionSet;
                });
            });
        }
    }
    
    function loadOptionCombos(){
        $scope.model.selectedAttributeCategoryCombo = null;     
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.categoryCombo && $scope.model.selectedDataSet.categoryCombo.id ){
            MetaDataFactory.get('categoryCombos', $scope.model.selectedDataSet.categoryCombo.id).then(function(coc){
                $scope.model.selectedAttributeCategoryCombo = coc;
                if( $scope.model.selectedAttributeCategoryCombo && $scope.model.selectedAttributeCategoryCombo.isDefault ){
                    $scope.model.categoryOptionsReady = true;
                }                
                angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(oco){
                    $scope.model.selectedAttributeOptionCombos['"' + oco.displayName + '"'] = oco.id;
                });

                angular.forEach($scope.model.selectedAttributeCategoryCombo.categories, function(cat){
                    cat.placeHolder = $translate.instant('select_or_search');
                });
            });
        }
    }    
    
    //load datasets associated with the selected org unit.
    $scope.loadDataSets = function(orgUnit) {
        $scope.selectedOrgUnit = orgUnit;
        $scope.model.dataSets = [];
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedAttributeOptionCombos = {};
        $scope.model.selectedAttributeOptionCombo = null;        
        $scope.model.selectedPeriod = null;
        $scope.model.categoryOptionsReady = false;
        if (angular.isObject($scope.selectedOrgUnit)) {
            DataSetFactory.getByOuAndProperty( $scope.selectedOrgUnit, 'dataSetType','budget' ).then(function(dataSets){
                $scope.model.dataSets = dataSets;
                $scope.model.dataSets = orderByFilter($scope.model.dataSets, '-displayName').reverse();
            });
        }        
    }; 
    
    //watch for selection of data set
    $scope.$watch('model.selectedDataSet', function() {        
        $scope.model.periods = [];
        $scope.model.selectedPeriod = null;
        $scope.model.categoryOptionsReady = false;
        resetParams();
        if( angular.isObject($scope.model.selectedDataSet ) && $scope.model.selectedDataSet.id ){
            $scope.loadDataSetDetails();
        }
    });
    
    $scope.$watch('model.selectedPeriod', function(){        
        $scope.model.dataValues = {};
        $scope.model.valueExists = false;
        $scope.loadDataEntryForm();
    });    
        
    $scope.loadDataSetDetails = function(){
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.id && $scope.model.selectedDataSet.periodType){ 
            
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
            
            if(!$scope.model.selectedDataSet.dataElements || $scope.model.selectedDataSet.dataElements.length < 1){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_data_elements_indicators"));
                return;
            }            
            
            if( $scope.model.selectedDataSet.dataElements.length > 1 ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_budget_data_element_length"));
                return;
            }
            
            loadOptionCombos();
            
            $scope.model.selectedCategoryCombos = {};
            var cocs = [];
            $scope.model.dataElementsById = {};
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                $scope.model.dataElementsById[de.id] = de;
                if ( cocs.indexOf( de.categoryCombo.id ) === - 1 ){
                    cocs.push( de.categoryCombo.id );
                }                
            });

            if ( cocs.length !== 1 )
            {
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_budget_dimension_configuration"));
                return;
            }
            
            MetaDataFactory.get('categoryCombos', cocs[0]).then(function(coc){                
                if( coc.isDefault ){
                    $scope.model.defaultCategoryCombo = coc;
                }
                $scope.model.selectedCategoryCombos[cocs[0]] = coc;
                
                angular.forEach(coc.categoryOptionCombos, function(coco){
                    $scope.model.optionCombosById[coco.id] = coco;
                });
            });
        }
    };
    
    var resetParams = function(){
        $scope.model.dataValues = {};        
        $scope.model.valueExists = false;
        $scope.model.basicAuditInfo = {};
        $scope.model.basicAuditInfo.exists = false;
        $scope.saveStatus = {};
        $scope.model.agenciesWithValue = {};
        $scope.model.selectedAgency = null;
    };
    
    var processFundingAgency = function( deId, value ){
        var agency = $scope.model.optionCombosById[value.categoryOptionCombo];
        if ( agency && agency.displayName ){
            value.fundingAgency = agency.displayName;
        }
                            
        if(!$scope.model.agenciesWithValue[deId]){
            $scope.model.agenciesWithValue[deId] = [];
        }
        $scope.model.agenciesWithValue[deId].push( value );
    };
    
    var copyDataValues = function(){
        $scope.dataValuesCopy = angular.copy( $scope.model.dataValues );
    };
    
    $scope.loadDataEntryForm = function(){
        
        resetParams();
        if( angular.isObject( $scope.selectedOrgUnit ) && $scope.selectedOrgUnit.id &&
                angular.isObject( $scope.model.selectedDataSet ) && $scope.model.selectedDataSet.id &&
                angular.isObject( $scope.model.selectedPeriod) && $scope.model.selectedPeriod.id &&
                $scope.model.categoryOptionsReady ){
            
            var dataValueSetUrl = 'dataSet=' + $scope.model.selectedDataSet.id + '&period=' + $scope.model.selectedPeriod.id + '&orgUnit=' + $scope.selectedOrgUnit.id;
            
            $scope.model.selectedAttributeOptionCombo = CommonUtils.getOptionComboIdFromOptionNames($scope.model.selectedAttributeOptionCombos, $scope.model.selectedOptions);

            //fetch data values...
            DataValueService.getDataValueSet( dataValueSetUrl ).then(function(response){
                if( response && response.dataValues && response.dataValues.length > 0 ){                    
                    response.dataValues = $filter('filter')(response.dataValues, {attributeOptionCombo: $scope.model.selectedAttributeOptionCombo});                    
                    if( response.dataValues.length > 0 ){
                        $scope.model.valueExists = true;
                        angular.forEach(response.dataValues, function(dv){
                            dv.value = CommonUtils.formatDataValue( null, dv.value, $scope.model.dataElementsById[dv.dataElement], $scope.model.optionSets, 'USER' );
                            if(!$scope.model.dataValues[dv.dataElement]){
                                $scope.model.dataValues[dv.dataElement] = {};
                            }
                            $scope.model.dataValues[dv.dataElement][dv.categoryOptionCombo] = dv;
                            
                            processFundingAgency( dv.dataElement, dv );
                            
                        });

                        response.dataValues = orderByFilter(response.dataValues, '-created').reverse();                    
                        $scope.model.basicAuditInfo.created = $filter('date')(response.dataValues[0].created, 'dd MMM yyyy');
                        $scope.model.basicAuditInfo.storedBy = response.dataValues[0].storedBy;
                        $scope.model.basicAuditInfo.exists = true;
                    }
                }
                copyDataValues();
            });
            
            $scope.model.dataSetCompletness = {};
            CompletenessService.get( $scope.model.selectedDataSet.id, 
                                    $scope.selectedOrgUnit.id,
                                    $scope.model.selectedPeriod.id,
                                    $scope.model.allowMultiOrgUnitEntry).then(function(response){                
                if( response && 
                        response.completeDataSetRegistrations && 
                        response.completeDataSetRegistrations.length &&
                        response.completeDataSetRegistrations.length > 0){
                    
                    angular.forEach(response.completeDataSetRegistrations, function(cdr){
                        $scope.model.dataSetCompletness[cdr.attributeOptionCombo] = true;                        
                    });
                }
            });
        }
    };
    
    function checkOptions(){
        $scope.model.categoryOptionsReady = false;
        resetParams();
        for(var i=0; i<$scope.model.selectedAttributeCategoryCombo.categories.length; i++){
            if($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption && $scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption.id){
                $scope.model.categoryOptionsReady = true;
                $scope.model.selectedOptions.push($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption);
            }
            else{
                $scope.model.categoryOptionsReady = false;
                break;
            }
        }        
        if($scope.model.categoryOptionsReady){
            $scope.loadDataEntryForm();
        }
    };
    
    $scope.getCategoryOptions = function(category){
        $scope.model.categoryOptionsReady = false;
        $scope.model.selectedOptions = [];
        
        if( category && category.selectedOption && category.selectedOption.id === 'ADD_NEW_OPTION' ){
            category.selectedOption = null;
            showAddStakeholder( category );
        }        
        else{
            checkOptions();
        }        
    };
    
    $scope.getPeriods = function(mode){
        
        if( mode === 'NXT'){
            $scope.periodOffset = $scope.periodOffset + 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        }
        else{
            $scope.periodOffset = $scope.periodOffset - 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        }
    };
        
    $scope.saveDataValue = function( deId, ocId, isUpdate ){
        
        $scope.saveStatus[deId + '-' + ocId] = {};
        
        //check for form validity
        $scope.outerForm.submitted = true;
        var inputForm = $scope.outerForm;
        if( isUpdate ){
            inputForm = $scope.outerForm.innerUpdateForm ? $scope.outerForm.innerUpdateForm : inputForm;
        }
        else{
            inputForm = $scope.outerForm.innerAddForm ? $scope.outerForm.innerAddForm : inputForm;
        }
        
        if( inputForm.$invalid ){
            $scope.saveStatus[deId + '-' + ocId] = {saved: false, pending: false, error: true};
            if( $scope.model.dataValues[deId] ){
                $scope.model.dataValues[deId][ocId] = $scope.dataValuesCopy[deId] && $scope.dataValuesCopy[deId][ocId] ? $scope.dataValuesCopy[deId][ocId] : {value: null};
            }
            $scope.outerForm.$error = {};
            $scope.outerForm.$setPristine();
            $scope.outerForm.submitted = false;
            return ;
        }
        
        $scope.saveStatus[deId + '-' + ocId] = {saved: false, pending: true, error: false};
        
        var dataValue = {
            ou: $scope.selectedOrgUnit.id,
            pe: $scope.model.selectedPeriod.id,
            de: deId,
            co: ocId,
            cc: $scope.model.selectedAttributeCategoryCombo.id,
            cp: CommonUtils.getOptionIds($scope.model.selectedOptions),
            value: $scope.model.dataValues[deId][ocId].value
        };
                
        DataValueService.saveDataValue( dataValue ).then(function(response){
            $scope.saveStatus[deId + '-' + ocId].saved = true;
            $scope.saveStatus[deId + '-' + ocId].pending = false;
            $scope.saveStatus[deId + '-' + ocId].error = false;
            dataValue.categoryOptionCombo = ocId;
            
            $scope.outerForm.submitted = false;
            $scope.outerForm.$error = {};
            $scope.outerForm.$setPristine();
            copyDataValues();
            
            if( !isUpdate ){
                processFundingAgency( deId, dataValue );
                $scope.model.selectedAgency = null;
            }
            else{
                if( dataValue.value === "" ){
                    var index = -1;
                    for(var i=0; i< $scope.model.agenciesWithValue[deId].length; i++){
                        if($scope.model.agenciesWithValue[deId][i].categoryOptionCombo === ocId){
                            index = i;
                            break;
                        }
                    }
                    if( index !== -1){
                        $scope.model.agenciesWithValue[deId].splice(index,1);
                    }
                }
            }
           
        }, function(){
            $scope.saveStatus[deId + '-' + ocId].saved = false;
            $scope.saveStatus[deId + '-' + ocId].pending = false;
            $scope.saveStatus[deId + '-' + ocId].error = true;
        });
    };
    
    $scope.saveCompletness = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'mark_complete',
            bodyText: 'are_you_sure_to_save_completeness'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            var dsr = {completeDataSetRegistrations: []};
            if( $scope.model.allowMultiOrgUnitEntry ){
                angular.forEach($scope.selectedOrgUnit.c, function(ou){
                    dsr.completeDataSetRegistrations.push({
                        dataSet: $scope.model.selectedDataSet.id, 
                        organisationUnit: ou, 
                        period: $scope.model.selectedPeriod.id, 
                        attributeOptionCombo: $scope.model.selectedAttributeOptionCombo
                    });
                });
            }
            else{
            	dsr.completeDataSetRegistrations.push({
                    dataSet: $scope.model.selectedDataSet.id, 
                    organisationUnit: $scope.selectedOrgUnit.id, 
                    period: $scope.model.selectedPeriod.id, 
                    attributeOptionCombo: $scope.model.selectedAttributeOptionCombo
                });
            }
            
            CompletenessService.save(dsr).then(function(response){
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_complete'
                };
                DialogService.showDialog({}, dialogOptions);
                $scope.model.dataSetCompletness[$scope.model.selectedAttributeOptionCombo] = true;                
                
            }, function(response){
                CommonUtils.errorNotifier( response );
            });
        });        
    };
    
    $scope.deleteCompletness = function( orgUnit, multiOrgUnit){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'mark_incomplete',
            bodyText: 'are_you_sure_to_delete_completeness'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            
            CompletenessService.delete($scope.model.selectedDataSet.id, 
                $scope.model.selectedPeriod.id, 
                orgUnit,
                $scope.model.selectedAttributeCategoryCombo.id,
                CommonUtils.getOptionIds($scope.model.selectedOptions),
                multiOrgUnit).then(function(response){
                
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_incomplete'
                };
                DialogService.showDialog({}, dialogOptions);
                $scope.model.dataSetCompletness[$scope.model.selectedAttributeOptionCombo] = false;
                
            }, function(response){
                CommonUtils.errorNotifier( response );
            });
        });        
    };
    
    $scope.getInputNotifcationClass = function(deId, ocId){

        var currentElement = $scope.saveStatus[ deId + '-' + ocId];        
        
        if( currentElement ){
            if(currentElement.pending){
                return 'form-control input-pending';
            }

            if(currentElement.saved){
                return 'form-control input-success';
            }            
            else{
                return 'form-control input-error';
            }
        }    
        
        return 'form-control';
    };
    
    $scope.getAuditInfo = function(de, ouId, oco, value, comment){        
        var modalInstance = $modal.open({
            templateUrl: 'components/dataentry/history.html',
            controller: 'DataEntryHistoryController',
            windowClass: 'modal-window-history',
            resolve: {
                period: function(){
                    return $scope.model.selectedPeriod;
                },
                dataElement: function(){
                    return de;
                },
                value: function(){
                    return value;
                },
                comment: function(){
                    return comment;
                },
                orgUnitId: function(){
                    return  ouId;
                },
                attributeCategoryCombo: function(){
                    return $scope.model.selectedAttributeCategoryCombo;
                },
                attributeCategoryOptions: function(){
                    return CommonUtils.getOptionIds($scope.model.selectedOptions);
                },
                attributeOptionCombo: function(){
                    return $scope.model.selectedAttributeOptionCombo;
                },
                optionCombo: function(){
                    return oco;
                }
            }
        });
        
        modalInstance.result.then(function () {
        }); 
    };
    
    $scope.getIconClass = function(icon){
        return icon.cls;
    };
    
    $scope.entryModeGroup = function( dataSet ){
        return dataSet.entryMode.name;
    };
    
    $scope.getIndicatorValue = function( indicator, ouId ){        
        var res = CommonUtils.getIndicatorResult( indicator, $scope.model.dataValues[ouId] );
        return res;
    };
    
    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };
});
