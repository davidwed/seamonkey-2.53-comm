/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsUnicharUtils.h"
#include "nsCharsetAlias.h"
#include "nsICategoryManager.h"
#include "nsICharsetConverterManager.h"
#include "nsIStringBundle.h"
#include "nsTArray.h"
#include "nsStringEnumerator.h"
#include "mozilla/Services.h"

#include "nsComponentManagerUtils.h"
#include "nsISupportsPrimitives.h"
#include "nsServiceManagerUtils.h"
#include "../base/util/nsMsgI18N.h"

// just for CONTRACTIDs
#include "nsCharsetConverterManager.h"

static nsIStringBundle * sDataBundle;
static nsIStringBundle * sTitleBundle;

// Class nsCharsetConverterManager [implementation]

NS_IMPL_ISUPPORTS(nsCharsetConverterManager, nsICharsetConverterManager)

nsCharsetConverterManager::nsCharsetConverterManager() 
{
}

nsCharsetConverterManager::~nsCharsetConverterManager() 
{
}

//static
void nsCharsetConverterManager::Shutdown()
{
  NS_IF_RELEASE(sDataBundle);
  NS_IF_RELEASE(sTitleBundle);
}

static
nsresult LoadExtensibleBundle(const char* aCategory, 
                              nsIStringBundle ** aResult)
{
  nsCOMPtr<nsIStringBundleService> sbServ =
    mozilla::services::GetStringBundleService();
  if (!sbServ)
    return NS_ERROR_FAILURE;

  return sbServ->CreateExtensibleBundle(aCategory, aResult);
}

static
nsresult GetBundleValue(nsIStringBundle * aBundle,
                        const char * aName,
                        const nsString& aProp,
                        char16_t ** aResult)
{
  nsAutoString key;

  CopyASCIItoUTF16(aName, key);
  ToLowerCase(key); // we lowercase the main comparison key
  key.Append(aProp);

  return aBundle->GetStringFromName(NS_ConvertUTF16toUTF8(key).get(), aResult);
}

static
nsresult GetBundleValue(nsIStringBundle * aBundle,
                        const char * aName,
                        const nsString& aProp,
                        nsAString& aResult)
{
  nsresult rv = NS_OK;

  nsXPIDLString value;
  rv = GetBundleValue(aBundle, aName, aProp, getter_Copies(value));
  if (NS_FAILED(rv))
    return rv;

  aResult = value;

  return NS_OK;
}

static
nsresult GetCharsetDataImpl(const char * aCharset, const char16_t * aProp,
                            nsAString& aResult)
{
  NS_ENSURE_ARG_POINTER(aCharset);
  // aProp can be nullptr

  if (!sDataBundle) {
    nsresult rv = LoadExtensibleBundle(NS_DATA_BUNDLE_CATEGORY, &sDataBundle);
    if (NS_FAILED(rv))
      return rv;
  }

  return GetBundleValue(sDataBundle, aCharset, nsDependentString(aProp), aResult);
}

//static
bool nsCharsetConverterManager::IsInternal(const nsACString& aCharset)
{
  nsAutoString str;
  // fully qualify to possibly avoid vtable call
  nsresult rv = GetCharsetDataImpl(PromiseFlatCString(aCharset).get(),
                                   u".isInternal",
                                   str);

  return NS_SUCCEEDED(rv);
}

//----------------------------------------------------------------------------//----------------------------------------------------------------------------
// Interface nsICharsetConverterManager [implementation]


// XXX Improve the implementation of this method. Right now, it is build on 
// top of the nsCharsetAlias service. We can make the nsCharsetAlias
// better, with its own hash table (not the StringBundle anymore) and
// a nicer file format.
NS_IMETHODIMP
nsCharsetConverterManager::GetCharsetAlias(const char * aCharset, 
                                           nsACString& aResult)
{
  NS_ENSURE_ARG_POINTER(aCharset);

  // We try to obtain the preferred name for this charset from the charset 
  // aliases.
  nsresult rv;

  rv = nsCharsetAlias::GetPreferred(nsDependentCString(aCharset), aResult);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}


NS_IMETHODIMP
nsCharsetConverterManager::GetCharsetTitle(const char * aCharset, 
                                           nsAString& aResult)
{
  NS_ENSURE_ARG_POINTER(aCharset);

  if (!sTitleBundle) {
    nsresult rv = LoadExtensibleBundle(NS_TITLE_BUNDLE_CATEGORY, &sTitleBundle);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return GetBundleValue(sTitleBundle, aCharset, NS_LITERAL_STRING(".title"), aResult);
}

NS_IMETHODIMP
nsCharsetConverterManager::GetCharsetData(const char * aCharset, 
                                          const char16_t * aProp,
                                          nsAString& aResult)
{
  return GetCharsetDataImpl(aCharset, aProp, aResult);
}

NS_IMETHODIMP
nsCharsetConverterManager::GetCharsetLangGroup(const char * aCharset, 
                                               nsIAtom** aResult)
{
  // resolve the charset first
  nsAutoCString charset;

  nsresult rv = GetCharsetAlias(aCharset, charset);
  NS_ENSURE_SUCCESS(rv, rv);

  // fully qualify to possibly avoid vtable call
  return nsCharsetConverterManager::GetCharsetLangGroupRaw(charset.get(),
                                                           aResult);
}

NS_IMETHODIMP
nsCharsetConverterManager::GetCharsetLangGroupRaw(const char * aCharset, 
                                                  nsIAtom** aResult)
{

  *aResult = nullptr;
  nsAutoString langGroup;
  // fully qualify to possibly avoid vtable call
  nsresult rv = nsCharsetConverterManager::GetCharsetData(
      aCharset, u".LangGroup", langGroup);

  if (NS_SUCCEEDED(rv)) {
    ToLowerCase(langGroup); // use lowercase for all language atoms
    *aResult = NS_Atomize(langGroup).take();
  }

  return rv;
}

NS_IMETHODIMP
nsCharsetConverterManager::Mutf7ToUnicode(const char* aSrc, nsAString& aDest)
{
  return CopyMUTF7toUTF16(nsDependentCString(aSrc), aDest);
}

NS_IMETHODIMP
nsCharsetConverterManager::UnicodeToMutf7(const char16_t* aSrc, nsACString& aDest)
{
  return CopyUTF16toMUTF7(nsDependentString(aSrc), aDest);
}
