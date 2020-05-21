package org.hisp.dhis.configuration;

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

import javax.servlet.ServletContext;
import javax.servlet.ServletException;

import lombok.extern.slf4j.Slf4j;
import org.hisp.dhis.external.conf.ConfigurationKey;
import org.hisp.dhis.external.conf.DefaultDhisConfigurationProvider;
import org.hisp.dhis.external.conf.DhisConfigurationProvider;
import org.hisp.dhis.external.location.DefaultLocationManager;
import org.springframework.web.WebApplicationInitializer;

/**
 * Configures cookies to be secure if the {@link ConfigurationKey#SERVER_HTTPS_ONLY} is enabled.
 *
 * @author Lars Helge Overland
 */
@Slf4j
public class SecureCookieConfiguration
    implements WebApplicationInitializer
{
    @Override
    public void onStartup( ServletContext context )
        throws ServletException
    {
        boolean httpsOnly = getConfig().isEnabled( ConfigurationKey.SERVER_HTTPS );

        log.debug( String.format( "Configuring cookies, HTTPS only: %b", httpsOnly ) );

        if ( httpsOnly )
        {
            context.getSessionCookieConfig().setSecure( true );
            context.getSessionCookieConfig().setHttpOnly( true );

            log.info( "HTTPS only is enabled, cookies configured as secure" );
        }
    }

    private DhisConfigurationProvider getConfig()
    {
        DefaultLocationManager locationManager = DefaultLocationManager.getDefault();
        locationManager.init();
        DefaultDhisConfigurationProvider configProvider = new DefaultDhisConfigurationProvider( locationManager );
        configProvider.init();

        return configProvider;
    }
}
