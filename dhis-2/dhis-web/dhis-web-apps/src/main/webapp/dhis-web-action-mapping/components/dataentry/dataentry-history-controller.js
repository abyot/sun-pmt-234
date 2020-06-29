/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for settings page
sunPMT.controller('DataEntryHistoryController',
        function($scope,
                $modalInstance,
                $translate,
                $filter,
                value,
                comment,
                period,
                dataElement,
                orgUnitId,
                attributeCategoryCombo,
                attributeCategoryOptions,
                attributeOptionCombo,
                optionCombo,
                currentEvent,
                program,
                DataValueService,
                DataValueAuditService,
                EventValueAuditService) {    
    $scope.commentSaveStarted = false;
    $scope.dataElement = dataElement;
    $scope.program = program;
    $scope.historyUrl = "../api/charts/history/data.png?";
    $scope.historyUrl += 'de=' + dataElement.id;
    $scope.historyUrl += '&co=' + optionCombo.id;
    $scope.historyUrl += '&ou=' + orgUnitId;
    $scope.historyUrl += '&pe=' + period.id;
    $scope.historyUrl += '&cp=' + attributeOptionCombo;
    
    var dataValueAudit = {de: dataElement.id, pe: period.id, ou: orgUnitId, co: optionCombo.id, cc: attributeOptionCombo};
    $scope.dataValue = {de: dataElement.id, pe: period.id, ou: orgUnitId, co: optionCombo.id, cc: attributeCategoryCombo.id, cp: attributeCategoryOptions, value: value, comment: comment};
    
    $scope.auditColumns = [{id: 'created', name: $translate.instant('created')},
                           {id: 'modifiedBy', name: $translate.instant('modified_by')},
                           {id: 'value', name: $translate.instant('value')},
                           {id: 'auditType', name: $translate.instant('audit_type')}];
    
    $scope.dataValueAudits = [];        
    DataValueAuditService.getDataValueAudit( dataValueAudit ).then(function( response ){
        $scope.dataValueAudits = response && response.dataValueAudits ? response.dataValueAudits : [];
        $scope.dataValueAudits = $filter('filter')($scope.dataValueAudits, {period: {id: period.id}});
    });
    
    if( currentEvent && currentEvent[optionCombo.id] && currentEvent[[optionCombo.id]].event ){
        $scope.eventValueAudits = [];
        EventValueAuditService.getEventValueAudit( currentEvent[optionCombo.id].event ).then(function( response ){
            $scope.eventValueAudits = response && response.trackedEntityDataValueAudits ? response.trackedEntityDataValueAudits : [];
        });
    }    
    
    $scope.saveComment = function(){
        $scope.commentSaveStarted = true;
        $scope.commentSaved = false;
        DataValueService.saveDataValue( $scope.dataValue ).then(function(response){
           $scope.commentSaved = true;
        }, function(){
            $scope.commentSaved = false;
        });
    };
    
    $scope.getCommentNotifcationClass = function(){
        if( $scope.commentSaveStarted ){
            if($scope.commentSaved){
                return 'form-control input-success';
            }
            else{
                return 'form-control input-error';
            }
        }        
        return 'form-control';
    };
    
    $scope.close = function(status) {        
        $modalInstance.close( status );
    };
});