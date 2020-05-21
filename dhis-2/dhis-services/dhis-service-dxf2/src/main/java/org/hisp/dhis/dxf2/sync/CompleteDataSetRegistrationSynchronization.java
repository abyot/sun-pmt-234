package org.hisp.dhis.dxf2.sync;
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

import lombok.extern.slf4j.Slf4j;
import org.hisp.dhis.dxf2.importsummary.ImportSummary;
import org.hisp.dhis.dxf2.synch.SynchronizationManager;
import org.hisp.dhis.setting.SettingKey;
import org.hisp.dhis.setting.SystemSettingManager;
import org.hisp.dhis.system.util.Clock;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Date;

import static com.google.common.base.Preconditions.checkNotNull;

/**
 * @author David Katuscak
 */
@Slf4j
@Component
public class CompleteDataSetRegistrationSynchronization
{
    private final SynchronizationManager synchronizationManager;

    private final SystemSettingManager systemSettingManager;

    private final RestTemplate restTemplate;

    public CompleteDataSetRegistrationSynchronization( SynchronizationManager synchronizationManager,
        SystemSettingManager systemSettingManager, RestTemplate restTemplate )
    {
        checkNotNull( synchronizationManager );
        checkNotNull( systemSettingManager );
        checkNotNull( restTemplate );

        this.synchronizationManager = synchronizationManager;
        this.systemSettingManager = systemSettingManager;
        this.restTemplate = restTemplate;
    }

    public SynchronizationResult syncCompleteDataSetRegistrationData()
    {
        if ( !SyncUtils.testServerAvailability( systemSettingManager, restTemplate ).isAvailable() )
        {
            return SynchronizationResult.newFailureResultWithMessage(
                "Complete data set registration synchronization failed. Remote " +
                    "server is unavailable." );
        }
        final Clock clock = new Clock( log ).startClock()
            .logTime( "Starting Complete data set registration synchronization job." );

        // ---------------------------------------------------------------------
        // Set time for last success to start of process to make data saved
        // subsequently part of next synch process without being ignored
        // ---------------------------------------------------------------------
        ImportSummary importSummary;
        try
        {
            importSummary = synchronizationManager.executeCompleteDataSetRegistrationPush();
            if ( SyncUtils
                .checkSummaryStatus( importSummary, SyncEndpoint.COMPLETE_DATA_SET_REGISTRATIONS ) )
            {
                String resultMsg = "Complete data set registration synchronization job is done. It took ";
                clock.logTime( "SUCCESS! " + resultMsg );
                SyncUtils.setLastSyncSuccess( systemSettingManager,
                    SettingKey.LAST_SUCCESSFUL_COMPLETE_DATA_SET_REGISTRATION_SYNC,
                    new Date( clock.getStartTime() ) );
                return SynchronizationResult
                    .newSuccessResultWithMessage( resultMsg + clock.getTime() + " ms." );
            }

        }
        catch ( Exception ex )
        {
            log.error(
                "Exception happened while trying complete data set registration push " + ex.getMessage(),
                ex );
        }
        return SynchronizationResult
            .newFailureResultWithMessage( "Complete data set registration synchronization failed." );
    }
}
