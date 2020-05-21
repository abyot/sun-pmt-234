package org.hisp.dhis.webapi.controller.datavalue;

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

import static org.hamcrest.Matchers.is;
import static org.hisp.dhis.common.ValueType.BOOLEAN;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.fail;
import static org.mockito.junit.MockitoJUnit.rule;

import org.hisp.dhis.calendar.CalendarService;
import org.hisp.dhis.category.CategoryService;
import org.hisp.dhis.common.IdentifiableObjectManager;
import org.hisp.dhis.dataelement.DataElement;
import org.hisp.dhis.dataset.DataSetService;
import org.hisp.dhis.datavalue.AggregateAccessManager;
import org.hisp.dhis.dxf2.utils.InputUtils;
import org.hisp.dhis.dxf2.webmessage.WebMessageException;
import org.hisp.dhis.fileresource.FileResourceService;
import org.hisp.dhis.i18n.I18nManager;
import org.hisp.dhis.organisationunit.OrganisationUnitService;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.junit.MockitoRule;

public class DataValidatorTest
{
    @Mock
    private CategoryService categoryService;

    @Mock
    private OrganisationUnitService organisationUnitService;

    @Mock
    private DataSetService dataSetService;

    @Mock
    private IdentifiableObjectManager idObjectManager;

    @Mock
    private InputUtils inputUtils;

    @Mock
    private FileResourceService fileResourceService;

    @Mock
    private I18nManager i18nManager;

    @Mock
    private CalendarService calendarService;

    @Mock
    private AggregateAccessManager accessManager;

    @Mock
    private DataValidator dataValidator;

    @Rule
    public MockitoRule mockitoRule = rule();

    @Before
    public void setUp()
    {
        dataValidator = new DataValidator( categoryService, organisationUnitService, dataSetService, idObjectManager,
            inputUtils, fileResourceService, i18nManager, calendarService, accessManager );
    }

    @Test
    public void validateBooleanDataValueWhenValuesAreAcceptableTrue()
        throws WebMessageException
    {
        // Given
        final DataElement aBooleanTypeDataElement = new DataElement();
        final String normalizedBooleanValue = "true";
        aBooleanTypeDataElement.setValueType( BOOLEAN );

        // Then
        String aBooleanDataValue = "true";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "1";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "t";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "True";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "TRUE";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );
    }

    @Test
    public void validateBooleanDataValueWhenValuesAreAcceptableFalse()
        throws WebMessageException
    {
        // Given
        final DataElement aBooleanTypeDataElement = new DataElement();
        final String normalizedBooleanValue = "false";
        aBooleanTypeDataElement.setValueType( BOOLEAN );

        // Then
        String aBooleanDataValue = "false";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "0";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "f";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "False";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );

        aBooleanDataValue = "FALSE";
        aBooleanDataValue = dataValidator.validateAndNormalizeDataValue( aBooleanDataValue, aBooleanTypeDataElement );
        assertThat( aBooleanDataValue, is( normalizedBooleanValue ) );
    }

    @Test( expected = WebMessageException.class )
    public void validateBooleanDataValueWhenValueIsNotValid()
        throws WebMessageException
    {
        // Given
        String anInvalidBooleanValue = "InvalidValue";
        final DataElement aBooleanTypeDataElement = new DataElement();
        aBooleanTypeDataElement.setValueType( BOOLEAN );

        // When
        dataValidator.validateAndNormalizeDataValue( anInvalidBooleanValue, aBooleanTypeDataElement );

        fail( "Should not reach here. It was expected WebMessageException." );
    }
}
