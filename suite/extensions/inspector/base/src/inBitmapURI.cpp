/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.0 (the "NPL"); you may not use this file except in
 * compliance with the NPL.  You may obtain a copy of the NPL at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the NPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the NPL
 * for the specific language governing rights and limitations under the
 * NPL.
 *
 * The Initial Developer of this code under the NPL is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation.  All Rights
 * Reserved.
 *
 * Contributors:
 *  Joe Hewitt <hewitt@netscape.com>
 */

#include "inBitmapURI.h"
#include "nsNetUtil.h"
#include "nsIIOService.h"
#include "nsIURL.h"
#include "nsCRT.h"
#include "nsReadableUtils.h"

static NS_DEFINE_CID(kIOServiceCID,     NS_IOSERVICE_CID);
#define DEFAULT_IMAGE_SIZE          16

////////////////////////////////////////////////////////////////////////////////
 
NS_IMPL_THREADSAFE_ISUPPORTS2(inBitmapURI, inIBitmapURI, nsIURI)

#define NS_BITMAP_SCHEME           "moz-bitmap:"
#define NS_BITMAP_DELIMITER        '?'

inBitmapURI::inBitmapURI()
{
  NS_INIT_REFCNT();
}
 
inBitmapURI::~inBitmapURI()
{
}

////////////////////////////////////////////////////////////////////////////////
// inIBitmapURI

NS_IMETHODIMP
inBitmapURI::GetBitmapName(PRUnichar** aBitmapName)
{
  *aBitmapName = ToNewUnicode(mBitmapName);
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////

nsresult
inBitmapURI::FormatSpec(char* *result)
{
  *result = ToNewCString(NS_LITERAL_CSTRING(NS_BITMAP_SCHEME "//") +
                         mBitmapName);
  return *result ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

////////////////////////////////////////////////////////////////////////////////
// nsIURI

NS_IMETHODIMP
inBitmapURI::GetSpec(char* *aSpec)
{
  return FormatSpec(aSpec);
}

NS_IMETHODIMP
inBitmapURI::SetSpec(const char* aSpec)
{
  nsresult rv;
  nsCOMPtr<nsIIOService> ioService (do_GetService(kIOServiceCID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 startPos, endPos;
  rv = ioService->ExtractScheme(aSpec, &startPos, &endPos, nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  if (nsCRT::strncmp("moz-bitmap", &aSpec[startPos], endPos - startPos - 1) != 0)
    return NS_ERROR_MALFORMED_URI;

  nsCAutoString path(aSpec);
  PRInt32 pos = path.FindChar(NS_BITMAP_DELIMITER);

  if (pos == -1) // additional parameters
  {
    path.Right(mBitmapName, path.Length() - endPos);
  }
  else
  {
    path.Mid(mBitmapName, endPos, pos - endPos);
    // TODO: parse out other parameters
  }

  return NS_OK;
}

NS_IMETHODIMP
inBitmapURI::GetPrePath(char** prePath)
{
  *prePath = nsCRT::strdup(NS_BITMAP_SCHEME);
  return *prePath ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP
inBitmapURI::SetPrePath(const char* prePath)
{
  NS_NOTREACHED("inBitmapURI::SetPrePath");
  return NS_ERROR_NOT_IMPLEMENTED; 
}

NS_IMETHODIMP
inBitmapURI::GetScheme(char * *aScheme)
{
  *aScheme = nsCRT::strdup("moz-bitmap");
  return *aScheme ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP
inBitmapURI::SetScheme(const char * aScheme)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::GetUsername(char * *aUsername)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::SetUsername(const char * aUsername)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::GetPassword(char * *aPassword)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::SetPassword(const char * aPassword)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::GetPreHost(char * *aPreHost)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::SetPreHost(const char * aPreHost)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::GetHost(char * *aHost)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::SetHost(const char * aHost)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::GetPort(PRInt32 *aPort)
{
  return NS_ERROR_FAILURE;
}
 
NS_IMETHODIMP
inBitmapURI::SetPort(PRInt32 aPort)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::GetPath(char * *aPath)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::SetPath(const char * aPath)
{
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
inBitmapURI::Equals(nsIURI *other, PRBool *result)
{
  nsXPIDLCString spec1;
  nsXPIDLCString spec2;

  other->GetSpec(getter_Copies(spec2));
  GetSpec(getter_Copies(spec1));
  if (!nsCRT::strcasecmp(spec1, spec2))
    *result = PR_TRUE;
  else
    *result = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
inBitmapURI::SchemeIs(const char *i_Scheme, PRBool *o_Equals)
{
  NS_ENSURE_ARG_POINTER(o_Equals);
  if (!i_Scheme) return NS_ERROR_INVALID_ARG;
  
  *o_Equals = PL_strcasecmp("moz-bitmap", i_Scheme) ? PR_FALSE : PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
inBitmapURI::Clone(nsIURI **result)
{
  return NS_OK;
}

NS_IMETHODIMP
inBitmapURI::Resolve(const char *relativePath, char **result)
{
  return NS_OK;
}

