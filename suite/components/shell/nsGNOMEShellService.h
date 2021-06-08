/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsgnomeshellservice_h____
#define nsgnomeshellservice_h____

#include "nsIGNOMEShellService.h"
#include "nsString.h"
#include "mozilla/Attributes.h"
#include "nsSuiteCID.h"

struct ProtocolAssociation;

class nsGNOMEShellService final : public nsIGNOMEShellService
{
public:
  nsGNOMEShellService() {};

  NS_DECL_ISUPPORTS
  NS_DECL_NSISHELLSERVICE
  NS_DECL_NSIGNOMESHELLSERVICE

  nsresult Init();

private:
  ~nsGNOMEShellService() {}

  bool HandlerMatchesAppName(const char* aHandler);

  bool mUseLocaleFilenames;
  nsCString mAppPath;
  bool mAppIsInPath;
};

#endif // nsgnomeshellservice_h____

