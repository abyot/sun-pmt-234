package org.hisp.dhis.tracker;

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

import com.google.common.base.Enums;
import lombok.extern.slf4j.Slf4j;
import org.hisp.dhis.common.CodeGenerator;
import org.hisp.dhis.common.IdScheme;
import org.hisp.dhis.common.IdentifiableObjectManager;
import org.hisp.dhis.commons.timer.SystemTimer;
import org.hisp.dhis.commons.timer.Timer;
import org.hisp.dhis.system.notification.Notifier;
import org.hisp.dhis.tracker.bundle.TrackerBundle;
import org.hisp.dhis.tracker.bundle.TrackerBundleMode;
import org.hisp.dhis.tracker.bundle.TrackerBundleParams;
import org.hisp.dhis.tracker.bundle.TrackerBundleService;
import org.hisp.dhis.tracker.report.TrackerBundleReport;
import org.hisp.dhis.tracker.report.TrackerImportReport;
import org.hisp.dhis.tracker.report.TrackerStatus;
import org.hisp.dhis.tracker.report.TrackerValidationReport;
import org.hisp.dhis.tracker.validation.TrackerValidationService;
import org.hisp.dhis.user.CurrentUserService;
import org.hisp.dhis.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;

/**
 * @author Morten Olav Hansen <mortenoh@gmail.com>
 */
