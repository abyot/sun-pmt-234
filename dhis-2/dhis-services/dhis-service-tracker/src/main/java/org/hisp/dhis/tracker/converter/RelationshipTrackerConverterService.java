package org.hisp.dhis.tracker.converter;

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

import org.hisp.dhis.common.CodeGenerator;
import org.hisp.dhis.program.ProgramInstance;
import org.hisp.dhis.program.ProgramStageInstance;
import org.hisp.dhis.relationship.RelationshipType;
import org.hisp.dhis.trackedentity.TrackedEntityInstance;
import org.hisp.dhis.tracker.TrackerIdScheme;
import org.hisp.dhis.tracker.TrackerIdentifier;
import org.hisp.dhis.tracker.domain.Enrollment;
import org.hisp.dhis.tracker.domain.Event;
import org.hisp.dhis.tracker.domain.Relationship;
import org.hisp.dhis.tracker.domain.RelationshipItem;
import org.hisp.dhis.tracker.domain.TrackedEntity;
import org.hisp.dhis.tracker.preheat.TrackerPreheat;
import org.hisp.dhis.tracker.preheat.TrackerPreheatParams;
import org.hisp.dhis.tracker.preheat.TrackerPreheatService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

import static org.hisp.dhis.relationship.RelationshipEntity.*;

/**
 * @author Enrico Colasante
 */
