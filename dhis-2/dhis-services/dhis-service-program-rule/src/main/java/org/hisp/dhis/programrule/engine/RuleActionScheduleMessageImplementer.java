package org.hisp.dhis.programrule.engine;

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

import org.hisp.dhis.common.IdentifiableObjectStore;
import org.hisp.dhis.notification.logging.ExternalNotificationLogEntry;
import org.hisp.dhis.notification.logging.NotificationLoggingService;
import org.hisp.dhis.notification.logging.NotificationTriggerEvent;
import org.hisp.dhis.program.ProgramInstance;
import org.hisp.dhis.program.ProgramInstanceService;
import org.hisp.dhis.program.ProgramStageInstance;
import org.hisp.dhis.program.ProgramStageInstanceService;
import org.hisp.dhis.program.notification.ProgramNotificationInstance;
import org.hisp.dhis.program.notification.ProgramNotificationTemplate;
import org.hisp.dhis.program.notification.ProgramNotificationTemplateStore;
import org.hisp.dhis.rules.models.RuleAction;
import org.hisp.dhis.rules.models.RuleActionScheduleMessage;
import org.hisp.dhis.rules.models.RuleEffect;
import org.hisp.dhis.util.DateUtils;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * @author Zubair Asghar.
 */
@Slf4j
@Component( "org.hisp.dhis.programrule.engine.RuleActionScheduleMessageImplementer" )
public class RuleActionScheduleMessageImplementer extends NotificationRuleActionImplementer
{
    // -------------------------------------------------------------------------
    // Dependencies
    // -------------------------------------------------------------------------

    private final IdentifiableObjectStore<ProgramNotificationInstance> programNotificationInstanceStore;

    public RuleActionScheduleMessageImplementer( ProgramNotificationTemplateStore programNotificationTemplateStore,
         NotificationLoggingService notificationLoggingService,
         ProgramInstanceService programInstanceService,
         ProgramStageInstanceService programStageInstanceService,
         @Qualifier( "org.hisp.dhis.program.notification.ProgramNotificationInstanceStore" )IdentifiableObjectStore<ProgramNotificationInstance> programNotificationInstanceStore )
    {
        super(programNotificationTemplateStore, notificationLoggingService, programInstanceService, programStageInstanceService);
        this.programNotificationInstanceStore = programNotificationInstanceStore;
    }

    @Override
    public boolean accept( RuleAction ruleAction )
    {
        return ruleAction instanceof RuleActionScheduleMessage;
    }

    @Override
    public void implement( RuleEffect ruleEffect, ProgramInstance programInstance )
    {
        if ( !validate( ruleEffect, programInstance ) )
        {
            return;
        }

        ProgramNotificationTemplate template = getNotificationTemplate( ruleEffect.ruleAction() );

        String key = generateKey( template, programInstance );

        String date = ruleEffect.data();

        if ( !isDateValid( date ) )
        {
            return;
        }

        ProgramNotificationInstance notificationInstance = createNotificationInstance( template, date );
        notificationInstance.setProgramStageInstance( null );
        notificationInstance.setProgramInstance( programInstance );

        programNotificationInstanceStore.save( notificationInstance );

        log.info( String.format( "Notification with id:%s has been scheduled", template.getUid() ) );

        ExternalNotificationLogEntry entry = createLogEntry( key, template.getUid() );
        entry.setNotificationTriggeredBy( NotificationTriggerEvent.PROGRAM );
        notificationLoggingService.save( entry );
    }

    @Override
    public void implement( RuleEffect ruleEffect, ProgramStageInstance programStageInstance )
    {
        if ( !validate( ruleEffect, programStageInstance.getProgramInstance() ) )
        {
            return;
        }

        ProgramNotificationTemplate template = getNotificationTemplate( ruleEffect.ruleAction() );

        String key = generateKey( template, programStageInstance.getProgramInstance() );

        String date = ruleEffect.data();

        if ( !isDateValid( date ) )
        {
            return;
        }

        ProgramNotificationInstance notificationInstance = createNotificationInstance( template, date );
        notificationInstance.setProgramStageInstance( programStageInstance );
        notificationInstance.setProgramInstance( null );

        programNotificationInstanceStore.save( notificationInstance );

        log.info( String.format( "Notification with id:%s has been scheduled", template.getUid() ) );

        ExternalNotificationLogEntry entry = createLogEntry( key, template.getUid() );
        entry.setNotificationTriggeredBy( NotificationTriggerEvent.PROGRAM_STAGE );
        notificationLoggingService.save( entry );

    }

    @Override
    public void implementEnrollmentAction( RuleEffect ruleEffect, String programInstance )
    {
        implement( ruleEffect, programInstanceService.getProgramInstance( programInstance ) );
    }

    @Override
    public void implementEventAction( RuleEffect ruleEffect, String programStageInstance )
    {
        implement( ruleEffect, programStageInstanceService.getProgramStageInstance( programStageInstance ) );
    }

    // -------------------------------------------------------------------------
    // Supportive Methods
    // -------------------------------------------------------------------------

    private boolean isDateValid( String date )
    {
        if ( !date.isEmpty() )
        {
            if ( DateUtils.dateIsValid( date ) )
            {
                return true;
            }
        }

        log.error( "Invalid date: " + date );
        return false;
    }
}
