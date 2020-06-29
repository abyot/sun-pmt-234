'use strict';

/* Filters */

var financialAnalysisFilters = angular.module('financialAnalysisFilters', [])

.filter('existingAgency', function(){
    
    return function( items, existingItems ){

    	if( !items ){
            return [];
    	}
    	
    	if( !existingItems ){
            return items;
    	}
    	
        var filteredItems = [], existingItemIds = $.map(existingItems, function(item){return item.categoryOptionCombo;});
            
        angular.forEach(items, function(item){                
            if( existingItemIds.indexOf(item.id) === -1 ){
                filteredItems.push(item);
            }
        });
        
        return filteredItems;
    };
});