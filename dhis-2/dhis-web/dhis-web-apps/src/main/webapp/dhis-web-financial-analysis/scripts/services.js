/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var financialAnalysisServices = angular.module('financialAnalysisServices', ['ngResource'])

.factory('FINStorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2sunFinance",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['dataSets', 'optionSets', 'categoryCombos', 'ouLevels', 'indicatorGroups']
    });
    return{
        currentStore: store
    };
})

/* current selections */
.service('PeriodService', function(DateUtils){
    
    this.getPeriods = function(periodType, periodOffset, futurePeriods){
        periodOffset = angular.isUndefined(periodOffset) ? 0 : periodOffset;
        futurePeriods = angular.isUndefined(futurePeriods) ? 1 : futurePeriods;
        var availablePeriods = [];
        if(!periodType){
            return availablePeriods;
        }
        
        var pt = new PeriodType();
        var d2Periods = pt.get(periodType).generatePeriods({offset: periodOffset, filterFuturePeriods: false, reversePeriods: false});
        
        d2Periods = d2Periods.slice( 0, d2Periods.length - 1 + futurePeriods );
                
        d2Periods = d2Periods.slice( d2Periods.length - 2, d2Periods.length );
        d2Periods.reverse();
        
        angular.forEach(d2Periods, function(p){
            p.endDate = DateUtils.formatFromApiToUser(p.endDate);
            p.startDate = DateUtils.formatFromApiToUser(p.startDate);
            availablePeriods.push( p );
            /*if(moment(DateUtils.getToday()).isAfter(p.endDate)){                    
                availablePeriods.push( p );
            }*/
        });
        return availablePeriods;
    };
})

/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, FINStorageService) { 
    return {
        getAll: function(){
            
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });                    
                });
            });            
            
            return def.promise;            
        },
        get: function(uid){            
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.get('optionSets', uid).done(function(optionSet){                    
                    $rootScope.$apply(function(){
                        def.resolve(optionSet);
                    });
                });
            });                        
            return def.promise;
        },
        getCode: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].displayName){
                        return options[i].code;
                    }
                }
            }            
            return key;
        },        
        getName: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){                    
                    if( key === options[i].code){
                        return options[i].displayName;
                    }
                }
            }            
            return key;
        }
    };
})

/* Service to fetch option combos */
.factory('OptionComboService', function($q, $rootScope, FINStorageService) { 
    return {
        getAll: function(){            
            var def = $q.defer();            
            var optionCombos = [];
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        optionCombos = optionCombos.concat( cc.categoryOptionCombos );
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });                    
                });
            });            
            
            return def.promise;            
        },
        getMappedOptionCombos: function(uid){            
            var def = $q.defer();            
            var optionCombos = [];
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        angular.forEach(cc.categoryOptionCombos, function(oco){
                            oco.categories = [];
                            angular.forEach(cc.categories, function(c){
                                oco.categories.push({id: c.id, displayName: c.displayName});
                            });
                            optionCombos[oco.id] = oco;
                        });
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });                    
                });
            });            
            
            return def.promise;            
        }
    };
})

