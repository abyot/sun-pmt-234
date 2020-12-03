"use strict";

/*
 * Copyright (c) 2004-2014, University of Oslo
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 * * Neither the name of the HISP project nor the names of its contributors may
 *   be used to endorse or promote products derived from this software without
 *   specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

dhis2.util.namespace('dhis2.metadata');

dhis2.metadata.custSeparator   = '.';
dhis2.metadata.formulaRegex    = /#\{.+?\}/g;
dhis2.metadata.expressionRegex = /#{.*?\}/g;
dhis2.metadata.operatorRegex   = /[#\{\}]/g;

dhis2.metadata.expressionMatcher = function( obj, src, des, expressionPattern, operandPattern, src2){
    var match;
    if( src2 ){
        if( obj[src] && obj[src][src2] && expressionPattern && operandPattern && obj[des]){
            while (match = expressionPattern.exec( obj[src][src2] ) ) {
                match[0] = match[0].replace( operandPattern, '' );
                obj[des].push(match[0].split('.')[0]);
            }
        }
    }
    else{
        if( obj[src] && expressionPattern && operandPattern && obj[des]){
            while (match = expressionPattern.exec( obj[src] ) ) {
                match[0] = match[0].replace( operandPattern, '' );
                obj[des].push(match[0]);
            }
        }
    }

    return obj;
};

dhis2.metadata.cartesianProduct = function( arrays ){

    var i, j, l, m, a1, o = [];
    if (!arrays || arrays.length == 0) return arrays;

    a1 = arrays.splice(0,1);
    arrays = dhis2.metadata.cartesianProduct( arrays );
    for (i = 0, l = a1[0].length; i < l; i++) {
        if (arrays && arrays.length) for (j = 0, m = arrays.length; j < m; j++)
            o.push([a1[0][i]].concat(arrays[j]));
        else
            o.push([a1[0][i]]);
    }
    return o;
};

dhis2.metadata.chunk = function( array, size ){
	if( !array || !array.length || !size || size < 1 ){
            return [];
	}

	var groups = [];
	var chunks = array.length / size;
	for (var i = 0, j = 0; i < chunks; i++, j += size) {
        groups[i] = array.slice(j, j + size);
    }

    return groups;
};

dhis2.metadata.processMetaDataAttribute = function( obj )
{
    if(!obj){
        return;
    }

    if(obj.attributeValues){
        for(var i=0; i<obj.attributeValues.length; i++){
            if(obj.attributeValues[i].value && obj.attributeValues[i].attribute && obj.attributeValues[i].attribute.code && obj.attributeValues[i].attribute.valueType){
            	if( obj.attributeValues[i].attribute.valueType === 'BOOLEAN' || obj.attributeValues[i].attribute.valueType === 'TRUE_ONLY' ){
                    if( obj.attributeValues[i].value === 'true' ){
                        obj[obj.attributeValues[i].attribute.code] = true;
                    }
            	}
            	else if( obj.attributeValues[i].attribute.valueType === 'NUMBER' && obj.attributeValues[i].value ){
                    obj[obj.attributeValues[i].attribute.code] = parseInt( obj.attributeValues[i].value );
            	}
                else{
                    obj[obj.attributeValues[i].attribute.code] = obj.attributeValues[i].value;
                }
            }
        }
    }

    //delete obj.attributeValues;

    return obj;
};

dhis2.metadata.getMetaObjectIds = function( objNames, url, filter )
{
    var def = $.Deferred();
    var objs = [];
    $.ajax({
        url: encodeURI( url ),
        type: 'GET',
        data: encodeURI( filter )
    }).done( function(response) {
        _.each( _.values( response[objNames] ), function ( obj ) {
        	objs.push( obj );
        });
        def.resolve( objs );

    }).fail(function(){
        def.resolve( null );
    });

    return def.promise();
};

dhis2.metadata.filterMissingObjIds  = function( store, db, objs )
{
    if( !objs || !objs.length || objs.length < 1){
        return;
    }

    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();

    var missingObjIds = [];
    _.each( _.values( objs ), function ( obj ) {
        build = build.then(function() {
            var d = $.Deferred();
            var p = d.promise();
            db.get(store, obj.id).done(function(o) {
                if( !o ) {
                	missingObjIds.push( obj.id );
                }
                else{
                	if( obj.version && o.version != obj.version ){
                		missingObjIds.push( obj.id );
                	}
                }
                d.resolve();
            });

            return p;
        });
    });

    build.done(function() {
        def.resolve();
        promise = promise.done( function () {
            mainDef.resolve( missingObjIds );
        } );
    }).fail(function(){
        mainDef.resolve( null );
    });

    builder.resolve();

    return mainPromise;
};

dhis2.metadata.getBatches = function( ids, batchSize, store, objs, url, filter, storage, db, func )
{
    if( !ids || !ids.length || ids.length < 1){
        return;
    }

    var batches = dhis2.metadata.chunk( ids, batchSize );

    var mainDef = $.Deferred();
    var mainPromise = mainDef.promise();

    var def = $.Deferred();
    var promise = def.promise();

    var builder = $.Deferred();
    var build = builder.promise();

    _.each( _.values( batches ), function ( batch ) {
        promise = promise.then(function(){
            return dhis2.metadata.fetchBatchItems( batch, store, objs, url, filter, storage, db, func );
        });
    });

    build.done(function() {
        def.resolve();
        promise = promise.done( function () {
            mainDef.resolve();
        } );

    }).fail(function(){
        mainDef.resolve( null );
    });

    builder.resolve();

    return mainPromise;
};

dhis2.metadata.fetchBatchItems = function( batch, store, objs, url, filter, storage, db, func )
{
    var ids = '[' + batch.toString() + ']';
    filter = filter + '&filter=id:in:' + ids;
    return dhis2.metadata.getMetaObjects( store, objs, url, filter, storage, db, func );
};

dhis2.metadata.getMetaObjects = function( store, objs, url, filter, storage, db, func )
{
    var def = $.Deferred();

    $.ajax({
        url: encodeURI( url ),
        type: 'GET',
        data: encodeURI( filter )
    }).done(function(response) {
        if(response[objs]){
            var count = 0;
            _.each( _.values( response[objs] ), function ( obj ) {
                obj = dhis2.metadata.processMetaDataAttribute( obj );
                if( func ) {
                    obj = func(obj, 'organisationUnits');
                }
                if( store === 'categoryCombos' ){

                	if( obj.categories ){
                        _.each( _.values( obj.categories ), function ( ca ) {
                            if( ca.categoryOptions ){
                                _.each( _.values( ca.categoryOptions ), function ( co ) {
                                    co.mappedOrganisationUnits = [];
                                    if( co.organisationUnits && co.organisationUnits.length > 0 ){
                                        co.mappedOrganisationUnits = $.map(co.organisationUnits, function(ou){return ou.id;});
                                    }
                                    delete co.organisationUnits;
                                });
                            }
                        });
                    }

                    if( obj.categoryOptionCombos && obj.categories ){
                        var categoryOptions = [];
                        _.each( _.values( obj.categories ), function ( cat ) {
                            if( cat.categoryOptions ){
                                categoryOptions.push(  $.map(cat.categoryOptions, function(co){return co.displayName;}) );
                            }
                        });

                        var cocs = dhis2.metadata.cartesianProduct( categoryOptions );

                        var sortedOptionCombos = [];
                        _.each( _.values( cocs ), function ( coc ) {
                            for( var i=0; i<obj.categoryOptionCombos.length; i++){
                                var opts = obj.categoryOptionCombos[i].displayName.split(', ');
                                var itsc = _.intersection(opts, coc);
                                if( itsc.length === opts.length && itsc.length === coc.length ){
                                    sortedOptionCombos.push({id: obj.categoryOptionCombos[i].id, displayName: coc.join(',')} );
                                    break;
                                }
                            }
                        });
                        obj.categoryOptionCombos = sortedOptionCombos;
                        /*if( obj.categoryOptionCombos.length !== sortedOptionCombos.length ){
                            console.log(obj.displayName, ' - ', obj.categoryOptionCombos.length, ' - ', sortedOptionCombos.length);
                        }
                        else{
                            obj.categoryOptionCombos = sortedOptionCombos;
                        }*/
                    }
                }
                else if( store === 'dataSets' ){

                    if( obj.sections ){
                        _.each(obj.sections, function(sec){
                            if( sec.indicators ){
                                angular.forEach(sec.indicators, function(ind){
                                    ind=dhis2.metadata.processMetaDataAttribute(ind);
                                    ind.params=[];
                                    ind=dhis2.metadata.expressionMatcher(ind,'numerator','params',dhis2.metadata.expressionRegex,dhis2.metadata.operatorRegex);
                                    ind=dhis2.metadata.expressionMatcher(ind,'denominator','params',dhis2.metadata.expressionRegex,dhis2.metadata.operatorRegex);
                                });
                            }
                            if( sec.greyedFields ){
                                var greyedFields = [];
                                greyedFields = $.map(sec.greyedFields, function(gf){return gf.dimensionItem;});
                                sec.greyedFields = greyedFields;
                            }
                        });
                    }

                    var dataElements = [];
                    _.each(obj.dataSetElements, function(dse){
                        if( dse.dataElement ){
                            dataElements.push( dhis2.metadata.processMetaDataAttribute( dse.dataElement ) );
                        }
                    });
                    obj.dataElements = dataElements;
                    delete obj.dataSetElements;
                }
                else if( store === 'validationRules' ){
                    obj.params = [];
                    obj = dhis2.metadata.expressionMatcher(obj, 'leftSide', 'params',dhis2.metadata.expressionRegex, dhis2.metadata.operatorRegex, 'expression');
                    obj = dhis2.metadata.expressionMatcher(obj, 'rightSide', 'params',dhis2.metadata.expressionRegex, dhis2.metadata.operatorRegex, 'expression');
                }
                else if( store === 'periodTypes' ){
                    obj.id = count;
                }
                count++;
            });

            if(storage === 'idb'){
                db.setAll( store, response[objs] );
            }
            if(storage === 'localStorage'){
                localStorage[store] = JSON.stringify(response[objs]);
            }
            if(storage === 'sessionStorage'){
                var SessionStorageService = angular.element('body').injector().get('SessionStorageService');
                SessionStorageService.set(store, response[objs]);
            }
        }

        if(storage === 'temp'){
            def.resolve(response[objs] ? response[objs] : []);
        }
        else{
            def.resolve();
        }
    }).fail(function(){
        def.resolve( null );
    });

    return def.promise();
};

dhis2.metadata.getMetaObject = function( id, store, url, filter, storage, db )
{
    var def = $.Deferred();

    if(id){
        url = url + '/' + id + '.json';
    }

    $.ajax({
        url: encodeURI( url ),
        type: 'GET',
        data: encodeURI( filter )
    }).done( function( response ){
        if(storage === 'idb'){
            if( response && response.id) {
                db.set( store, response );
            }
        }
        if(storage === 'localStorage'){
            localStorage[store] = JSON.stringify(response);
        }
        if(storage === 'sessionStorage'){
            var SessionStorageService = angular.element('body').injector().get('SessionStorageService');
            SessionStorageService.set(store, response);
        }

        def.resolve();
    }).fail(function(){
        def.resolve();
    });

    return def.promise();
};

dhis2.metadata.processObject = function(obj, prop){
    if( obj[prop] ){
        var oo = {};
        _.each(_.values( obj[prop]), function(o){
            if( o.name ){
                oo[o.id] = o.name;
            }
            else if( o.level ){
                oo[o.id] = o;
            }
            else{
                oo[o.id] = o.id;
            }
        });
        obj[prop] = oo;
    }
    return obj;
};