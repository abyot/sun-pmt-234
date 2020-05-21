package org.hisp.dhis.dxf2.events.eventdatavalue;
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

import java.util.*;
import java.util.stream.Collectors;

import org.hisp.dhis.cache.Cache;
import org.hisp.dhis.common.IdScheme;
import org.hisp.dhis.common.IdentifiableObjectUtils;
import org.hisp.dhis.dataelement.DataElement;
import org.hisp.dhis.dxf2.common.ImportOptions;
import org.hisp.dhis.trackedentity.TrackerAccessManager;
import org.hisp.dhis.dxf2.events.event.AbstractEventService;
import org.hisp.dhis.dxf2.events.event.DataValue;
import org.hisp.dhis.dxf2.events.event.Event;
import org.hisp.dhis.dxf2.importsummary.ImportConflict;
import org.hisp.dhis.dxf2.importsummary.ImportStatus;
import org.hisp.dhis.dxf2.importsummary.ImportSummary;
import org.hisp.dhis.event.EventStatus;
import org.hisp.dhis.eventdatavalue.EventDataValue;
import org.hisp.dhis.program.ProgramStageDataElement;
import org.hisp.dhis.program.ProgramStageInstance;
import org.hisp.dhis.program.ProgramStageInstanceService;
import org.hisp.dhis.program.ValidationStrategy;
import org.hisp.dhis.security.Authorities;
import org.hisp.dhis.system.util.ValidationUtils;
import org.hisp.dhis.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.google.common.collect.Sets;

/**
 * @author David Katuscak
 */
@Service( "org.hisp.dhis.dxf2.events.eventdatavalue.EventDataValueService" )
@Transactional
public class DefaultEventDataValueService implements EventDataValueService
{
    private final ProgramStageInstanceService programStageInstanceService;

    private final TrackerAccessManager trackerAccessManager;


    public DefaultEventDataValueService( TrackerAccessManager trackerAccessManager,
        ProgramStageInstanceService programStageInstanceService )
    {
        checkNotNull( trackerAccessManager );
        checkNotNull( programStageInstanceService );

        this.trackerAccessManager = trackerAccessManager;
        this.programStageInstanceService = programStageInstanceService;
    }

    @Override
    public void processDataValues( ProgramStageInstance programStageInstance, Event event, boolean singleValue,
                                  ImportOptions importOptions, ImportSummary importSummary, Cache<DataElement> dataElementCache ) {

        Map<String, EventDataValue> dataElementValueMap = getDataElementToEventDataValueMap( programStageInstance.getEventDataValues() );

        boolean validateMandatoryAttributes = doValidationOfMandatoryAttributes( importOptions.getUser() );
        if ( validateMandatoryAttributes && !validatePresenceOfMandatoryDataElements( event, programStageInstance,
            dataElementCache, importOptions, importSummary, singleValue ) )
        {
            importSummary.setStatus( ImportStatus.ERROR );
            importSummary.incrementIgnored();

            return;
        }

        Set<EventDataValue> newDataValues = new HashSet<>();
        Set<EventDataValue> updatedDataValues = new HashSet<>();
        Set<EventDataValue> removedDataValuesDueToEmptyValue = new HashSet<>();

        String fallbackStoredBy =
            AbstractEventService.getValidUsername( event.getStoredBy(), importSummary,
                importOptions.getUser() != null ? importOptions.getUser().getUsername() : "[Unknown]" );

        for ( DataValue dataValue : event.getDataValues() )
        {
            String storedBy = !StringUtils.isEmpty( dataValue.getStoredBy() ) ? dataValue.getStoredBy() : fallbackStoredBy;
            DataElement dataElement = dataElementCache.get( dataValue.getDataElement() ).orElse( null );

            if ( dataElement == null )
            {
                // This can happen if a wrong data element identifier is provided
                importSummary.getConflicts().add( new ImportConflict( "dataElement", dataValue.getDataElement() + " is not a valid data element" ) );
            }
            else if ( validateDataValue( programStageInstance, importOptions.getUser(), dataElement, dataValue.getValue(), importSummary )
                && !importOptions.isDryRun() )
            {
                prepareDataValueForStorage( dataElementValueMap, dataValue, dataElement, newDataValues, updatedDataValues,
                    removedDataValuesDueToEmptyValue, storedBy );
            }
        }

        programStageInstanceService.auditDataValuesChangesAndHandleFileDataValues( newDataValues, updatedDataValues, removedDataValuesDueToEmptyValue, dataElementCache, programStageInstance, singleValue );
    }

