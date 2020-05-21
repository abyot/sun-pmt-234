/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for settings page
sunPMT.controller('StakeholderRoleController',
        function($scope,
                $modalInstance,
                $translate,
                period,
                program,
                currentEvent,
                currentOrgUnitId,
                currentOrgUnitName,
                attributeCategoryOptions,
                optionCombos,
                commonOptionCombo,
                allStakeholderRoles,
                optionSets,
                stakeholderCategory,
                rolesAreDifferent,
                selectedOrgUnit,
                EventService,
                DialogService) {            
    
    $scope.period = period;
    $scope.program = program;
    $scope.currentEvent = currentEvent;
    $scope.attributeCategoryOptions = attributeCategoryOptions;
    $scope.optionCombos = optionCombos;
    $scope.currentOrgunitId = currentOrgUnitId;
    $scope.currentOrgUnitName = currentOrgUnitName;
    $scope.stakeholderRoles = allStakeholderRoles[currentOrgUnitId];
    $scope.optionSets = optionSets;
    $scope.stakeholderCategory = stakeholderCategory;
    $scope.rolesAreDifferent = rolesAreDifferent;
    
    if( !rolesAreDifferent ){
        for( var i=0; i<optionCombos.length; i++){
            if(optionCombos[i].id !== commonOptionCombo){
                $scope.stakeholderRoles[optionCombos[i].id] = angular.copy( $scope.stakeholderRoles[commonOptionCombo] );
            }
        }
    }
    
    $scope.saveRole = function( ocoId, dataElementId ){
        
        var events = {events: []};
        
        if( $scope.stakeholderRoles[ocoId][dataElementId].indexOf( "[Add New Stakeholder]") !== -1 ){
            $scope.stakeholderRoles[ocoId][dataElementId] = $scope.stakeholderRoles[ocoId][dataElementId].slice(0,-1);
            var dialogOptions = {
                headerText: $translate.instant('info'),
                bodyText: $translate.instant('please_do_this_from_main_screen')
            };		
            DialogService.showDialog({}, dialogOptions);
            return;
        }
        
        var dataValue = {dataElement: dataElementId, value: $scope.stakeholderRoles[ocoId][dataElementId].join()};
        if( $scope.currentEvent && $scope.currentEvent[ocoId] && $scope.currentEvent[ocoId].event ){                
            var updated = false;
            for( var i=0; i<$scope.currentEvent[ocoId].dataValues.length; i++ ){
                if( $scope.currentEvent[ocoId].dataValues[i].dataElement === dataElementId ){
                    $scope.currentEvent[ocoId].dataValues[i] = dataValue;
                    updated = true;
                    break;
                }
            }
            if( !updated ){
                $scope.currentEvent[ocoId].dataValues.push( dataValue );
            }

            //update event
            EventService.update( $scope.currentEvent[ocoId] ).then(function(response){
            });
        }
        else{
            if( !$scope.currentEvent[ocoId] ){
                $scope.currentEvent[ocoId]  = {}; 
            }
            var event = {
                program: $scope.program.id,
                programStage: $scope.program.programStages[0].id,
                status: 'ACTIVE',
                orgUnit: $scope.currentOrgunitId,
                eventDate: period.endDate,
                dataValues: [dataValue],
                attributeCategoryOptions: $scope.attributeCategoryOptions,
                categoryOptionCombo: ocoId
            };

            events.events.push( event );
        }
        
        if( events.events.length > 0 ){
            //add event
            EventService.create(events).then(function (json) {
                if( json && json.response && json.response.importSummaries && json.response.importSummaries.length ){                            
                    for( var i=0; i<json.response.importSummaries.length; i++){
                        if( json.response.importSummaries[i] && 
                                json.response.importSummaries[i].status === 'SUCCESS' && 
                                json.response.importSummaries[i].reference ){                            
                            var ev = events.events[i];
                            $scope.currentEvent[ev.categoryOptionCombo] = {event: json.response.importSummaries[i].reference, dataValues: ev.dataValues};
                        }
                    }
                }
            });
        }
    };
    
    $scope.close = function() {        
        var sampleRole = null;
        var rolesAreDifferent = false;
        for(var i=0; i<selectedOrgUnit.c.length; i++){
            if( !sampleRole ){
                sampleRole = allStakeholderRoles[selectedOrgUnit.c[i]];
            }

            if( !angular.equals(allStakeholderRoles[selectedOrgUnit.c[i]], sampleRole) ){
                rolesAreDifferent = true;
                break;
            }
        }        
        $modalInstance.close( {currentEvent: $scope.currentEvent, stakeholderRoles: $scope.stakeholderRoles, rolesAreDifferent: rolesAreDifferent} );
    };
});