@Service
public class RelationshipTrackerConverterService
    implements TrackerConverterService<Relationship, org.hisp.dhis.relationship.Relationship>
{
    private final TrackerPreheatService trackerPreheatService;

    private final TrackerConverterService<TrackedEntity, TrackedEntityInstance> trackedEntityTrackerConverterService;

    private final TrackerConverterService<Enrollment, ProgramInstance> enrollmentTrackerConverterService;

    private final TrackerConverterService<Event, ProgramStageInstance> eventTrackerConverterService;

    public RelationshipTrackerConverterService( TrackerPreheatService trackerPreheatService,
        TrackerConverterService<Enrollment, ProgramInstance> enrollmentTrackerConverterService,
        TrackerConverterService<Event, ProgramStageInstance> eventTrackerConverterService,
        TrackerConverterService<TrackedEntity, TrackedEntityInstance> trackedEntityTrackerConverterService )
    {
        this.trackerPreheatService = trackerPreheatService;
        this.enrollmentTrackerConverterService = enrollmentTrackerConverterService;
        this.eventTrackerConverterService = eventTrackerConverterService;
        this.trackedEntityTrackerConverterService = trackedEntityTrackerConverterService;
    }

    @Override
    public Relationship to( org.hisp.dhis.relationship.Relationship relationship )
    {
        List<Relationship> relationships = to( Collections.singletonList( relationship ) );

        if ( relationships.isEmpty() )
        {
            return null;
        }

        return relationships.get( 0 );
    }

    @Override
    public List<Relationship> to( List<org.hisp.dhis.relationship.Relationship> relationships )
    {
        return relationships.stream().map( fromRelationship -> {

            Relationship toRelationship = new Relationship();
            toRelationship.setRelationship( fromRelationship.getUid() );
            toRelationship.setBidirectional( fromRelationship.getRelationshipType().isBidirectional() );
            toRelationship.setCreatedAt( fromRelationship.getCreated().toString() );
            toRelationship.setFrom( convertRelationshipType( fromRelationship.getFrom() ) );
            toRelationship.setTo( convertRelationshipType( fromRelationship.getTo() ) );
            toRelationship.setUpdatedAt( fromRelationship.getLastUpdated().toString() );
            // TODO do we need this? this is not even the translated name..
            // toRelationship.setRelationshipName( fromRelationship.getName() );
            toRelationship.setRelationshipType( fromRelationship.getRelationshipType().getUid() );

            return toRelationship;
        } ).collect( Collectors.toList() );
    }

    private RelationshipItem convertRelationshipType( org.hisp.dhis.relationship.RelationshipItem from )
    {
        RelationshipItem relationshipItem = new RelationshipItem();
        relationshipItem.setEnrollment( from.getProgramInstance() != null ?
            enrollmentTrackerConverterService.to( from.getProgramInstance() ) : null );
        relationshipItem.setEvent( from.getProgramStageInstance() != null ?
            eventTrackerConverterService.to( from.getProgramStageInstance() ) : null );
        relationshipItem.setTrackedEntity( from.getTrackedEntityInstance() != null ?
            trackedEntityTrackerConverterService.to( from.getTrackedEntityInstance() ) : null );
        return relationshipItem;
    }

    @Override
    public org.hisp.dhis.relationship.Relationship from( Relationship relationship )
    {
        List<org.hisp.dhis.relationship.Relationship> relationships = from( Collections.singletonList( relationship ) );

        if ( relationships.isEmpty() )
        {
            return null;
        }

        return relationships.get( 0 );
    }

    @Override
    public org.hisp.dhis.relationship.Relationship from( TrackerPreheat preheat, Relationship relationship )
    {
        List<org.hisp.dhis.relationship.Relationship> relationships = from( preheat, Collections.singletonList( relationship ) );

        if ( relationships.isEmpty() )
        {
            return null;
        }

        return relationships.get( 0 );
    }

    @Override
    public List<org.hisp.dhis.relationship.Relationship> from( List<Relationship> relationships )
    {
        return from( preheat( relationships ), relationships );
    }

    @Override
    public List<org.hisp.dhis.relationship.Relationship> from( TrackerPreheat preheat, List<Relationship> fromRelationships )
    {
        List<org.hisp.dhis.relationship.Relationship> toRelationships = new ArrayList<>();

        fromRelationships.forEach( fromRelationship -> {
            org.hisp.dhis.relationship.Relationship toRelationship = preheat
                .getRelationship( TrackerIdScheme.UID, fromRelationship.getRelationship() );
            org.hisp.dhis.relationship.RelationshipType relationshipType = preheat
                .get( TrackerIdScheme.UID, RelationshipType.class, fromRelationship.getRelationshipType() );
            org.hisp.dhis.relationship.RelationshipItem fromItem = new org.hisp.dhis.relationship.RelationshipItem();
            org.hisp.dhis.relationship.RelationshipItem toItem = new org.hisp.dhis.relationship.RelationshipItem();

            if ( toRelationship == null )
            {
                Date now = new Date();

                toRelationship = new org.hisp.dhis.relationship.Relationship();
                toRelationship.setUid( fromRelationship.getRelationship() );
                toRelationship.setCreated( now );
                toRelationship.setLastUpdated( now );
            }
            if ( !CodeGenerator.isValidUid( toRelationship.getUid() ) )
            {
                toRelationship.setUid( CodeGenerator.generateUid() );
            }

            // TODO do we need this? this is not even the translated name..
            // toRelationship.setName( fromRelationship.getRelationshipName() );
            toRelationship.setRelationshipType( relationshipType );

            if ( fromRelationship.getRelationship() != null )
            {
                toRelationship.setUid( fromRelationship.getRelationship() );
            }

            // FROM
            if ( relationshipType.getFromConstraint().getRelationshipEntity().equals( TRACKED_ENTITY_INSTANCE ) )
            {
                fromItem.setTrackedEntityInstance( preheat.getTrackedEntity( TrackerIdScheme.UID,
                    fromRelationship.getFrom().getTrackedEntity().getTrackedEntity() ) );
            }
            else if ( relationshipType.getFromConstraint().getRelationshipEntity().equals( PROGRAM_INSTANCE ) )
            {
                fromItem.setProgramInstance( preheat.getEnrollment( TrackerIdScheme.UID, fromRelationship.getFrom().getEnrollment().getEnrollment() ) );
            }
            else if ( relationshipType.getFromConstraint().getRelationshipEntity().equals( PROGRAM_STAGE_INSTANCE ) )
            {
                fromItem.setProgramStageInstance(preheat.getEvent( TrackerIdScheme.UID, fromRelationship.getFrom().getEvent().getEvent() ) );
            }

            // TO
            if ( relationshipType.getToConstraint().getRelationshipEntity().equals( TRACKED_ENTITY_INSTANCE ) )
            {
                toItem.setTrackedEntityInstance( preheat.getTrackedEntity( TrackerIdScheme.UID,
                    fromRelationship.getTo().getTrackedEntity().getTrackedEntity() ) );
            }
            else if ( relationshipType.getToConstraint().getRelationshipEntity().equals( PROGRAM_INSTANCE ) )
            {
                toItem.setProgramInstance( preheat.getEnrollment( TrackerIdScheme.UID, fromRelationship.getFrom().getEnrollment().getEnrollment() ) );
            }
            else if ( relationshipType.getToConstraint().getRelationshipEntity().equals( PROGRAM_STAGE_INSTANCE ) )
            {
                toItem.setProgramStageInstance(preheat.getEvent( TrackerIdScheme.UID, fromRelationship.getFrom().getEvent().getEvent() ) );
            }

            toRelationship.setFrom( fromItem );
            toRelationship.setTo( toItem );

            toRelationships.add( toRelationship );
        } );

        return toRelationships;
    }

    private TrackerPreheat preheat( List<Relationship> relationships )
    {
        TrackerPreheatParams params = TrackerPreheatParams.builder().relationships( relationships ).build();
        return trackerPreheatService.preheat( params );
    }
}
