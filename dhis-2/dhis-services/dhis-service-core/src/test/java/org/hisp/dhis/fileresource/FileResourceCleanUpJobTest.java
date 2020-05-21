package org.hisp.dhis.fileresource;

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

import static junit.framework.TestCase.*;

import java.util.Date;

import org.hisp.dhis.IntegrationTestBase;
import org.hisp.dhis.analytics.AggregationType;
import org.hisp.dhis.common.ValueType;
import org.hisp.dhis.dataelement.DataElement;
import org.hisp.dhis.dataelement.DataElementService;
import org.hisp.dhis.datavalue.DataValue;
import org.hisp.dhis.datavalue.DataValueAuditService;
import org.hisp.dhis.datavalue.DataValueService;
import org.hisp.dhis.organisationunit.OrganisationUnit;
import org.hisp.dhis.organisationunit.OrganisationUnitService;
import org.hisp.dhis.period.Period;
import org.hisp.dhis.period.PeriodService;
import org.hisp.dhis.period.PeriodType;
import org.hisp.dhis.setting.SettingKey;
import org.hisp.dhis.setting.SystemSettingManager;
import org.joda.time.DateTime;
import org.joda.time.Days;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * @author Kristian Wærstad
 */
public class FileResourceCleanUpJobTest
    extends IntegrationTestBase
{
    @Autowired
    private FileResourceCleanUpJob cleanUpJob;

    @Autowired
    private SystemSettingManager systemSettingManager;

    @Autowired
    private FileResourceService fileResourceService;

    @Autowired
    private DataValueAuditService dataValueAuditService;

    @Autowired
    private DataValueService dataValueService;

    @Autowired
    private DataElementService dataElementService;

    @Autowired
    private OrganisationUnitService organisationUnitService;

    @Autowired
    private PeriodService periodService;

    @Autowired
    private ExternalFileResourceService externalFileResourceService;

    public static Period PERIOD = createPeriod( PeriodType.getPeriodTypeByName( "Monthly" ), new Date(), new Date() );

    private DataValue dataValueA;

    private DataValue dataValueB;

    private byte[] content;

    @Before
    public void init()
    {
        periodService.addPeriod( PERIOD );
    }

    @Test
    public void testNoRetention()
    {
        systemSettingManager.saveSystemSetting( SettingKey.FILE_RESOURCE_RETENTION_STRATEGY, FileResourceRetentionStrategy.NONE );

        content = "filecontentA".getBytes();
        dataValueA = createFileResourceDataValue( 'A', content );
        assertNotNull( fileResourceService.getFileResource( dataValueA.getValue() ) );

        dataValueService.deleteDataValue( dataValueA );

        cleanUpJob.execute( null );

        assertNull( fileResourceService.getFileResource( dataValueA.getValue() ) );
    }

    @Test
    public void testRetention()
    {
        systemSettingManager.saveSystemSetting( SettingKey.FILE_RESOURCE_RETENTION_STRATEGY, FileResourceRetentionStrategy.THREE_MONTHS );

        content = "filecontentA".getBytes();
        dataValueA = createFileResourceDataValue( 'A', content );
        assertNotNull( fileResourceService.getFileResource( dataValueA.getValue() ) );

        content = "filecontentB".getBytes();
        dataValueB = createFileResourceDataValue( 'B', content );
        assertNotNull( fileResourceService.getFileResource( dataValueB.getValue() ) );

        content = "fileResourceC".getBytes();
        FileResource fileResource = createFileResource( 'C', content );
        dataValueB.setValue( fileResource.getUid() );
        dataValueService.updateDataValue( dataValueB );
        fileResource.setAssigned( true );

        dataValueAuditService.getDataValueAudits( dataValueB ).get( 0 )
            .setCreated( getDate( 2000, 1, 1 ) );


        cleanUpJob.execute( null );

        assertNotNull( fileResourceService.getFileResource( dataValueA.getValue() ) );
        assertTrue( fileResourceService.getFileResource( dataValueA.getValue() ).isAssigned() );
        assertNull( dataValueService.getDataValue( dataValueA.getDataElement(), dataValueA.getPeriod(), dataValueA.getSource(), null ) );
        assertNull( fileResourceService.getFileResource( dataValueB.getValue() ) );
    }

    @Test
    @Ignore
    public void testFalsePositive()
    {
        systemSettingManager.saveSystemSetting( SettingKey.FILE_RESOURCE_RETENTION_STRATEGY, FileResourceRetentionStrategy.THREE_MONTHS );

        content = "externalA".getBytes();
        ExternalFileResource ex = createExternal( 'A', content );

        String uid = ex.getFileResource().getUid();
        ex.getFileResource().setAssigned( false );
        fileResourceService.updateFileResource( ex.getFileResource() );

        cleanUpJob.execute( null );

        assertNotNull( externalFileResourceService.getExternalFileResourceByAccessToken( ex.getAccessToken() ) );
        assertNotNull( fileResourceService.getFileResource( uid ) );
        assertTrue( fileResourceService.getFileResource( uid ).isAssigned() );
    }

    @Test
    @Ignore
    public void testFailedUpload()
    {
        systemSettingManager.saveSystemSetting( SettingKey.FILE_RESOURCE_RETENTION_STRATEGY, FileResourceRetentionStrategy.THREE_MONTHS );

        content = "externalA".getBytes();
        ExternalFileResource ex = createExternal( 'A', content );

        String uid = ex.getFileResource().getUid();
        ex.getFileResource().setStorageStatus( FileResourceStorageStatus.PENDING );
        fileResourceService.updateFileResource( ex.getFileResource() );

        cleanUpJob.execute( null );

        assertNull( externalFileResourceService.getExternalFileResourceByAccessToken( ex.getAccessToken() ) );
        assertNull( fileResourceService.getFileResource( uid ) );
    }

    private DataValue createFileResourceDataValue( char uniqueChar, byte[] content )
    {
        DataElement fileElement = createDataElement( uniqueChar, ValueType.FILE_RESOURCE, AggregationType.NONE );
        OrganisationUnit orgUnit = createOrganisationUnit( uniqueChar );

        dataElementService.addDataElement( fileElement );
        organisationUnitService.addOrganisationUnit( orgUnit );

        FileResource fileResource = createFileResource( uniqueChar, content );
        String uid = fileResourceService.saveFileResource( fileResource, content );

        DataValue dataValue = createDataValue( fileElement, PERIOD, orgUnit, uid, null );
        fileResource.setAssigned( true );
        fileResource.setCreated( DateTime.now().minus( Days.ONE ).toDate() );
        fileResource.setStorageStatus( FileResourceStorageStatus.STORED );

        fileResourceService.updateFileResource( fileResource );
        dataValueService.addDataValue( dataValue );

        return dataValue;
    }

    private ExternalFileResource createExternal( char uniqueeChar, byte[] constant )
    {
        ExternalFileResource externalFileResource = createExternalFileResource( uniqueeChar, content );

        fileResourceService.saveFileResource( externalFileResource.getFileResource(), content );
        externalFileResourceService.saveExternalFileResource( externalFileResource );

        FileResource fileResource = externalFileResource.getFileResource();
        fileResource.setCreated( DateTime.now().minus( Days.ONE ).toDate() );
        fileResource.setStorageStatus( FileResourceStorageStatus.STORED );

        fileResourceService.updateFileResource( fileResource );
        return externalFileResource;
    }

    @Override public boolean emptyDatabaseAfterTest()
    {
        return true;
    }
}
