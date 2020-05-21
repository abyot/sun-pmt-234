package org.hisp.dhis.analytics.data;

/*
 * Copyright (c) 2004-2020, University of Oslo
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 * Neither the name of the HISP project nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
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

import static com.google.common.base.Preconditions.checkNotNull;
import static org.hisp.dhis.analytics.DataQueryParams.COMPLETENESS_DIMENSION_TYPES;
import static org.hisp.dhis.common.DimensionalObject.*;
import static org.hisp.dhis.common.DimensionalObjectUtils.asTypedList;
import static org.hisp.dhis.common.DimensionalObjectUtils.getDimensions;
import static org.hisp.dhis.common.IdentifiableObjectUtils.getUids;

import java.util.List;

import org.hisp.dhis.analytics.DataQueryParams;
import org.hisp.dhis.analytics.OutputFormat;
import org.hisp.dhis.analytics.QueryValidator;
import org.hisp.dhis.common.*;
import org.hisp.dhis.commons.filter.FilterUtils;
import org.hisp.dhis.dataelement.DataElement;
import org.hisp.dhis.feedback.ErrorCode;
import org.hisp.dhis.feedback.ErrorMessage;
import org.hisp.dhis.program.ProgramDataElementDimensionItem;
import org.hisp.dhis.setting.SettingKey;
import org.hisp.dhis.setting.SystemSettingManager;
import org.hisp.dhis.system.filter.AggregatableDataElementFilter;
import org.springframework.stereotype.Component;

import com.google.common.collect.Lists;

import lombok.extern.slf4j.Slf4j;

/**
 * @author Lars Helge Overland
 */
