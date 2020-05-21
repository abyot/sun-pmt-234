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

import javax.annotation.Nonnull;

import org.apache.commons.jexl2.JexlException;
import org.hisp.dhis.commons.util.DebugUtils;
import org.hisp.dhis.commons.util.ExpressionUtils;
import org.hisp.dhis.rules.RuleExpressionEvaluator;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Created by zubair@dhis2.org on 11.10.17.
 */
@Slf4j
@Component( "org.hisp.dhis.programrule.engine.ProgramRuleExpressionEvaluator" )
public class ProgramRuleExpressionEvaluator implements RuleExpressionEvaluator
{
    /**
     * Return string value of boolean output. False will be returned in case
     * of wrongly created expression
     *
     * @param expression to be evaluated.
     * @return string value of boolean true/false.
     */

    @Nonnull
    @Override
    public String evaluate( @Nonnull String expression )
    {
        String result;

        try
        {
            result = ExpressionUtils.evaluate( expression ).toString();
        }
        catch ( JexlException je )
        {
            result = "false";

            log.debug( DebugUtils.getStackTrace( je.getCause() ) );
        }

       return result;
    }
}
