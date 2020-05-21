package org.hisp.dhis.webapi.controller.sms;

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

import org.hisp.dhis.common.DhisApiVersion;
import org.hisp.dhis.common.IdentifiableObjectStore;
import org.hisp.dhis.dxf2.webmessage.WebMessageException;
import org.hisp.dhis.dxf2.webmessage.WebMessageUtils;
import org.hisp.dhis.message.MessageSender;
import org.hisp.dhis.outboundmessage.OutboundMessageResponse;
import org.hisp.dhis.program.message.ProgramMessage;
import org.hisp.dhis.program.message.ProgramMessageQueryParams;
import org.hisp.dhis.program.message.ProgramMessageService;
import org.hisp.dhis.program.notification.ProgramNotificationInstance;
import org.hisp.dhis.render.RenderService;
import org.hisp.dhis.sms.command.SMSCommand;
import org.hisp.dhis.sms.command.SMSCommandService;
import org.hisp.dhis.sms.incoming.IncomingSms;
import org.hisp.dhis.sms.incoming.IncomingSmsService;
import org.hisp.dhis.sms.outbound.OutboundSms;
import org.hisp.dhis.sms.parse.ParserType;
import org.hisp.dhis.system.util.SmsUtils;
import org.hisp.dhis.user.User;
import org.hisp.dhis.user.UserService;
import org.hisp.dhis.webapi.mvc.annotation.ApiVersion;
import org.hisp.dhis.webapi.service.WebMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Zubair <rajazubair.asghar@gmail.com>
 */
@RestController
@RequestMapping( value = "/sms" )
@ApiVersion( { DhisApiVersion.DEFAULT, DhisApiVersion.ALL } )
public class SmsController
{
    @Autowired
    @Qualifier( "smsMessageSender" )
    private MessageSender smsSender;

    @Autowired
    private WebMessageService webMessageService;

    @Autowired
    private IncomingSmsService incomingSMSService;

    @Autowired
    private RenderService renderService;

    @Autowired
    private SMSCommandService smsCommandService;

    @Autowired
    private UserService userService;

    @Autowired @Qualifier( "org.hisp.dhis.program.notification.ProgramNotificationInstanceStore" )
    private IdentifiableObjectStore<ProgramNotificationInstance> programNotificationInstanceStore;

    @Autowired
    private ProgramMessageService programMessageService;

    // -------------------------------------------------------------------------
    // GET
    // -------------------------------------------------------------------------

    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SENDSMS')" )
    @RequestMapping( value = "/scheduled", method = RequestMethod.GET )
    public void getScheduledMessage( @RequestParam( required = false ) Date scheduledAt, HttpServletResponse response ) throws IOException
    {
        List<ProgramNotificationInstance> instances = programNotificationInstanceStore.getAll();

        if ( scheduledAt != null )
        {
            instances = instances.parallelStream().filter( Objects::nonNull )
                .filter( i -> scheduledAt.equals( i.getScheduledAt() ) )
                .collect( Collectors.toList() );
        }

        renderService.toJson( response.getOutputStream(), instances );
    }

    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SENDSMS')" )
    @RequestMapping( value = "/scheduled/sent", method = RequestMethod.GET )
    public void getScheduledSentMessage(
        @RequestParam( required = false ) String programInstance,
        @RequestParam( required = false ) String programStageInstance,
        @RequestParam( required = false ) Date afterDate, @RequestParam( required = false ) Integer page,
        @RequestParam( required = false ) Integer pageSize,
        HttpServletResponse response ) throws IOException
    {
        ProgramMessageQueryParams params = programMessageService.getFromUrl( null, programInstance, programStageInstance,
            null, page, pageSize, afterDate, null );

        List<ProgramMessage> programMessages = programMessageService.getProgramMessages( params );

        renderService.toJson( response.getOutputStream(), programMessages );
    }