/* Factory to fetch programs */
.factory('DataSetFactory', function($q, $rootScope, $translate, storage, FINStorageService, orderByFilter, CommonUtils) { 
  
    return {        
        getByOuAndProperty: function( ou, propertyName, propertyValue ){            
            var systemSetting = storage.get('SYSTEM_SETTING');
            var allowMultiOrgUnitEntry = systemSetting && systemSetting.multiOrganisationUnitForms ? systemSetting.multiOrganisationUnitForms : false;
            
            var def = $q.defer();
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var accessibleDataSets = [];
                    angular.forEach(dss, function(ds){
                        if( ds.id && CommonUtils.userHasWriteAccess(ds.id) && ds[propertyName] && ds[propertyName] === propertyValue ){
                            accessibleDataSets.push(ds);
                        }
                    });
                    dss = angular.copy(accessibleDataSets);
                    var dataSets = [];
                    var pushedDss = [];
                    
                    angular.forEach(dss, function(ds){
                        if( ds.organisationUnits.hasOwnProperty( ou.id ) ){
                            ds.entryMode = {id: 'selected', name: $translate.instant('budget_for_selected')};
                            dataSets.push(ds);
                        }
                    });
                    
                    if( allowMultiOrgUnitEntry && ou.c && ou.c.length > 0 ){
                        dss = angular.copy(accessibleDataSets);
                        angular.forEach(dss, function(ds){
                            angular.forEach(ou.c, function(c){                                    
                                if( ds.organisationUnits.hasOwnProperty( c ) && pushedDss.indexOf( ds.id ) === -1 ){
                                    ds.entryMode = {id: 'children', name: $translate.instant('budget_for_children')};
                                    dataSets.push(ds);
                                    pushedDss.push( ds.id );                                            
                                }
                            });
                        });
                    }
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });            
            return def.promise;            
        },
        getTargetDataSets: function(){
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( ds.id && CommonUtils.userHasWriteAccess(ds.id) && ds.dataSetType && ds.dataSetType === 'targetGroup'){
                            dataSets.push(ds);
                        }
                    });
                    
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });
            return def.promise;
        },
        getActionAndTargetDataSets: function(){
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( ds.id && CommonUtils.userHasWriteAccess(ds.id) && ds.dataSetType && ( ds.dataSetType === 'targetGroup' || ds.dataSetType === 'action') ){
                            dataSets.push(ds);
                        }
                    });
                    
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });
            return def.promise;
        },
        
        getActionAndBudgetDataSets: function(){
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( ds.id && CommonUtils.userHasWriteAccess(ds.id) && 
                            (ds.dataSetType && ds.dataSetType === 'budget' && ds.reportCategory === 'districtLevel' ) ||
                            ds.dataSetType === 'action' ){
                            dataSets.push(ds);
                        }
                    });
                    
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });
            return def.promise;
        },
        getSectorBudgetDataSets: function(){
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( ds.id && CommonUtils.userHasWriteAccess(ds.id) && 
                            (ds.dataSetType && ds.dataSetType === 'budget' && ds.reportCategory === 'sectorLevel' )){
                            dataSets.push(ds);
                        }
                    });
                    
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });
            return def.promise;
        },         
        get: function(uid){
            
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.get('dataSets', uid).done(function(ds){
                    $rootScope.$apply(function(){
                        def.resolve(ds);
                    });
                });
            });                        
            return def.promise;            
        },
        getByOu: function(ou, selectedDataSet){
            var def = $q.defer();
            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];
                    angular.forEach(dss, function(ds){                            
                        if(ds.organisationUnits.hasOwnProperty( ou.id ) && ds.id && CommonUtils.userHasWriteAccess(ds.id)){
                            dataSets.push(ds);
                        }
                    });
                    
                    dataSets = orderByFilter(dataSets, '-displayName').reverse();
                    
                    if(dataSets.length === 0){
                        selectedDataSet = null;
                    }
                    else if(dataSets.length === 1){
                        selectedDataSet = dataSets[0];
                    } 
                    else{
                        if(selectedDataSet){
                            var continueLoop = true;
                            for(var i=0; i<dataSets.length && continueLoop; i++){
                                if(dataSets[i].id === selectedDataSet.id){                                
                                    selectedDataSet = dataSets[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedDataSet = null;
                            }
                        }
                    }
                                        
                    if(!selectedDataSet || angular.isUndefined(selectedDataSet) && dataSets.legth > 0){
                        selectedDataSet = dataSets[0];
                    }
                    
                    $rootScope.$apply(function(){
                        def.resolve({dataSets: dataSets, selectedDataSet: selectedDataSet});
                    });                      
                });
            });            
            return def.promise;
        }
    };
})

/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, FINStorageService, orderByFilter) {  
    
    return {        
        get: function(store, uid){            
            var def = $q.defer();            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.get(store, uid).done(function(obj){                    
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });                        
            return def.promise;
        },
        set: function(store, obj){            
            var def = $q.defer();            
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.set(store, obj).done(function(obj){                    
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });                        
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            FINStorageService.currentStore.open().done(function(){
                FINStorageService.currentStore.getAll(store).done(function(objs){                    
                    objs = orderByFilter(objs, '-displayName').reverse();                    
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });                
            });            
            return def.promise;
        }
    };        
})

