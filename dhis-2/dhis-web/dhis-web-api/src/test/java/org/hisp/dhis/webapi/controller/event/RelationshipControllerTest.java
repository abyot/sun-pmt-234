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

package org.hisp.dhis.webapi.controller.event;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.google.common.collect.Sets;
import org.hisp.dhis.cache.HibernateCacheManager;
import org.hisp.dhis.common.IdentifiableObjectManager;
import org.hisp.dhis.dashboard.DashboardItemType;
import org.hisp.dhis.dashboard.DashboardService;
import org.hisp.dhis.dxf2.events.relationship.RelationshipService;
import org.hisp.dhis.dxf2.events.trackedentity.Relationship;
import org.hisp.dhis.dxf2.importsummary.ImportStatus;
import org.hisp.dhis.dxf2.importsummary.ImportSummary;
import org.hisp.dhis.dxf2.metadata.MetadataExportService;
import org.hisp.dhis.dxf2.metadata.MetadataImportService;
import org.hisp.dhis.dxf2.metadata.collection.CollectionService;
import org.hisp.dhis.dxf2.webmessage.WebMessageException;
import org.hisp.dhis.fieldfilter.FieldFilterService;
import org.hisp.dhis.patch.PatchService;
import org.hisp.dhis.program.ProgramInstance;
import org.hisp.dhis.program.ProgramInstanceService;
import org.hisp.dhis.program.ProgramStageInstance;
import org.hisp.dhis.program.ProgramStageInstanceService;
import org.hisp.dhis.query.QueryService;
import org.hisp.dhis.render.RenderService;
import org.hisp.dhis.schema.MergeService;
import org.hisp.dhis.schema.SchemaService;
import org.hisp.dhis.security.acl.AclService;
import org.hisp.dhis.trackedentity.TrackedEntityInstance;
import org.hisp.dhis.trackedentity.TrackedEntityInstanceService;
import org.hisp.dhis.user.CurrentUserService;
import org.hisp.dhis.user.UserSettingService;
import org.hisp.dhis.webapi.service.ContextService;
import org.hisp.dhis.webapi.service.LinkService;
import org.hisp.dhis.webapi.service.WebMessageService;
import org.junit.Before;
import org.junit.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.util.NestedServletException;

/**
 * @author Enrico Colasante
 */
public class RelationshipControllerTest
{

    private MockMvc mockMvc;

    private static final String TEI_ID = "TEI_ID";
    private static final String EVENT_ID = "EVENT_ID";
    private static final String ENROLLMENT_ID = "ENROLLMENT_ID";
    private static final String REL_ID = "REL_ID";

    private TrackedEntityInstance tei = new TrackedEntityInstance();

    private ProgramInstance enrollment = new ProgramInstance();

    private ProgramStageInstance event = new ProgramStageInstance();

    private Relationship relationship = new Relationship();

    @Mock
    private RelationshipService relationshipService;

    @Mock
    private TrackedEntityInstanceService trackedEntityInstanceService;

    @Mock
    private ProgramInstanceService programInstanceService;

    @Mock
    private ProgramStageInstanceService programStageInstanceService;

    private WebMessageService webMessageService = new WebMessageService();

    @InjectMocks
    private RelationshipController relationshipController;

    private final static String ENDPOINT = "/relationships";

    @Before
    public void setUp()
    {
        MockitoAnnotations.initMocks( this );
        mockMvc = MockMvcBuilders.standaloneSetup( relationshipController ).build();
    }

    @Test(expected = NestedServletException.class )
    public void verifyEndpointWithNoArgs()
        throws Exception
    {
        mockMvc.perform( get( ENDPOINT ) );
    }

    @Test(expected = NestedServletException.class )
    public void verifyEndpointWithNotFoundTei()
        throws Exception
    {
        mockMvc.perform( get( ENDPOINT ).param( "tei", TEI_ID ) );
    }

    @Test
    public void verifyEndpointWithTei()
        throws Exception
    {
        when( trackedEntityInstanceService.getTrackedEntityInstance( TEI_ID )).thenReturn( tei );
        mockMvc.perform( get( ENDPOINT ).param( "tei", TEI_ID ) ).andExpect( status().isOk() );

        verify( trackedEntityInstanceService ).getTrackedEntityInstance( TEI_ID );
        verify( relationshipService ).getRelationshipsByTrackedEntityInstance(tei, false);
    }

    @Test(expected = NestedServletException.class )
    public void verifyEndpointWithNotFoundEvent()
        throws Exception
    {
        mockMvc.perform( get( ENDPOINT ).param( "event", EVENT_ID ) );
    }

    @Test
    public void verifyEndpointWithEvent()
        throws Exception
    {
        when( programStageInstanceService.getProgramStageInstance( EVENT_ID )).thenReturn( event );
        mockMvc.perform( get( ENDPOINT ).param( "event", EVENT_ID ) ).andExpect( status().isOk() );

        verify( programStageInstanceService ).getProgramStageInstance( EVENT_ID );
        verify( relationshipService ).getRelationshipsByProgramStageInstance(event, false);
    }

    @Test(expected = NestedServletException.class )
    public void verifyEndpointWithNotFoundEnrollment()
        throws Exception
    {
        mockMvc.perform( get( ENDPOINT ).param( "enrollment", ENROLLMENT_ID ) ).andExpect( status().isBadRequest() );
    }

    @Test
    public void verifyEndpointWithEnrollment()
        throws Exception
    {
        when( programInstanceService.getProgramInstance( ENROLLMENT_ID )).thenReturn( enrollment );
        mockMvc.perform( get( ENDPOINT ).param( "enrollment", ENROLLMENT_ID ) ).andExpect( status().isOk() );

        verify( programInstanceService ).getProgramInstance( ENROLLMENT_ID );
        verify( relationshipService ).getRelationshipsByProgramInstance(enrollment, false);
    }

    @Test(expected = NestedServletException.class )
    public void testGetRelationshipNotPresent()
        throws Exception
    {
        mockMvc.perform( get( ENDPOINT + "/" + REL_ID ));
    }

    @Test
    public void testGetRelationship()
        throws Exception
    {
        when( relationshipService.getRelationshipByUid( REL_ID ) ).thenReturn( relationship );
        mockMvc.perform( get( ENDPOINT + "/" + REL_ID )).andExpect( status().isOk() );
    }

    @Test( expected = NestedServletException.class )
    public void testDeleteRelationshipNotPresent()
        throws Exception
    {
        mockMvc.perform( delete( ENDPOINT + "/" + REL_ID )).andExpect( status().isConflict() );
    }

    @Test
    public void testDeleteRelationship()
        throws Exception
    {
        when( relationshipService.getRelationshipByUid( REL_ID ) ).thenReturn( relationship );
        mockMvc.perform( get( ENDPOINT + "/" + REL_ID )).andExpect( status().isOk() );
    }
}