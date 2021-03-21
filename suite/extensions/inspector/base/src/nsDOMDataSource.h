/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 */

#ifndef domdatasource___h___
#define domdatasource___h___

#define NS_DOMDSDATASOURCE_ID "Inspector_DOM"

#include "nsIInsDOMDataSource.h"
#include "nsDOMDSResource.h"

#include "nsCOMPtr.h"
#include "nsISupportsArray.h"
#include "nsHashtable.h"
#include "nsString.h"
#include "nsVoidArray.h"

#include "nsIContent.h"

#include "nsIDocument.h"
#include "nsIDOMDocument.h"
#include "nsIDOMNode.h"
#include "nsIDOMAttr.h"
#include "nsIDOMElement.h"
#include "nsIDOMNamedNodeMap.h"
#include "nsIDOMNodeList.h"

#include "nsIDocumentObserver.h"
#include "nsIDocument.h"
#include "nsIBindingManager.h"
#include "nsIXBLBinding.h"

#include "rdf.h"
#include "nsIRDFDataSource.h"
#include "nsIRDFContainer.h"
#include "nsIRDFContainerUtils.h"
#include "nsIRDFRemoteDataSource.h"
#include "nsIRDFLiteral.h"
#include "nsIRDFResource.h"
#include "nsIRDFNode.h"
#include "nsIRDFObserver.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"

#include "nsIComponentManager.h"
#include "nsIDOMWindowInternal.h"
#include "nsIScriptGlobalObject.h"
#include "nsIServiceManager.h"
#include "nsVoidArray.h"
#include "nsXPIDLString.h"
#include "nsEnumeratorUtils.h"
#include "nsIAtom.h"
#include "prprf.h"