@Slf4j
@Service
public class DefaultTrackerImportService
    implements TrackerImportService
{
    private final TrackerBundleService trackerBundleService;

    private final TrackerValidationService trackerValidationService;

    private final CurrentUserService currentUserService;

    private final IdentifiableObjectManager manager;

    private final Notifier notifier;

    public DefaultTrackerImportService(
        TrackerBundleService trackerBundleService,
        TrackerValidationService trackerValidationService,
        CurrentUserService currentUserService,
        IdentifiableObjectManager manager,
        Notifier notifier )
    {
        this.trackerBundleService = trackerBundleService;
        this.trackerValidationService = trackerValidationService;
        this.currentUserService = currentUserService;
        this.manager = manager;
        this.notifier = notifier;
    }

    @Override
    @Transactional
    public TrackerImportReport importTracker( TrackerImportParams params )
    {
        params.setUser( getUser( params.getUser(), params.getUserId() ) );

        Timer timer = new SystemTimer().start();
        String message = "(" + params.getUsername() + ") Import:Start";
        log.info( message );

        if ( params.hasJobConfiguration() )
        {
            notifier.notify( params.getJobConfiguration(), message );
        }

        TrackerImportReport importReport = new TrackerImportReport();

        TrackerBundleParams bundleParams = params.toTrackerBundleParams();
        List<TrackerBundle> trackerBundles = trackerBundleService.create( bundleParams );

        Timer validationTimer = new SystemTimer().start();

        TrackerValidationReport validationReport = new TrackerValidationReport();
        trackerBundles.forEach( tb -> validationReport.add( trackerValidationService.validate( tb ) ) );

        message = "(" + params.getUsername() + ") Import:Validation took " + validationTimer.toString();
        log.info( message );

        if ( params.hasJobConfiguration() )
        {
            notifier.update( params.getJobConfiguration(), message );
        }

        if ( !(!validationReport.isEmpty() && AtomicMode.ALL == params.getAtomicMode()) )
        {
            Timer commitTimer = new SystemTimer().start();

            trackerBundles.forEach( tb -> {
                TrackerBundleReport bundleReport = trackerBundleService.commit( tb );
                importReport.getBundleReports().add( bundleReport );
            } );

            if ( !importReport.isEmpty() )
            {
                importReport.setStatus( TrackerStatus.WARNING );
            }

            message = "(" + params.getUsername() + ") Import:Commit took " + commitTimer.toString();
            log.info( message );

            if ( params.hasJobConfiguration() )
            {
                notifier.update( params.getJobConfiguration(), message );
            }
        }
        else
        {
            importReport.setStatus( TrackerStatus.ERROR );
        }

        message = "(" + params.getUsername() + ") Import:Done took " + timer.toString();
        log.info( message );

        TrackerBundleReportModeUtils.filter( importReport, params.getReportMode() );

        if ( params.hasJobConfiguration() )
        {
            notifier.update( params.getJobConfiguration(), message, true );
            notifier.addJobSummary( params.getJobConfiguration(), importReport, TrackerImportReport.class );
        }

        return importReport;
    }

    @Override
    public TrackerImportParams getParamsFromMap( Map<String, List<String>> parameters )
    {
        TrackerImportParams params = new TrackerImportParams();

        params.setUser( getUser( params.getUser(), params.getUserId() ) );
        params.setValidationMode( getEnumWithDefault( ValidationMode.class, parameters, "validationMode",
            ValidationMode.FULL ) );
        params.setImportMode( getEnumWithDefault( TrackerBundleMode.class, parameters, "importMode", TrackerBundleMode.COMMIT ) );
        params.setIdentifiers( getTrackerIdentifiers( parameters ) );
        params.setImportStrategy( getEnumWithDefault( TrackerImportStrategy.class, parameters, "importStrategy",
            TrackerImportStrategy.CREATE_AND_UPDATE ) );
        params.setAtomicMode( getEnumWithDefault( AtomicMode.class, parameters, "atomicMode", AtomicMode.ALL ) );
        params.setFlushMode( getEnumWithDefault( FlushMode.class, parameters, "flushMode", FlushMode.AUTO ) );

        return params;
    }

    //-----------------------------------------------------------------------------------
    // Utility Methods
    //-----------------------------------------------------------------------------------

    private TrackerIdentifierParams getTrackerIdentifiers( Map<String, List<String>> parameters )
    {
        TrackerIdScheme idScheme = getEnumWithDefault( TrackerIdScheme.class, parameters, "idScheme", TrackerIdScheme.UID );
        TrackerIdScheme orgUnitIdScheme  = getEnumWithDefault( TrackerIdScheme.class, parameters, "orgUnitIdScheme", idScheme );
        TrackerIdScheme programIdScheme  = getEnumWithDefault( TrackerIdScheme.class, parameters, "programIdScheme", idScheme );
        TrackerIdScheme programStageIdScheme  = getEnumWithDefault( TrackerIdScheme.class, parameters, "programStageIdScheme", idScheme );
        TrackerIdScheme dataElementIdScheme  = getEnumWithDefault( TrackerIdScheme.class, parameters, "dataElementIdScheme", idScheme );

        return TrackerIdentifierParams.builder()
            .idScheme( TrackerIdentifier.builder().idScheme( idScheme ).value( getAttributeUidOrNull( parameters, "idScheme" ) ).build() )
            .orgUnitIdScheme( TrackerIdentifier.builder().idScheme( orgUnitIdScheme ).value( getAttributeUidOrNull( parameters, "orgUnitIdScheme" ) ).build() )
            .programIdScheme( TrackerIdentifier.builder().idScheme( programIdScheme ).value( getAttributeUidOrNull( parameters, "programIdScheme" ) ).build() )
            .programStageIdScheme( TrackerIdentifier.builder().idScheme( programStageIdScheme ).value( getAttributeUidOrNull( parameters, "programStageIdScheme" ) ).build() )
            .dataElementIdScheme( TrackerIdentifier.builder().idScheme( dataElementIdScheme ).value( getAttributeUidOrNull( parameters, "dataElementIdScheme" ) ).build() )
            .build();
    }

    private <T extends Enum<T>> T getEnumWithDefault( Class<T> enumKlass, Map<String, List<String>> parameters, String key, T defaultValue )
    {
        if ( parameters == null || parameters.get( key ) == null || parameters.get( key ).isEmpty() )
        {
            return defaultValue;
        }

        if ( TrackerIdScheme.class.equals( enumKlass ) && IdScheme.isAttribute( parameters.get( key ).get( 0 ) ) )
        {
            return Enums.getIfPresent( enumKlass, "ATTRIBUTE" ).orNull();
        }

        String value = String.valueOf( parameters.get( key ).get( 0 ) );

        return Enums.getIfPresent( enumKlass, value ).or( defaultValue );
    }

    private String getAttributeUidOrNull(Map<String, List<String>> parameters, String key)
    {
        if ( parameters == null || parameters.get( key ) == null || parameters.get( key ).isEmpty() )
        {
            return null;
        }

        if ( IdScheme.isAttribute( parameters.get( key ).get( 0 ) ) )
        {
            String uid = "";

            // Get second half of string, separated by ':'
            String[] splitParam = parameters.get( key ).get( 0 ).split( ":" );

            if ( splitParam.length > 1 )
            {
                uid = splitParam[1];
            }

            if ( CodeGenerator.isValidUid( uid ) )
            {
                return uid;
            }
        }

        return null;
    }

    private User getUser( User user, String userUid )
    {
        if ( user != null ) // ıf user already set, reload the user to make sure its loaded in the current tx
        {
            return manager.get( User.class, user.getUid() );
        }

        if ( !StringUtils.isEmpty( userUid ) )
        {
            user = manager.get( User.class, userUid );
        }

        if ( user == null )
        {
            user = currentUserService.getCurrentUser();
        }

        return user;
    }
}