    // -------------------------------------------------------------------------
    // POST
    // -------------------------------------------------------------------------

    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SENDSMS')" )
    @RequestMapping( value = "/outbound", method = RequestMethod.POST )
    public void sendSMSMessage( @RequestParam String recipient, @RequestParam String message,
        HttpServletResponse response, HttpServletRequest request )
        throws WebMessageException
    {
        if ( recipient == null || recipient.length() <= 0 )
        {
            throw new WebMessageException( WebMessageUtils.conflict( "Recipient must be specified" ) );
        }

        if ( message == null || message.length() <= 0 )
        {
            throw new WebMessageException( WebMessageUtils.conflict( "Message must be specified" ) );
        }

        OutboundMessageResponse status = smsSender.sendMessage( null, message, recipient );

        if ( status.isOk() )
        {
            webMessageService.send( WebMessageUtils.ok( "SMS sent" ), response, request );
        }
        else
        {
            throw new WebMessageException( WebMessageUtils.error( status.getDescription() ) );
        }
    }

    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SENDSMS')" )
    @RequestMapping( value = "/outbound", method = RequestMethod.POST, consumes = "application/json" )
    public void sendSMSMessage( HttpServletResponse response, HttpServletRequest request )
        throws WebMessageException, IOException
    {
        OutboundSms sms = renderService.fromJson( request.getInputStream(), OutboundSms.class );

        OutboundMessageResponse status = smsSender.sendMessage( null, sms.getMessage(), sms.getRecipients() );

        if ( status.isOk() )
        {
            webMessageService.send( WebMessageUtils.ok( "SMS sent" ), response, request );
        }
        else
        {
            throw new WebMessageException( WebMessageUtils.error( status.getDescription() ) );
        }
    }

    @RequestMapping( value = "/inbound", method = RequestMethod.POST )
    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SETTINGS')" )
    public void receiveSMSMessage( @RequestParam String originator, @RequestParam( required = false ) Date receivedTime,
        @RequestParam String message, @RequestParam( defaultValue = "Unknown", required = false ) String gateway,
        HttpServletRequest request, HttpServletResponse response )
        throws WebMessageException
    {
        if ( originator == null || originator.length() <= 0 )
        {
            throw new WebMessageException( WebMessageUtils.conflict( "Originator must be specified" ) );
        }

        if ( message == null || message.length() <= 0 )
        {
            throw new WebMessageException( WebMessageUtils.conflict( "Message must be specified" ) );
        }

        int smsId = incomingSMSService.save( message, originator, gateway, receivedTime, getUserByPhoneNumber( originator, message ) );

        webMessageService.send( WebMessageUtils.ok( "Received SMS: " + smsId ), response, request );
    }

    @RequestMapping( value = "/inbound", method = RequestMethod.POST, consumes = "application/json" )
    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SETTINGS')" )
    public void receiveSMSMessage( HttpServletRequest request, HttpServletResponse response )
        throws WebMessageException, IOException
    {
        IncomingSms sms = renderService.fromJson( request.getInputStream(), IncomingSms.class );
        sms.setUser( getUserByPhoneNumber( sms.getOriginator(), sms.getText() ) );

        int smsId = incomingSMSService.save( sms );

        webMessageService.send( WebMessageUtils.ok( "Received SMS: " + smsId ), response, request );
    }

    @RequestMapping( value = "/import", method = RequestMethod.POST, consumes = "application/json" )
    @PreAuthorize( "hasRole('ALL') or hasRole('F_MOBILE_SETTINGS')" )
    public void importUnparsedSMSMessages( HttpServletRequest request, HttpServletResponse response )
    {
        List<IncomingSms> importMessageList = incomingSMSService.getAllUnparsedMessages();

        for ( IncomingSms sms : importMessageList )
        {
            incomingSMSService.update( sms );
        }

        webMessageService.send( WebMessageUtils.ok( "Import successful" ), response, request );
    }

    private User getUserByPhoneNumber( String phoneNumber, String text ) throws WebMessageException
    {
        SMSCommand unregisteredParser = smsCommandService.getSMSCommand( SmsUtils.getCommandString( text ), ParserType.UNREGISTERED_PARSER );

        List<User> users = userService.getUsersByPhoneNumber( phoneNumber );

        if ( users == null || users.isEmpty() )
        {
            if ( unregisteredParser != null )
            {
                return null;
            }

            throw new WebMessageException( WebMessageUtils.conflict( "User not registered in the system" ) );
        }

        return users.iterator().next();
    }
}
