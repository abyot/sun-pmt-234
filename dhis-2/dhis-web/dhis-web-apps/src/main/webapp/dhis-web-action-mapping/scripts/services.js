/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var actionMappingServices = angular.module('actionMappingServices', ['ngResource'])

.factory('PMTStorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2sunpmt",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['dataSets', 'optionSets', 'categoryCombos', 'programs', 'ouLevels', 'indicatorGroups']
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
.factory('OptionSetService', function($q, $rootScope, PMTStorageService) { 
    return {
        getAll: function(){
            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });                    
                });
            });            
            
            return def.promise;            
        },
        get: function(uid){            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.get('optionSets', uid).done(function(optionSet){                    
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
.factory('OptionComboService', function($q, $rootScope, PMTStorageService) { 
    return {
        getAll: function(){            
            var def = $q.defer();            
            var optionCombos = [];
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
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
        getMappedOptionCombos: function(){
            var def = $q.defer();            
            var optionCombos = [];
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
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
.factory('DataSetFactory', function($q, $rootScope, storage, PMTStorageService, orderByFilter, CommonUtils) { 
  
    return {        
        getActionDataSets: function( ou ){            
            var systemSetting = storage.get('SYSTEM_SETTING');
            var allowMultiOrgUnitEntry = systemSetting && systemSetting.multiOrganisationUnitForms ? systemSetting.multiOrganisationUnitForms : false;
            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var multiDs = angular.copy(dss);
                    var dataSets = [];
                    var pushedDss = [];
                    var key = 'dataSetType';
                    angular.forEach(dss, function(ds){                        
                        ds[key] = ds[key] ? ds[key] : key;
                        ds[key] = ds[key].toLocaleLowerCase();
                        if( ds.id && CommonUtils.userHasWriteAccess(ds.id) && ds.organisationUnits.hasOwnProperty( ou.id ) && ds[key] === "action" ){
                            ds.entryMode = 'single';
                            dataSets.push(ds);
                        }
                    });
                    
                    if( allowMultiOrgUnitEntry && ou.c && ou.c.length > 0 ){
                        
                        angular.forEach(multiDs, function(ds){  
                            ds[key] = ds[key] ? ds[key] : key;
                            ds[key] = ds[key].toLocaleLowerCase();
                            if( ds.id && CommonUtils.userHasWriteAccess(ds.id) ){
                                angular.forEach(ou.c, function(c){                                    
                                    if( ds.organisationUnits.hasOwnProperty( c ) && pushedDss.indexOf( ds.id ) === -1 && ds[key] === "action" ){
                                        ds.entryMode = 'multiple';
                                        dataSets.push(ds);
                                        pushedDss.push( ds.id );                                            
                                    }
                                });                               
                            }
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
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
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
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
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
        get: function(uid){
            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.get('dataSets', uid).done(function(ds){
                    $rootScope.$apply(function(){
                        def.resolve(ds);
                    });
                });
            });                        
            return def.promise;            
        },
        getByOu: function(ou, selectedDataSet){
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
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
.factory('MetaDataFactory', function($q, $rootScope, PMTStorageService, orderByFilter) {  
    
    return {        
        get: function(store, uid){            
            var def = $q.defer();            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.get(store, uid).done(function(obj){                    
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });                        
            return def.promise;
        },
        set: function(store, obj){            
            var def = $q.defer();            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.set(store, obj).done(function(obj){                    
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });                        
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll(store).done(function(objs){                    
                    objs = orderByFilter(objs, '-displayName').reverse();                    
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });                
            });            
            return def.promise;
        },
        getByProperty: function(store, prop, val){
            var def = $q.defer();
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll(store).done(function(objs){
                    var selectedObject = null; 
                    for(var i=0; i<objs.length; i++){
                        if(objs[i][prop] ){
                            objs[i][prop] = objs[i][prop].toLocaleLowerCase();
                            if( objs[i][prop] === val )
                            {
                                selectedObject = objs[i];
                                break;
                            }                           
                        }
                    }
                    
                    $rootScope.$apply(function(){
                        def.resolve(selectedObject);
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
        },
        saveComment: function( dv ){
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&cc='+dv.cc + '&cp='+dv.cp + '&comment=' + dv.comment;          
            var promise = $http.post('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        }
    };    
})

.service('CompletenessService', function($http, CommonUtils) {   
    
    return {        
        get: function( ds, ou, startDate, endDate, children ){
            var promise = $http.get('../api/completeDataSetRegistrations?dataSet='+ds+'&orgUnit='+ou+'&startDate='+startDate+'&endDate='+endDate+'&children='+children).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        saveDsr: function( dsr ){
            var promise = $http.post('../api/completeDataSetRegistrations.json', dsr ).then(function(response){
                return response.data;
            }, function(response){                
                DataEntryUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        save: function( ds, pe, ou, cc, cp, multiOu){
            var promise = $http.post('../api/completeDataSetRegistrations?ds='+ ds + '&pe=' + pe + '&ou=' + ou + '&cc=' + cc + '&cp=' + cp + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        delete: function( ds, pe, ou, cc, cp, multiOu){
            var promise = $http.delete('../api/completeDataSetRegistrations?ds='+ ds + '&pe=' + pe + '&ou=' + ou + '&cc=' + cc + '&cp=' + cp + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
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

.service('EventValueAuditService', function($http, CommonUtils) {   
    
    return {        
        getEventValueAudit: function( event ){
            var promise = $http.get('../api/audits/trackedEntityDataValue.json?paging=false&psi='+event).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('StakeholderService', function($http, CommonUtils) {   
    
    return {        
        addCategoryOption: function( categoryOption ){
            var promise = $http.post('../api/categoryOptions.json' , categoryOption ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        updateCategory: function( category ){
            var promise = $http.put('../api/categories/' + category.id + '.json&mergeMode=MERGE', category ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        getCategoryCombo: function(uid){            
            var promise = $http.get('../api/categoryCombos/' + uid + '.json?fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName,categoryOptions[displayName]],categories[id,displayName,code,dimension,dataDimensionType,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code]]').then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        addOption: function( opt ){
            var promise = $http.post('../api/options.json' , opt ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        updateOptionSet: function( optionSet ){
            var promise = $http.put('../api/optionSets/' + optionSet.id + '.json&mergeMode=MERGE', optionSet ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        getOptionSet: function( uid ){
            var promise = $http.get('../api/optionSets/' + uid + '.json?paging=false&fields=id,name,displayName,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,name,displayName,code]').then(function(response){
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
        get: function( uid, level ){
            if( orgUnit !== uid ){
                orgUnitPromise = $http.get( '../api/organisationUnits.json?filter=path:like:/' + uid + '&filter=level:le:' + level + '&fields=id,displayName,path,level,parent[id]&paging=false' ).then(function(response){
                    orgUnit = response.data.id;
                    return response.data;
                });
            }
            return orgUnitPromise;
        }
    };
})

.service('MaintenanceService', function($http, CommonUtils){
    return {
        updateOptionCombo: function(){
            var promise = $http.post('../api/maintenance/categoryOptionComboUpdate' , true ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('ReportService', function($q, $filter, orderByFilter, DataValueService, CommonUtils){
    return {        
        getReportData: function(reportParams, reportData){            
            var def = $q.defer();
            reportData.mappedValues = [];
            reportData.mappedTargetValues = {};
            DataValueService.getDataValueSet( reportParams.dataValueSetUrl ).then(function( response ){
                if( response && response.dataValues ){
                    
                    angular.forEach(response.dataValues, function(dv){
                        
                        if( dv.value ){
                            
                            //Process second grean area
                            if( dv.comment ){
                                var comment = JSON.parse( dv.comment );
                                if( comment && angular.isObject( comment ) ){
                                    angular.extend(dv, comment);
                                    for(var key in comment ){
                                        if(!reportData.availableRoles[key]){
                                            reportData.availableRoles[key] = {};
                                        }
                                        if(!reportData.availableRoles[key][dv.categoryOptionCombo]){
                                            reportData.availableRoles[key][dv.categoryOptionCombo] = [];
                                        }
                                        for(var i=0; i<comment[key].length; i++){
                                            if(reportData.availableRoles[key][dv.categoryOptionCombo].indexOf(comment[key][i]) === -1){
                                                reportData.availableRoles[key][dv.categoryOptionCombo].push(comment[key][i]);
                                            }
                                        }
                                    }
                                }
                            }

                            //process first green area
                            var oco = reportData.mappedOptionCombos[dv.attributeOptionCombo];                        
                            if( oco && oco.displayName ){
                                var optionNames = oco.displayName.split(",");                            
                                for(var j=0; j<optionNames.length; j++){
                                    var ca = reportData.mappedCategoryOptions[optionNames[j]];
                                    if( ca ){
                                        dv[ca] = [optionNames[j]];

                                        if( !reportData.availableRoles[ca] ){
                                            reportData.availableRoles[ca] = {};
                                        }
                                        if( !reportData.availableRoles[ca][dv.categoryOptionCombo] ){
                                            reportData.availableRoles[ca][dv.categoryOptionCombo] = [];
                                        }
                                        
                                        reportData.availableRoles[ca][dv.categoryOptionCombo] = CommonUtils.pushRoles( reportData.availableRoles[ca][dv.categoryOptionCombo], [optionNames[j]]);
                                        
                                        if( reportData.mappedRoles[ca] &&
                                            reportData.mappedRoles[reportData.dataElementCodesById[dv.dataElement]][dv.orgUnit] &&
                                            reportData.mappedRoles[reportData.dataElementCodesById[dv.dataElement]][dv.orgUnit][dv.categoryOptionCombo]){                            
                                            var r = reportData.mappedRoles[reportData.dataElementCodesById[dv.dataElement]][dv.orgUnit][dv.categoryOptionCombo][dv.attributeOptionCombo];
                                            if( r && angular.isObject( r ) ){
                                                angular.extend(dv, r);
                                            }
                                        }
                                    }                                    
                                }
                            }                            
                        }
                        
                    });                    
                    reportData.mappedValues = response;
                    reportData.noDataExists = false;
                }
                else{                    
                    reportData.showReportFilters = false;
                    reportData.noDataExists = true;
                }  

                var cols = orderByFilter($filter('filter')(reportData.whoDoesWhatCols, {domain: 'CA'}), '-sortOrder').reverse();                
                cols = cols.concat(orderByFilter($filter('filter')(reportData.whoDoesWhatCols, {domain: 'DE'}), '-sortOrder').reverse());
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
})

/* service for handling events */
.service('EventService', function($http, $q, DHIS2URL, CommonUtils) {   
    
    var skipPaging = "&skipPaging=true";
    
    var getByOrgUnitAndProgram = function(orgUnit, ouMode, program, attributeCategoryUrl, categoryOptionCombo, startDate, endDate){
        var url = DHIS2URL + '/events.json?' + 'orgUnit=' + orgUnit + '&ouMode='+ ouMode + '&program=' + program + skipPaging;

        if( startDate && endDate ){
            url += '&startDate=' + startDate + '&endDate=' + endDate;
        }

        if( attributeCategoryUrl && !attributeCategoryUrl.default ){
            url += '&attributeCc=' + attributeCategoryUrl.cc + '&attributeCos=' + attributeCategoryUrl.cp;
        }
        
        if( categoryOptionCombo ){
            url += '&coc=' + categoryOptionCombo;
        }

        var promise = $http.get( url ).then(function(response){
            return response.data.events;
        }, function(response){
            CommonUtils.errorNotifier(response);
        });            
        return promise;
    };
    
    var get = function(eventUid){            
        var promise = $http.get(DHIS2URL + '/events/' + eventUid + '.json').then(function(response){               
            return response.data;
        });            
        return promise;
    };
    
    var create = function(dhis2Event){    
        var promise = $http.post(DHIS2URL + '/events.json', dhis2Event).then(function(response){
            return response.data;           
        });
        return promise;            
    };
    
    var deleteEvent = function(dhis2Event){
        var promise = $http.delete(DHIS2URL + '/events/' + dhis2Event.event).then(function(response){
            return response.data;               
        });
        return promise;           
    };
    
    var update = function(dhis2Event){   
        var promise = $http.put(DHIS2URL + '/events/' + dhis2Event.event, dhis2Event).then(function(response){
            return response.data;         
        });
        return promise;
    };
    return {        
        get: get,        
        create: create,
        deleteEvent: deleteEvent,
        update: update,
        getByOrgUnitAndProgram: getByOrgUnitAndProgram,
        getForMultipleOptionCombos: function( orgUnit, mode, pr, attributeCategoryUrl, optionCombos, startDate, endDate ){
            var def = $q.defer();            
            var promises = [], events = [];            
            angular.forEach(optionCombos, function(oco){
                promises.push( getByOrgUnitAndProgram( orgUnit, mode, pr, attributeCategoryUrl, oco.id, startDate, endDate) );
            });
            
            $q.all(promises).then(function( _events ){
                angular.forEach(_events, function(evs){
                    events = events.concat( evs );
                });
                
                def.resolve(events);
            });
            return def.promise;
        },
        getForMultiplePrograms: function( orgUnit, mode, programs, attributeCategoryUrl, startDate, endDate ){
            var def = $q.defer();            
            var promises = [], events = [];            
            angular.forEach(programs, function(pr){
                promises.push( getByOrgUnitAndProgram( orgUnit, mode, pr.id, attributeCategoryUrl, null, startDate, endDate) );                
            });
            
            $q.all(promises).then(function( _events ){
                angular.forEach(_events, function(evs){
                    events = events.concat( evs );
                });
                
                def.resolve(events);
            });
            return def.promise;
        }
    };    
});