class nsDOMDataSource : public nsIInsDOMDataSource,
                        public nsIRDFDataSource,
                        public nsIDocumentObserver
{
  // nsDOMDataSource
public:
	nsDOMDataSource();
	virtual ~nsDOMDataSource();
	nsresult Init();

private:
  nsCOMPtr<nsIDOMDocument> mDocument;
  nsIBindingManager *mBindingManager;
  PRBool *mShowAnonymousContent;
  PRUint16 *mFilters;
  nsIRDFService *mRDFService;
  nsVoidArray *mObservers;

  nsIRDFService* GetRDFService();
  // Filters
  PRUint16 GetNodeTypeKey(PRUint16 aType);
  // Datasource Construction
  nsresult GetTargetsForKnownObject(nsISupports *object, nsIRDFResource *aProperty, PRBool aShowAnon, nsISupportsArray *arcs);
  nsresult CreateDOMNodeArcs(nsIDOMNode *node, PRBool aShowAnon, nsISupportsArray* arcs);
  nsresult CreateChildNodeArcs(nsIDOMNode *aNode, nsISupportsArray *aArcs);
  nsresult CreateDOMNodeListArcs(nsIDOMNodeList *nodelist, nsISupportsArray *arcs);
  nsresult CreateDOMNamedNodeMapArcs(nsIDOMNamedNodeMap *aNodeMap, nsISupportsArray *aArcs);
  nsresult CreateDOMNodeTarget(nsIDOMNode *node, nsIRDFResource *aProperty, nsIRDFNode **aResult);
  nsresult CreateRootTarget(nsIRDFResource* aSource, nsIRDFResource* aProperty, nsIRDFNode **aResult);
  nsresult CreateLiteral(nsString& str, nsIRDFNode **aResult);
  nsresult GetFieldNameFromRes(nsIRDFResource* aProperty, nsAutoString* aResult);
  
  // Observer Notification
  static PRBool ChangeEnumFunc(void *aElement, void *aData);
  static PRBool AssertEnumFunc(void *aElement, void *aData);
	static PRBool UnassertEnumFunc(void *aElement, void *aData);
	nsresult NotifyObservers(nsIRDFResource *subject, nsIRDFResource *property, nsIRDFNode *object, PRUint32 aType);
  // Misc
  PRBool IsObjectInCache(nsISupports* aObject);
  nsresult RemoveResourceForObject(nsISupports* aObject);
  PRBool HasChildren(nsIDOMNode* aContainer);
  static nsresult FindAttrRes(nsIContent* aContent, PRInt32 aNameSpaceID, nsIAtom* aAttribute, nsIRDFResource** aAttrRes);
  static PRBool FindAttrResEnumFunc(nsHashKey *aKey, void *aData, void* closure);
  static PRBool HasChild(nsIDOMNode* aContainer, nsIDOMNode* aChild);
  static PRBool HasAttribute(nsIDOMNode* aContainer, nsIDOMNode* aAttr);
  static void DumpResourceValue(nsIRDFResource* aRes);
  
public:
	// nsISupports
	NS_DECL_ISUPPORTS

	// nsIInsDOMDataSource
	NS_DECL_NSIINSDOMDATASOURCE

	// nsIRDFDataSource
	NS_DECL_NSIRDFDATASOURCE

  // nsIDocumentObserver
  NS_IMETHOD BeginUpdate(nsIDocument *aDocument) { return NS_OK; }
  NS_IMETHOD EndUpdate(nsIDocument *aDocument) { return NS_OK; }
  NS_IMETHOD BeginLoad(nsIDocument *aDocument) { return NS_OK; }
  NS_IMETHOD EndLoad(nsIDocument *aDocument) { return NS_OK; }
  NS_IMETHOD BeginReflow(nsIDocument *aDocument, nsIPresShell* aShell) { return NS_OK; }
  NS_IMETHOD EndReflow(nsIDocument *aDocument, nsIPresShell* aShell) { return NS_OK; } 
  NS_IMETHOD ContentChanged(nsIDocument *aDocument,
			                      nsIContent* aContent,
                            nsISupports* aSubContent) { return NS_OK; }
  NS_IMETHOD ContentStatesChanged(nsIDocument* aDocument,
                                  nsIContent* aContent1,
                                  nsIContent* aContent2) { return NS_OK; }
  NS_IMETHOD AttributeChanged(nsIDocument *aDocument,
                              nsIContent*  aContent,
                              PRInt32      aNameSpaceID,
                              nsIAtom*     aAttribute,
                              PRInt32      aHint);
  NS_IMETHOD ContentAppended(nsIDocument *aDocument,
			                       nsIContent* aContainer,
                             PRInt32     aNewIndexInContainer);
  NS_IMETHOD ContentInserted(nsIDocument *aDocument,
			                       nsIContent* aContainer,
                             nsIContent* aChild,
                             PRInt32 aIndexInContainer);
  NS_IMETHOD ContentReplaced(nsIDocument *aDocument,
			                       nsIContent* aContainer,
                             nsIContent* aOldChild,
                             nsIContent* aNewChild,
                             PRInt32 aIndexInContainer);
  NS_IMETHOD ContentRemoved(nsIDocument *aDocument,
                            nsIContent* aContainer,
                            nsIContent* aChild,
                            PRInt32 aIndexInContainer);
  NS_IMETHOD StyleSheetAdded(nsIDocument *aDocument, nsIStyleSheet* aStyleSheet) { return NS_OK; }
  NS_IMETHOD StyleSheetRemoved(nsIDocument *aDocument, nsIStyleSheet* aStyleSheet) { return NS_OK; }
  NS_IMETHOD StyleSheetDisabledStateChanged(nsIDocument *aDocument,
                                            nsIStyleSheet* aStyleSheet,
                                            PRBool aDisabled) { return NS_OK; }
  NS_IMETHOD StyleRuleChanged(nsIDocument *aDocument,
                              nsIStyleSheet* aStyleSheet,
                              nsIStyleRule* aStyleRule,
                              PRInt32 aHint) { return NS_OK; }
  NS_IMETHOD StyleRuleAdded(nsIDocument *aDocument,
                            nsIStyleSheet* aStyleSheet,
                            nsIStyleRule* aStyleRule) { return NS_OK; }
  NS_IMETHOD StyleRuleRemoved(nsIDocument *aDocument,
                              nsIStyleSheet* aStyleSheet,
                              nsIStyleRule* aStyleRule) { return NS_OK; }
  NS_IMETHOD DocumentWillBeDestroyed(nsIDocument *aDocument);

};


//////////

typedef struct _nsDOMDSNotification {
  nsIRDFDataSource *datasource;
  nsIRDFResource *subject;
  nsIRDFResource *property;
  nsIRDFNode *object;
} nsDOMDSNotification;

typedef struct _nsDOMDSFindAttrInfo {
  nsIContent *mCrap;
  nsIContent *mContent;
  PRInt32 mNameSpaceID;
  nsIAtom *mAttribute;
  nsIRDFResource **mAttrRes;
} nsDOMDSFindAttrInfo;

#endif // domdatasource___h___


