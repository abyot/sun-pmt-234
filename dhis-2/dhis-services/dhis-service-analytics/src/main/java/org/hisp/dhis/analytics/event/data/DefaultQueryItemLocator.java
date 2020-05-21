package org.hisp.dhis.analytics.event.data;

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
import static org.hisp.dhis.common.DimensionalObject.*;

import org.apache.commons.lang3.StringUtils;
import org.hisp.dhis.analytics.EventOutputType;
import org.hisp.dhis.analytics.event.QueryItemLocator;
import org.hisp.dhis.common.BaseIdentifiableObject;
import org.hisp.dhis.common.IllegalQueryException;
import org.hisp.dhis.common.QueryItem;
import org.hisp.dhis.common.ValueType;
import org.hisp.dhis.dataelement.DataElement;
import org.hisp.dhis.dataelement.DataElementService;
import org.hisp.dhis.legend.LegendSet;
import org.hisp.dhis.legend.LegendSetService;
import org.hisp.dhis.program.*;
import org.hisp.dhis.relationship.RelationshipType;
import org.hisp.dhis.relationship.RelationshipTypeService;
import org.hisp.dhis.trackedentity.TrackedEntityAttribute;
import org.hisp.dhis.trackedentity.TrackedEntityAttributeService;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Stream;

/**
 * {@inheritDoc}
 * @author Luciano Fiandesio
 */
@Component
public class DefaultQueryItemLocator implements QueryItemLocator
{
    private final ProgramStageService programStageService;

    private final DataElementService dataElementService;

    private final TrackedEntityAttributeService attributeService;

    private final ProgramIndicatorService programIndicatorService;

    private final LegendSetService legendSetService;

    private final RelationshipTypeService relationshipTypeService;

    public DefaultQueryItemLocator( ProgramStageService programStageService, DataElementService dataElementService,
        TrackedEntityAttributeService attributeService, ProgramIndicatorService programIndicatorService,
        LegendSetService legendSetService, RelationshipTypeService relationshipTypeService )
    {
        this.programStageService = programStageService;
        this.dataElementService = dataElementService;
        this.attributeService = attributeService;
        this.programIndicatorService = programIndicatorService;
        this.legendSetService = legendSetService;
        this.relationshipTypeService = relationshipTypeService;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public QueryItem getQueryItemFromDimension( String dimension, Program program, EventOutputType type ) {

        checkNotNull( program, "Program can not be null" );

        LegendSet legendSet = getLegendSet(dimension);

        return getDataElement( dimension, program, legendSet, type )
            .orElseGet( () -> getTrackedEntityAttribute( dimension, program, legendSet )
            .orElseGet( () -> getProgramIndicator( dimension, program, legendSet )
            .orElseThrow( () -> new IllegalQueryException(
                "Item identifier does not reference any data element, attribute or indicator part of the program: " + dimension ) ) ) );
    }
    
    private LegendSet getLegendSet( String dimension )
    {
        String[] legendSplit = dimension.split( ITEM_SEP );

        return legendSplit.length > 1 && legendSplit[1] != null ? legendSetService.getLegendSet( legendSplit[1] )
            : null;
    }

    private String getElement( String dimension, int pos )
    {
        String dim = StringUtils.substringBefore(dimension, ITEM_SEP);
        
        String[] dimSplit = dim.split( "\\" + PROGRAMSTAGE_SEP );

        return dimSplit.length == 1 ? dimSplit[0] : dimSplit[pos];

    }

    private String getFirstElement( String dimension )
    {
        return getElement( dimension, 0);
    }

    private String getSecondElement( String dimension )
    {
        return getElement( dimension, 1);
    }

    private Optional<QueryItem> getDataElement( String dimension, Program program, LegendSet legendSet, EventOutputType type )
    {
        QueryItem qi = null;

        ProgramStage programStage = getProgramStageOrFail( dimension );

        DataElement de = dataElementService.getDataElement( getSecondElement( dimension ) );

        if ( de != null && program.containsDataElement( de ) )
        {
            ValueType valueType = legendSet != null ? ValueType.TEXT : de.getValueType();

            qi = new QueryItem( de, program, legendSet, valueType, de.getAggregationType(), de.getOptionSet() );
            if ( programStage != null )
            {
                qi.setProgramStage( programStage );
            }
            else if ( type != null && type.equals( EventOutputType.ENROLLMENT ) )
            {
                throw new IllegalQueryException( "For enrollment analytics queries,"
                    + "program stage is mandatory for data element dimensions: " + dimension );
            }
        }
        return Optional.ofNullable( qi );
    }

    private Optional<QueryItem> getTrackedEntityAttribute( String dimension, Program program,
        LegendSet legendSet )
    {

        QueryItem qi = null;
        TrackedEntityAttribute at = attributeService.getTrackedEntityAttribute( getSecondElement( dimension ) );

        if ( at != null && program.containsAttribute( at ) )
        {
            ValueType valueType = legendSet != null ? ValueType.TEXT : at.getValueType();

            qi = new QueryItem( at, program, legendSet, valueType, at.getAggregationType(), at.getOptionSet() );
        }
        return Optional.ofNullable( qi );
    }

    private Optional<QueryItem> getProgramIndicator( String dimension, Program program, LegendSet legendSet )
    {
        QueryItem qi = null;

        RelationshipType relationshipType = getRelationshipTypeOrFail( dimension );

        ProgramIndicator pi = programIndicatorService.getProgramIndicatorByUid( getSecondElement( dimension ) );

        // only allow a program indicator from a different program to be add, when a relationship type is present
        if ( pi != null )
        {
            if ( relationshipType != null )
            {
                qi = new QueryItem( pi, program, legendSet, ValueType.NUMBER, pi.getAggregationType(), null,
                    relationshipType );
            }
            else
            {
                if ( program.getProgramIndicators().contains( pi ) )
                {
                    qi = new QueryItem( pi, program, legendSet, ValueType.NUMBER, pi.getAggregationType(), null );
                }
            }
        }

        return Optional.ofNullable( qi );
    }

    private ProgramStage getProgramStageOrFail( String dimension )
    {
        BaseIdentifiableObject baseIdentifiableObject = getIdObjectOrFail( dimension );
        return (baseIdentifiableObject instanceof ProgramStage ? (ProgramStage) baseIdentifiableObject : null);
    }

    private RelationshipType getRelationshipTypeOrFail( String dimension )
    {
        BaseIdentifiableObject baseIdentifiableObject = getIdObjectOrFail( dimension );
        return (baseIdentifiableObject instanceof RelationshipType ? (RelationshipType) baseIdentifiableObject : null);
    }

    private BaseIdentifiableObject getIdObjectOrFail( String dimension )
    {
        Stream<Supplier<BaseIdentifiableObject>> fetchers = Stream.of(
            () -> relationshipTypeService.getRelationshipType( getFirstElement( dimension ) ),
            () -> programStageService.getProgramStage( getFirstElement( dimension ) ) );

        boolean requiresIdObject = dimension.split( "\\" + PROGRAMSTAGE_SEP ).length > 1;

        Optional<BaseIdentifiableObject> found = fetchers.map( Supplier::get ).filter( Objects::nonNull ).findFirst();

        if ( requiresIdObject && !found.isPresent() )
        {
            throw new IllegalQueryException(
                "Dimension: " + dimension + " could not be translated into a valid query item" );
        }

        return found.orElse( null );
    }

}