    private void prepareDataValueForStorage( Map<String, EventDataValue> dataElementToValueMap, DataValue dataValue,
        DataElement dataElement, Set<EventDataValue> newDataValues, Set<EventDataValue> updatedDataValues,
        Set<EventDataValue> removedDataValuesDueToEmptyValue, String storedBy ) {

        EventDataValue eventDataValue;

        // The data value for this element was already saved so make an update
        // I have to use dataElement instead of dataValue as dataValue can have a different IdScheme
        if ( dataElementToValueMap.containsKey( dataElement.getUid() ) )
        {
            eventDataValue = dataElementToValueMap.get( dataElement.getUid() );
            eventDataValue.setStoredBy( storedBy );

            if ( dataValue.getValue() != null && !dataValue.getValue().trim().isEmpty() )
            {
                eventDataValue.setValue( dataValue.getValue() );
                eventDataValue.setLastUpdated( new Date() );
                eventDataValue.setProvidedElsewhere( dataValue.getProvidedElsewhere() );

                updatedDataValues.add( eventDataValue );
            }
            else {
                // dataValue was present in the payload but was empty, I consider it as it should be removed from DB. This special case
                // is used only when it is a singleValue update. If it is regular update, then just not including it in
                // updatedOrNewDataValues is enough
                removedDataValuesDueToEmptyValue.add( eventDataValue );
            }
        }
        // Value is not present in DB so consider it a new and save if it is valid
        else if ( dataValue.getValue() != null && !dataValue.getValue().trim().isEmpty() )
        {
            eventDataValue = new EventDataValue( dataElement.getUid(), dataValue.getValue() );
            eventDataValue.setAutoFields();
            eventDataValue.setStoredBy( storedBy );
            eventDataValue.setProvidedElsewhere( dataValue.getProvidedElsewhere() );

            newDataValues.add( eventDataValue );
        }
    }

    private Map<String, EventDataValue> getDataElementToEventDataValueMap(
        Collection<EventDataValue> dataValues )
    {
        return dataValues.stream().collect( Collectors.toMap( EventDataValue::getDataElement, dv -> dv ) );
    }

    private boolean doValidationOfMandatoryAttributes( User user )
    {
        return user == null || !user.isAuthorized( Authorities.F_IGNORE_TRACKER_REQUIRED_VALUE_VALIDATION.getAuthority() );
    }

    private boolean validatePresenceOfMandatoryDataElements( Event event, ProgramStageInstance programStageInstance,
                                                             Cache<DataElement> dataElementsCache, ImportOptions importOptions, ImportSummary importSummary,
        boolean isSingleValueUpdate )
    {
        ValidationStrategy validationStrategy = programStageInstance.getProgramStage().getValidationStrategy();

        if ( validationStrategy == ValidationStrategy.ON_UPDATE_AND_INSERT ||
            (validationStrategy == ValidationStrategy.ON_COMPLETE && event.getStatus() == EventStatus.COMPLETED) )
        {
            //I am filling the set only if I know that I will do the validation. Otherwise, it would be waste of resources
            Set<String> mandatoryDataElements = programStageInstance.getProgramStage().getProgramStageDataElements().stream()
                .filter( ProgramStageDataElement::isCompulsory )
                .map( psde -> psde.getDataElement().getUid() )
                .collect( Collectors.toSet() );

            Set<String> presentDataElements = event.getDataValues().stream()
                .filter( dv -> dv != null && dv.getValue() != null && !dv.getValue().trim().isEmpty() && !dv.getValue().trim().equals( "null" ) )
                .map( dv -> dataElementsCache.get( dv.getDataElement() ).get().getUid() )
                .collect( Collectors.toSet() );

            // When the request is update, then only changed data values can be in the payload and so I should take into
            // account also already stored data values in order to make correct decision. Basically, this situation happens when
            // only 1 dataValue is updated and /events/{uid}/{dataElementUid} endpoint is leveraged.
            if ( isSingleValueUpdate )
            {
                presentDataElements.addAll(
                    programStageInstance.getEventDataValues().stream()
                        .filter( dv -> !StringUtils.isEmpty( dv.getValue().trim() ) )
                        .map( EventDataValue::getDataElement )
                        .collect( Collectors.toSet() ) );
            }

            Set<String> notPresentMandatoryDataElements = Sets.difference( mandatoryDataElements, presentDataElements );

            if ( notPresentMandatoryDataElements.size() > 0 )
            {
                notPresentMandatoryDataElements.stream()
                    .map( i -> dataElementsCache.get( i ).get() )
                    .forEach( de -> importSummary.getConflicts().add(
                        new ImportConflict( getDataElementIdentificator( de, importOptions.getIdSchemes().getDataElementIdScheme() ),
                            "value_required_but_not_provided" ) ) );
                return false;
            }
        }

        return true;
    }

    private String getDataElementIdentificator( DataElement dataElement, IdScheme dataElementIdScheme )
    {
        if ( dataElementIdScheme.isAttribute() )
        {
            return dataElement.getName();
        }

        return IdentifiableObjectUtils.getIdentifierBasedOnIdScheme( dataElement, dataElementIdScheme );
    }

    private boolean validateDataValue( ProgramStageInstance programStageInstance, User user, DataElement dataElement,
        String value, ImportSummary importSummary )
    {
        String status = ValidationUtils.dataValueIsValid( value, dataElement );
        boolean validationPassed = true;

        if ( status != null )
        {
            importSummary.getConflicts().add( new ImportConflict( dataElement.getUid(), status ) );
            validationPassed = false;
        }

        List<String> errors = trackerAccessManager.canWrite( user, programStageInstance, dataElement, true );

        if ( !errors.isEmpty() )
        {
            errors.forEach( error -> importSummary.getConflicts().add( new ImportConflict( dataElement.getUid(), error ) ) );
            validationPassed = false;
        }

        return validationPassed;
    }
}
