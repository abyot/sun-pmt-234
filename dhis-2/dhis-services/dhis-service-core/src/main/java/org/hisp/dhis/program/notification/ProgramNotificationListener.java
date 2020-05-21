package org.hisp.dhis.program.notification;

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

import org.hisp.dhis.program.notification.event.ProgramEnrollmentCompletionNotificationEvent;
import org.hisp.dhis.program.notification.event.ProgramRuleEnrollmentEvent;
import org.hisp.dhis.program.notification.event.ProgramRuleStageEvent;
import org.hisp.dhis.program.notification.event.ProgramStageCompletionNotificationEvent;
import org.hisp.dhis.program.notification.event.ProgramEnrollmentNotificationEvent;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.stereotype.Component;

import static com.google.common.base.Preconditions.checkNotNull;

/**
 * Created by zubair@dhis2.org on 18.01.18.
 */
@Async
@Component( "org.hisp.dhis.program.notification.ProgramNotificationListener" )
public class ProgramNotificationListener
{
    private final ProgramNotificationService programNotificationService;

    public ProgramNotificationListener( ProgramNotificationService programNotificationService )
    {
        checkNotNull( programNotificationService );
        this.programNotificationService = programNotificationService;
    }

    @TransactionalEventListener
    public void onEnrollment( ProgramEnrollmentNotificationEvent event )
    {
        programNotificationService.sendEnrollmentNotifications( event.getProgramInstance() );
    }

    @TransactionalEventListener
    public void onCompletion( ProgramEnrollmentCompletionNotificationEvent event )
    {
        programNotificationService.sendEnrollmentCompletionNotifications( event.getProgramInstance() );
    }

    @TransactionalEventListener
    public void onEvent( ProgramStageCompletionNotificationEvent event )
    {
        programNotificationService.sendEventCompletionNotifications( event.getProgramStageInstance() );
    }

    // Published by rule engine
    @TransactionalEventListener
    public void onProgramRuleEnrollment( ProgramRuleEnrollmentEvent event )
    {
        programNotificationService.sendProgramRuleTriggeredNotifications( event.getTemplate(), event.getProgramInstance() );
    }

    @TransactionalEventListener
    public void onProgramRuleEvent( ProgramRuleStageEvent event )
    {
        programNotificationService.sendProgramRuleTriggeredEventNotifications( event.getTemplate(), event.getProgramStageInstance() );
    }
}
