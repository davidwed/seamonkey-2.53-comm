/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbOSXDirectory_h___
#define nsAbOSXDirectory_h___

#include "mozilla/Attributes.h"
#include "nsISupports.h"
#include "nsAbBaseCID.h"
#include "nsAbDirProperty.h"
#include "nsIAbDirSearchListener.h"
#include "nsIMutableArray.h"
#include "nsInterfaceHashtable.h"
#include "nsAbOSXCard.h"

#include <CoreFoundation/CoreFoundation.h>
class nsIAbManager;
class nsIAbBooleanExpression;

#define NS_ABOSXDIRECTORY_URI_PREFIX NS_ABOSXDIRECTORY_PREFIX "://"

#define NS_IABOSXDIRECTORY_IID \
{ 0x87ee4bd9, 0x8552, 0x498f, \
  { 0x80, 0x85, 0x34, 0xf0, 0x2a, 0xbb, 0x56, 0x16 } }

class nsIAbOSXDirectory : public nsISupports
{
public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IABOSXDIRECTORY_IID)

  virtual nsresult AssertChildNodes() = 0;
  virtual nsresult Update() = 0;
  virtual nsresult AssertDirectory(nsIAbManager *aManager,
                                   nsIAbDirectory *aDirectory) = 0;
  virtual nsresult AssertCard(nsIAbManager *aManager,
                              nsIAbCard *aCard) = 0;
  virtual nsresult UnassertCard(nsIAbManager *aManager,
                                nsIAbCard *aCard,
                                nsIMutableArray *aCardList) = 0;
  virtual nsresult UnassertDirectory(nsIAbManager *aManager,
                                     nsIAbDirectory *aDirectory) = 0;
  virtual nsresult DeleteUid(const nsACString &aUid) = 0;
  virtual nsresult GetURI(nsACString &aURI) = 0;
  virtual nsresult Init(const char *aUri) = 0;
  virtual nsresult GetCardByUri(const nsACString &aUri, nsIAbOSXCard **aResult) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIAbOSXDirectory, NS_IABOSXDIRECTORY_IID)

class nsAbOSXDirectory final : public nsAbDirProperty,
public nsIAbDirSearchListener,
public nsIAbOSXDirectory
{
public:
  nsAbOSXDirectory();

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIABDIRSEARCHLISTENER

  // nsIAbOSXDirectory method
  NS_IMETHOD Init(const char *aUri) override;

  // nsAbDirProperty methods
  NS_IMETHOD GetReadOnly(bool *aReadOnly) override;
  NS_IMETHOD GetChildCards(nsISimpleEnumerator **aCards) override;
  NS_IMETHOD GetChildNodes(nsISimpleEnumerator **aNodes) override;
  NS_IMETHOD GetIsQuery(bool *aResult) override;
  NS_IMETHOD HasCard(nsIAbCard *aCard, bool *aHasCard) override;
  NS_IMETHOD HasDirectory(nsIAbDirectory *aDirectory, bool *aHasDirectory) override;
  NS_IMETHOD GetURI(nsACString &aURI) override;
  NS_IMETHOD GetCardFromProperty(const char *aProperty,
                                 const nsACString &aValue,
                                 bool caseSensitive,
                                 nsIAbCard **aResult) override;
  NS_IMETHOD GetCardsFromProperty(const char *aProperty,
                                  const nsACString &aValue,
                                  bool aCaseSensitive,
                                  nsISimpleEnumerator **aResult) override;
  NS_IMETHOD CardForEmailAddress(const nsACString &aEmailAddress,
                                 nsIAbCard **aResult) override;

  // nsIAbOSXDirectory
  nsresult AssertChildNodes() override;
  nsresult AssertDirectory(nsIAbManager *aManager,
                           nsIAbDirectory *aDirectory) override;
  nsresult AssertCard(nsIAbManager *aManager,
                      nsIAbCard *aCard) override;
  nsresult UnassertCard(nsIAbManager *aManager,
                        nsIAbCard *aCard,
                        nsIMutableArray *aCardList) override;
  nsresult UnassertDirectory(nsIAbManager *aManager,
                             nsIAbDirectory *aDirectory) override;

  nsresult Update() override;

  nsresult DeleteUid(const nsACString &aUid) override;

  nsresult GetCardByUri(const nsACString &aUri, nsIAbOSXCard **aResult) override;

  nsresult GetRootOSXDirectory(nsIAbOSXDirectory **aResult);

private:
  ~nsAbOSXDirectory();
  nsresult FallbackSearch(nsIAbBooleanExpression *aExpression,
                          nsISimpleEnumerator **aCards);

  // This is a list of nsIAbCards, kept separate from m_AddressList because:
  // - nsIAbDirectory items that are mailing lists, must keep a list of
  //   nsIAbCards in m_AddressList, however
  // - nsIAbDirectory items that are address books, must keep a list of
  //   nsIAbDirectory (i.e. mailing lists) in m_AddressList, AND no nsIAbCards.
  //
  // This wasn't too bad for mork, as that just gets a list from its database,
  // but because we store our own copy of the list, we must store a separate
  // list of nsIAbCards here. nsIMutableArray is used, because then it is
  // interchangeable with m_AddressList.
  nsCOMPtr<nsIMutableArray> mCardList;
  nsInterfaceHashtable<nsCStringHashKey, nsIAbOSXCard> mCardStore;
  nsCOMPtr<nsIAbOSXDirectory> mCacheTopLevelOSXAb;
};

#endif // nsAbOSXDirectory_h___
