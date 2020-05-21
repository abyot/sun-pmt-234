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
import org.hisp.dhis.organisationunit.OrganisationUnit;
import org.hisp.dhis.program.Program;
import org.hisp.dhis.program.ProgramInstance;
import org.hisp.dhis.trackedentity.TrackedEntityInstance;
import org.hisp.dhis.tracker.TrackerIdScheme;
import org.hisp.dhis.tracker.domain.Enrollment;
import org.hisp.dhis.tracker.domain.EnrollmentStatus;
import org.hisp.dhis.tracker.preheat.TrackerPreheat;
import org.hisp.dhis.tracker.preheat.TrackerPreheatParams;
import org.hisp.dhis.tracker.preheat.TrackerPreheatService;
import org.hisp.dhis.util.DateUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

/**
 * @author Morten Olav Hansen <mortenoh@gmail.com>
 */
@Service
public class EnrollmentTrackerConverterService
    implements TrackerConverterService<Enrollment, ProgramInstance>
{
    private final TrackerPreheatService trackerPreheatService;

    public EnrollmentTrackerConverterService( TrackerPreheatService trackerPreheatService )
    {
        this.trackerPreheatService = trackerPreheatService;
    }

    @Override
    public Enrollment to( ProgramInstance programInstance )
    {
        List<Enrollment> enrollments = to( Collections.singletonList( programInstance ) );

        if ( enrollments.isEmpty() )
        {
            return null;
        }

        return enrollments.get( 0 );
    }

    @Override
    @Transactional( readOnly = true )
    public List<Enrollment> to( List<ProgramInstance> programInstances )
    {
        List<Enrollment> enrollments = new ArrayList<>();

        programInstances.forEach( tei -> {

        } );

        return enrollments;
    }

    @Override
    public ProgramInstance from( Enrollment enrollment )
    {
        List<ProgramInstance> programInstances = from( Collections.singletonList( enrollment ) );

        if ( programInstances.isEmpty() )
        {
            return null;
        }

        return programInstances.get( 0 );
    }

    @Override
    public ProgramInstance from( TrackerPreheat preheat, Enrollment enrollment )
    {
        List<ProgramInstance> programInstances = from( preheat, Collections.singletonList( enrollment ) );

        if ( programInstances.isEmpty() )
        {
            return null;
        }

        return programInstances.get( 0 );
    }

    @Override
    public List<ProgramInstance> from( List<Enrollment> enrollments )
    {
        return from( preheat( enrollments ), enrollments );
    }

    @Override
    @Transactional( readOnly = true )
    public List<ProgramInstance> from( TrackerPreheat preheat, List<Enrollment> enrollments )
    {
        List<ProgramInstance> programInstances = new ArrayList<>();

        enrollments.forEach( enrollment -> {
            ProgramInstance programInstance = preheat.getEnrollment( TrackerIdScheme.UID, enrollment.getEnrollment() );
            OrganisationUnit organisationUnit = preheat.get( TrackerIdScheme.UID, OrganisationUnit.class, enrollment.getOrgUnit() );
            Program program = preheat.get( TrackerIdScheme.UID, Program.class, enrollment.getProgram() );
            TrackedEntityInstance trackedEntityInstance = preheat.getTrackedEntity( TrackerIdScheme.UID, enrollment.getTrackedEntity() );

            if ( programInstance == null )
            {
                Date now = new Date();

                programInstance = new ProgramInstance();
                programInstance.setUid( enrollment.getEnrollment() );
                programInstance.setCreated( now );
                programInstance.setCreatedAtClient( now );
                programInstance.setLastUpdated( now );
                programInstance.setLastUpdatedAtClient( now );
            }

            if ( !CodeGenerator.isValidUid( programInstance.getUid() ) )
            {
                programInstance.setUid( CodeGenerator.generateUid() );
            }

            programInstance.setEnrollmentDate( DateUtils.parseDate( enrollment.getEnrolledAt() ) );
            programInstance.setIncidentDate( DateUtils.parseDate( enrollment.getOccurredAt() ) );
            programInstance.setOrganisationUnit( organisationUnit );
            programInstance.setProgram( program );
            programInstance.setEntityInstance( trackedEntityInstance );
            programInstance.setFollowup( enrollment.isFollowUp() );
            programInstance.setGeometry( enrollment.getGeometry() );

            if ( enrollment.getStatus() == null )
            {
                enrollment.setStatus( EnrollmentStatus.ACTIVE );
            }

            programInstance.setStatus( enrollment.getStatus().getProgramStatus() );


            programInstances.add( programInstance );
        } );

        return programInstances;
    }

    private TrackerPreheat preheat( List<Enrollment> enrollments )
    {
        TrackerPreheatParams params = TrackerPreheatParams.builder()
            .enrollments( enrollments )
            .build();

        return trackerPreheatService.preheat( params );
    }
}
