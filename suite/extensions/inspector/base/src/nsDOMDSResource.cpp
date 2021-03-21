/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 * 
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 * 
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 * 
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation. Portions created by Netscape are
 * Copyright (C) 1998-1999 Netscape Communications Corporation. All
 * Rights Reserved.
 */

#include "nsDOMDSResource.h"

nsDOMDSResource::nsDOMDSResource()
{
}

nsDOMDSResource::~nsDOMDSResource()
{
}

NS_IMPL_ISUPPORTS_INHERITED(nsDOMDSResource, nsRDFResource, nsIDOMDSResource)

NS_IMETHODIMP
nsDOMDSResource::SetObject(nsISupports* object)
{
  mObject = do_QueryInterface(object);
  return NS_OK;
}

NS_IMETHODIMP
nsDOMDSResource::GetObject(nsISupports** object)
{
  if (!object) return NS_ERROR_NULL_POINTER;

  *object = mObject;
  NS_IF_ADDREF(*object);
  
  return NS_OK;
}
  
NS_METHOD
nsDOMDSResource::Create(nsISupports* aOuter, const nsIID& iid, void **result) 
{
  nsDOMDSResource* ve = new nsDOMDSResource();
  if (!ve) return NS_ERROR_NULL_POINTER;
  NS_ADDREF(ve);
  nsresult rv = ve->QueryInterface(iid, result);
  NS_RELEASE(ve);
  return rv;
}

