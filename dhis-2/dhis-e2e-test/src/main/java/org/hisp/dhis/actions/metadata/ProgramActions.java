/*
 * Copyright (c) 2004-2018, University of Oslo
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

/*
 * Copyright (c) 2004-2018, University of Oslo
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

package org.hisp.dhis.actions.metadata;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.hamcrest.Matchers;
import org.hisp.dhis.actions.RestApiActions;
import org.hisp.dhis.dto.ApiResponse;
import org.hisp.dhis.utils.DataGenerator;

/**
 * @author Gintare Vilkelyte <vilkelyte.gintare@gmail.com>
 */
public class ProgramActions
    extends RestApiActions
{
    public RestApiActions programStageActions;

    public ProgramActions()
    {
        super( "/programs" );
        this.programStageActions = new RestApiActions( "/programStages" );
    }

    public ApiResponse createProgram( String programType )
    {
        JsonObject object = getDummy( programType );

        return post( object );
    }

    public ApiResponse createTrackerProgram( String... orgUnitIds )
    {
        return createProgram( "WITH_REGISTRATION", orgUnitIds );

    }

    public ApiResponse createEventProgram( String... orgUnitsIds )
    {
        return createProgram( "WITHOUT_REGISTRATION", orgUnitsIds );
    }

    public ApiResponse createProgram( String programType, String... orgUnitIds )
    {
        JsonObject object = getDummy( programType );
        JsonArray orgUnits = new JsonArray();

        for ( String ouid : orgUnitIds
        )
        {
            JsonObject orgUnit = new JsonObject();
            orgUnit.addProperty( "id", ouid );

            orgUnits.add( orgUnit );
        }

        object.add( "organisationUnits", orgUnits );

        return post( object );
    }

    public ApiResponse addProgramStage( String programId, String programStageId )
    {
        JsonObject body = get( programId ).getBody();
        JsonArray programStages = new JsonArray();
        JsonObject programStage = new JsonObject();

        programStage.addProperty( "id", programStageId );

        programStages.add( programStage );

        body.add( "programStages", programStages );

        return update( programId, body );
    }

    public String createProgramStage( String name )
    {
        JsonObject body = new JsonObject();

        body.addProperty( "name", name );

        ApiResponse response = programStageActions.post( body );
        response.validate().statusCode( Matchers.isOneOf( 201, 200 ) );

        return response.extractUid();
    }

    public JsonObject getDummy()
    {
        String random = DataGenerator.randomString();

        JsonObject object = new JsonObject();
        object.addProperty( "name", "AutoTest program " + random );
        object.addProperty( "shortName", "AutoTest program " + random );

        return object;
    }

    public JsonObject getDummy( String programType )
    {

        JsonObject program = getDummy();
        program.addProperty( "programType", programType );

        return program;
    }

}
