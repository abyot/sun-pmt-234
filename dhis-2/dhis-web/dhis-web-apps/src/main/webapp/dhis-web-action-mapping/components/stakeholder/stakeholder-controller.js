/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for settings page
sunPMT.controller('StakeholderController',
        function($scope,
                $modalInstance,
                categoryCombo,
                category,
                optionSet,
                MetaDataFactory,
                StakeholderService,
                MaintenanceService) {            
    
    $scope.stakeholderAdded = false;
    $scope.stakeholderAddStarted = false;
    $scope.model = {newStakeholder:{}};
    $scope.categoryCombo = categoryCombo;
    $scope.category = category;
    $scope.optionSet = optionSet;
    
    $scope.interacted = function(field) {        
        var status = false;
        if(field){            
            status = $scope.stakeholderForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.addStakeholder = function(){
        
        //check for form validity
        $scope.stakeholderForm.submitted = true;        
        if( $scope.stakeholderForm.$invalid ){
            return false;
        }       
       
        $scope.stakeholderAddStarted = true;
        
        //form is valid
        //add category option
        $scope.model.newStakeholder.code = $scope.model.newStakeholder.shortName;        
        StakeholderService.addCategoryOption( $scope.model.newStakeholder ).then(function( jsonCo ){
            if( jsonCo && jsonCo.response && jsonCo.response.uid ){
                var cat = angular.copy($scope.category);
                cat.name = cat.displayName;
                cat.categoryOptions = [];
                delete cat.selectedOption;
                delete cat.placeHolder;
                
                angular.forEach($scope.category.categoryOptions, function(o){
                    if( o.id !== 'ADD_NEW_OPTION' ){
                        cat.categoryOptions.push( o );
                    }
                });
                cat.categoryOptions.push( {id: jsonCo.response.uid, name: $scope.model.newStakeholder.name, code: $scope.model.newStakeholder.code} );
                
                //update category
                StakeholderService.updateCategory( cat ).then(function(jsonCa){
                    angular.forEach($scope.categoryCombo.categories, function(c){
                        if( c.id === cat.id ){
                            c = cat;
                        }
                    });
                    
                    //add option
                    var opt = {name: $scope.model.newStakeholder.name, code: $scope.model.newStakeholder.code};
                    StakeholderService.addOption( opt ).then(function( jsonOp ){            
                        if( jsonOp && jsonOp.response && jsonOp.response.uid ){
                            //update option set
                            var os = angular.copy($scope.optionSet);

                            if( os && os.organisationUnits ){
                                delete os.organisationUnits;
                            }                                        
                            os.options.push( {id: jsonOp.response.uid, name: $scope.model.newStakeholder.name} );
                            StakeholderService.updateOptionSet( os ).then(function(jsonOs){
                                
                                StakeholderService.getOptionSet( os.id ).then(function( response ){

                                    if( response && response.id ){
                                        
                                        var oss = dhis2.metadata.processMetaDataAttribute( response );
                                        
                                        MetaDataFactory.set('optionSets', oss).then(function(){
                                        
                                            $scope.stakeholderAdded = true;
                                            
                                            MaintenanceService.updateOptionCombo().then(function(updateResponse){

                                                StakeholderService.getCategoryCombo( $scope.categoryCombo.id ).then(function( response ){

                                                    if( response && response.id ){
                                                        MetaDataFactory.set('categoryCombos', response).then(function(){
                                            
                                                            $scope.close(true);
                                                            
                                                        });
                                                    }
                                                });
                                            });
                                        });
                                    }
                                });                            
                            });
                        }
                    });
                });
            }            
        });
    };
    
    $scope.close = function(status) {        
        $modalInstance.close( status );
    };
});