@Slf4j
@Component( "org.hisp.dhis.analytics.QueryValidator" )
public class DefaultQueryValidator
    implements QueryValidator
{
    private final SystemSettingManager systemSettingManager;

    private final NestedIndicatorCyclicDependencyInspector nestedIndicatorCyclicDependencyInspector;

    public DefaultQueryValidator( SystemSettingManager systemSettingManager, NestedIndicatorCyclicDependencyInspector nestedIndicatorCyclicDependencyInspector )
    {
        checkNotNull( systemSettingManager );
        checkNotNull( nestedIndicatorCyclicDependencyInspector );

        this.systemSettingManager = systemSettingManager;
        this.nestedIndicatorCyclicDependencyInspector = nestedIndicatorCyclicDependencyInspector;
    }

    // -------------------------------------------------------------------------
    // QueryValidator implementation
    // -------------------------------------------------------------------------

    @Override
    public void validate( DataQueryParams params )
        throws IllegalQueryException
    {
        ErrorMessage error = validateForErrorMessage( params );

        if ( error != null )
        {
            log.warn( String.format( "Analytics validation failed, code: '%s', message: '%s'", error.getErrorCode(), error.getMessage() ) );

            throw new IllegalQueryException( error );
        }
    }

    @Override
    public ErrorMessage validateForErrorMessage( DataQueryParams params )
    {
        ErrorMessage error = null;

        if ( params == null )
        {
            throw new IllegalQueryException( ErrorCode.E7100 );
        }

        final List<DimensionalItemObject> dataElements = Lists.newArrayList( params.getDataElements() );
        params.getProgramDataElements().forEach( pde -> dataElements.add( ((ProgramDataElementDimensionItem) pde).getDataElement() ) );
        final List<DataElement> nonAggDataElements = FilterUtils.inverseFilter( asTypedList( dataElements ), AggregatableDataElementFilter.INSTANCE );

        if ( !params.isSkipDataDimensionValidation() )
        {
            if ( params.getDimensions().isEmpty() )
            {
                error = new ErrorMessage( ErrorCode.E7101 );
            }

            if ( !params.isSkipData() &&
                params.getDataDimensionAndFilterOptions().isEmpty() &&
                params.getAllDataElementGroups().isEmpty() )
            {
                error = new ErrorMessage( ErrorCode.E7102 );
            }

            if ( !params.getDimensionsAsFilters().isEmpty() )
            {
                error = new ErrorMessage( ErrorCode.E7103, getDimensions( params.getDimensionsAsFilters() ) );
            }
        }

        if ( !params.hasPeriods() && !params.isSkipPartitioning() && !params.hasStartEndDate() )
        {
            error = new ErrorMessage( ErrorCode.E7104 );
        }

        if ( params.hasPeriods() && params.hasStartEndDate() )
        {
            error = new ErrorMessage( ErrorCode.E7105 );
        }

        if ( params.hasStartEndDate() && params.startDateAfterEndDate() )
        {
            error = new ErrorMessage( ErrorCode.E7106 );
        }

        if ( params.hasStartEndDate() && !params.getReportingRates().isEmpty() )
        {
            error = new ErrorMessage( ErrorCode.E7107 );;
        }

        if ( !params.getFilterIndicators().isEmpty() && params.getFilterOptions( DATA_X_DIM_ID ).size() > 1 )
        {
            error = new ErrorMessage( ErrorCode.E7108 );
        }

        if ( !params.getFilterReportingRates().isEmpty() && params.getFilterOptions( DATA_X_DIM_ID ).size() > 1 )
        {
            error = new ErrorMessage( ErrorCode.E7109 );
        }

        if ( params.getFilters().contains( new BaseDimensionalObject( CATEGORYOPTIONCOMBO_DIM_ID ) ) )
        {
            error = new ErrorMessage( ErrorCode.E7110 );
        }

        if ( !params.getDuplicateDimensions().isEmpty() )
        {
            error = new ErrorMessage( ErrorCode.E7111, getDimensions( params.getDuplicateDimensions() ) );
        }

        if ( !params.getAllReportingRates().isEmpty() && !params.containsOnlyDimensionsAndFilters( COMPLETENESS_DIMENSION_TYPES ) )
        {
            error = new ErrorMessage( ErrorCode.E7112, COMPLETENESS_DIMENSION_TYPES );
        }

        if ( params.hasDimensionOrFilter( CATEGORYOPTIONCOMBO_DIM_ID ) && params.getAllDataElements().isEmpty() )
        {
            error = new ErrorMessage( ErrorCode.E7113 );
        }

        if ( params.hasDimensionOrFilter( CATEGORYOPTIONCOMBO_DIM_ID ) && ( params.getAllDataElements().size() != params.getAllDataDimensionItems().size() ) )
        {
            error = new ErrorMessage( ErrorCode.E7114 );
        }

        if ( !nonAggDataElements.isEmpty() )
        {
            error = new ErrorMessage( ErrorCode.E7115, getUids( nonAggDataElements ) );
        }

        if ( !params.getIndicators().isEmpty() )
        {
            try
            {
                nestedIndicatorCyclicDependencyInspector.inspect( params.getIndicators() );
            }
            catch ( CyclicReferenceException cre )
            {
                error = new ErrorMessage( ErrorCode.E7116, cre.getMessage() );
            }
        }

        if ( params.isOutputFormat( OutputFormat.DATA_VALUE_SET ) )
        {
            if ( !params.hasDimension( DATA_X_DIM_ID ) )
            {
                error = new ErrorMessage( ErrorCode.E7117 );
            }

            if ( !params.hasDimension( PERIOD_DIM_ID ) )
            {
                error = new ErrorMessage( ErrorCode.E7118 );
            }

            if ( !params.hasDimension( ORGUNIT_DIM_ID ) )
            {
                error = new ErrorMessage( ErrorCode.E7119 );;
            }
        }

        return error;
    }

    @Override
    public void validateTableLayout( DataQueryParams params, List<String> columns, List<String> rows )
    {
        String violation = null;

        if ( columns != null )
        {
            for ( String column : columns )
            {
                if ( !params.hasDimension( column ) )
                {
                    violation = "Column must be present as dimension in query: " + column;
                }
            }
        }

        if ( rows != null )
        {
            for ( String row : rows )
            {
                if ( !params.hasDimension( row ) )
                {
                    violation = "Row must be present as dimension in query: " + row;
                }
            }
        }

        if ( violation != null )
        {
            log.warn( String.format( "Validation failed: %s", violation ) );

            throw new IllegalQueryException( violation );
        }
    }

    @Override
    public void validateMaintenanceMode()
        throws MaintenanceModeException
    {
        boolean maintenance = (Boolean) systemSettingManager.getSystemSetting( SettingKey.ANALYTICS_MAINTENANCE_MODE );

        if ( maintenance )
        {
            throw new MaintenanceModeException( "Analytics engine is in maintenance mode, try again later" );
        }
    }

}