.service('DataValueService', function($http, CommonUtils) {   
    
    return {        
        saveDataValue: function( dv ){
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&cc='+dv.cc + '&cp='+dv.cp + '&value='+dv.value;            
            if( dv.comment ){
                url += '&comment=' + dv.comment; 
            }            
            var promise = $http.post('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        },
        getDataValue: function( dv ){
            var promise = $http.get('../api/dataValues.json?de='+dv.de+'&ou='+dv.ou+'&pe='+dv.pe).then(function(response){
                return response.data;
            });
            return promise;
        },
        saveDataValueSet: function(dvs){
            var promise = $http.post('../api/dataValueSets.json', dvs).then(function(response){
                return response.data;
            });
            return promise;
        },
        getDataValueSet: function( params ){            
            var promise = $http.get('../api/dataValueSets.json?' + params ).then(function(response){               
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });            
            return promise;
        }
    };    
})

.service('CompletenessService', function($http, CommonUtils) {   
    
    return {        
        get: function( ds, ou, period, children ){
            var promise = $http.get('../api/completeDataSetRegistrations.json?dataSet='+ds+'&orgUnit='+ou+'&period='+period+'&children='+children).then(function(response){
                return response.data;
            }, function(response){                
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        save: function( dsr ){
            var promise = $http.post('../api/completeDataSetRegistrations.json', dsr ).then(function(response){
                return response.data;
            }, function(response){                
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        delete: function( ds, pe, ou, cc, cp, multiOu){
            var promise = $http.delete('../api/completeDataSetRegistrations?ds='+ ds + '&pe=' + pe + '&ou=' + ou + '&cc=' + cc + '&cp=' + cp + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){                
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        }
    };
})

.service('DataValueAuditService', function($http, CommonUtils) {   
    
    return {        
        getDataValueAudit: function( dv ){
            var promise = $http.get('../api/audits/dataValue.json?paging=false&de='+dv.de+'&ou='+dv.ou+'&pe='+dv.pe+'&co='+dv.co+'&cc='+dv.cc).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('OrgUnitService', function($http){
    var orgUnit, orgUnitPromise;
    return {
        get: function( uid ){
            if( orgUnit !== uid ){
                var url = '../api/organisationUnits.json?filter=path:like:/' + uid + '&fields=id,displayName,path,level,parent[id,displayName]&paging=false';
                url = encodeURI( url );
                orgUnitPromise = $http.get( url ).then(function(response){
                    orgUnit = response.data.id;
                    return response.data;
                });
            }
            return orgUnitPromise;
        }
    };
})

.service('ReportService', function($q, DataValueService, IndexDBService){
    
    var idMapper = function( dataSets ){
        
        var mappedObject = {};        
        if( dataSets ){
            angular.forEach( dataSets, function(ds){
                if( ds.dataElements && ds.dataElements.length > 0){
                    angular.forEach(ds.dataElements, function(de){
                        mappedObject[de.id] = de.displayFormName;
                    });
                }
            });
        }
        return mappedObject;
    };
    
    return {
        getBudgetReport: function( reportParams, reportData){
            var orgUnits = {}, 
                def = $q.defer(),
                budgetDataElements = idMapper( reportData.budgetDataSets), 
                actionDataElements = idMapper( reportData.actionDataSets);

            DataValueService.getDataValueSet( reportParams.dataValueSetUrl ).then(function( response ){                
                if( response && response.dataValues ){
                    angular.forEach(response.dataValues, function(dv){
                        var oco = reportData.mappedOptionCombos[dv.categoryOptionCombo];
                        if( oco && oco.displayName ){
                            dv.agencyName = oco.displayName;
                            if( dv.value ){
                                dv.value = parseInt( dv.value );
                            }
                            else{
                                dv.value = parseInt( 0 );
                            }
                            
                            if( !orgUnits[dv.orgUnit] ){
                                IndexDBService.open('dhis2ou').then(function(){
                                    IndexDBService.get('ou', dv.orgUnit).then(function(ou){
                                        if( ou ){
                                            dv.orgUnitName = ou.n;
                                            orgUnits[dv.orgUnit] = ou.n;
                                        }                            
                                    });
                                });
                            }
                            else{
                                dv.orgUnitName = orgUnits[dv.orgUnit];
                            }
                            if( actionDataElements[dv.dataElement] && reportData.actionDataValues){                                
                                reportData.actionDataValues.push( dv );
                            }
                            else if( budgetDataElements[dv.dataElement] && reportData.budgetDataValues){
                                reportData.budgetDataValues.push( dv );
                            }
                        }
                    });
                    reportData.mappedValues = response.dataValues;
                    reportData.orgUnits = orgUnits;
                    reportData.noDataExists = false;
                    reportData.actionDataElements = actionDataElements;
                    reportData.budgetDataElements = budgetDataElements;
                }
                else{                    
                    reportData.showReportFilters = false;
                    reportData.noDataExists = true;
                }
                
                reportData.reportReady = true;
                reportData.reportStarted = false;

                def.resolve(reportData);
            });
            return def.promise;
        }
    };
})

/*Orgunit service for local db */
.service('IndexDBService', function($window, $q){
    
    var indexedDB = $window.indexedDB;
    var db = null;
    
    var open = function( dbName ){
        var deferred = $q.defer();
        
        var request = indexedDB.open( dbName );
        
        request.onsuccess = function(e) {
          db = e.target.result;
          deferred.resolve();
        };

        request.onerror = function(){
          deferred.reject();
        };

        return deferred.promise;
    };
    
    var get = function(storeName, uid){
        
        var deferred = $q.defer();
        
        if( db === null){
            deferred.reject("DB not opened");
        }
        else{
            var tx = db.transaction([storeName]);
            var store = tx.objectStore(storeName);
            var query = store.get(uid);
                
            query.onsuccess = function(e){
                deferred.resolve(e.target.result);           
            };
        }
        return deferred.promise;
    };
    
    return {
        open: open,
        get: get
    };
});