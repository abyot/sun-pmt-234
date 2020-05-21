package org.hisp.dhis.artemis.audit.listener;

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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ArrayUtils;
import org.hibernate.persister.entity.EntityPersister;
import org.hisp.dhis.artemis.audit.AuditManager;
import org.hisp.dhis.artemis.audit.legacy.AuditObjectFactory;
import org.hisp.dhis.artemis.config.UsernameSupplier;
import org.hisp.dhis.audit.AuditType;
import org.hisp.dhis.audit.Auditable;
import org.hisp.dhis.common.IdentifiableObject;
import org.hisp.dhis.commons.util.DebugUtils;
import org.hisp.dhis.system.util.AnnotationUtils;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static com.cronutils.utils.Preconditions.checkNotNull;

/**
 * @author Luciano Fiandesio
 */
@Slf4j
public abstract class AbstractHibernateListener
{
    protected final String[] AUDIT_IGNORE_PROPERTIES = { "userAccesses", "userGroupAccesses", "user", "lastUpdatedBy" };

    final AuditManager auditManager;
    final AuditObjectFactory objectFactory;
    private final UsernameSupplier usernameSupplier;

    private final ObjectMapper objectMapper;

    public AbstractHibernateListener(
        AuditManager auditManager,
        AuditObjectFactory objectFactory,
        UsernameSupplier usernameSupplier,
        ObjectMapper objectMapper )
    {
        checkNotNull( auditManager );
        checkNotNull( objectFactory );
        checkNotNull( usernameSupplier );
        checkNotNull( objectMapper );

        this.auditManager = auditManager;
        this.objectFactory = objectFactory;
        this.usernameSupplier = usernameSupplier;
        this.objectMapper = objectMapper;
    }

    Optional<Auditable> getAuditable( Object object, String type )
    {
        if ( AnnotationUtils.isAnnotationPresent( object.getClass(), Auditable.class ) )
        {
            Auditable auditable = AnnotationUtils.getAnnotation( object.getClass(), Auditable.class );

            boolean shouldAudit = Arrays.stream( auditable.eventType() )
                .anyMatch( s -> s.contains( "all" ) || s.contains( type ) );

            if ( shouldAudit )
            {
                return Optional.of( auditable );
            }
        }

        return Optional.empty();
    }

    public String getCreatedBy()
    {
        return usernameSupplier.get();
    }

    abstract AuditType getAuditType();
}
