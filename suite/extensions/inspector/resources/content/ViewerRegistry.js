/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joe Hewitt <hewitt@netscape.com> (original author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*****************************************************************************
* ViewerRegistry -------------------------------------------------------------
*   The central registry where information about all installed viewers is
*   kept.
* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* REQUIRED IMPORTS:
*   chrome://inspector/content/jsutil/xpcom/XPCU.js
*   chrome://inspector/content/jsutil/rdf/RDFU.js
*****************************************************************************/

//////////////////////////////////////////////////////////////////////////////
//// Global Constants

const kViewerURLPrefix = "chrome://inspector/content/viewers/";
const kViewerRegURL  = "chrome://inspector/content/res/viewer-registry.rdf";

//////////////////////////////////////////////////////////////////////////////
//// Class ViewerRegistry

function ViewerRegistry() // implements inIViewerRegistry
{
  this.mViewerHash = {};
}

ViewerRegistry.prototype =
{
  ////////////////////////////////////////////////////////////////////////////
  //// Interface inIViewerRegistry (not yet formalized...)

  ////////////////////////////////////////////////////////////////////////////
  //// Initialization

  mDS: null,
  mObserver: null,
  mViewerDS: null,
  mViewerHash: null,
  mFilters: null,

  get url()
  {
    return this.mURL;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Loading Methods

  load: function VR_Load(aURL, aObserver)
  {
    this.mURL = aURL;
    this.mObserver = aObserver;
    RDFU.loadDataSource(aURL, new ViewerRegistryLoadObserver(this));
  },

  onError: function VR_OnError(aStatus, aErrorMsg)
  {
    this.mObserver.onViewerRegistryLoadError(aStatus, aErrorMsg);
  },

  onLoad: function VR_OnLoad(aDS)
  {
    this.mDS = aDS;
    this.prepareRegistry();
    this.mObserver.onViewerRegistryLoad();
  },

  prepareRegistry: function VR_PrepareRegistry()
  {
    this.mViewerDS = RDFArray.fromContainer(this.mDS, "inspector:viewers",
                                            kInspectorNSURI);

    // create and cache the filter functions
    var js, fn;
    this.mFilters = [];
    for (var i = 0; i < this.mViewerDS.length; ++i) {
      js = this.getEntryProperty(i, "filter");
      try {
        fn = new Function("object", "linkedViewer", js);
      }
      catch (ex) {
        fn = new Function("return false");
        debug("### ERROR - Syntax error in filter for viewer \"" +
              this.getEntryProperty(i, "description") + "\"\n");
      }
      this.mFilters.push(fn);
    }
  },

  /**
   * Returns the absolute url where the xul file for a viewer can be found.
   *
   * @param aIndex
   *        The numerical index of the entry representing the viewer.
   * @return A string of the fully canonized url.
   */
  getEntryURL: function VR_GetEntryURL(aIndex)
  {
    var uid = this.getEntryProperty(aIndex, "uid");
    return kViewerURLPrefix + uid + "/" + uid + ".xul";
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Lookup Methods

  /**
   * Searches the viewer registry for all viewers that can view a particular
   * object.
   *
   * @param aObject
   *        The object being searched against.
   * @param aPanelId
   *        A string containing the id of the panel requesting viewers.
   * @param aLinkedViewer
   *        The view object of linked panel.
   * @return An array of nsIRDFResource entries in the viewer registry.
   */
  findViewersForObject:
    function VR_FindViewersForObject(aObject, aPanelId, aLinkedViewer)
  {
    // check each entry in the registry
    var len = this.mViewerDS.length;
    var entry;
    var urls = [];
    for (var i = 0; i < len; ++i) {
      if (this.getEntryProperty(i, "panels").indexOf(aPanelId) == -1) {
        continue;
      }
      if (this.objectMatchesEntry(aObject, aLinkedViewer, i)) {
        if (this.getEntryProperty(i, "important")) {
          urls.unshift(i);
        } else {
          urls.push(i);
        }
      }
    }

    return urls;
  },

  /**
   * Determines if an object is eligible to be viewed by a particular viewer.
   *
   * @param aObject
   *        The object being checked for eligibility.
   * @param aLinkedViewer
   *        The view object of linked panel.
   * @param aIndex
   *        The numerical index of the entry.
   * @return true if object can be viewed.
   */
  objectMatchesEntry:
    function VR_ObjectMatchesEntry(aObject, aLinkedViewer, aIndex)
  {
    try {
      return this.mFilters[aIndex](aObject, aLinkedViewer);
    }
    catch (ex) {
      Components.utils.reportError(ex);
    }
    return false;
  },

  /**
   * Notifies the registry that a viewer has been instantiated, and that it
   * corresponds to a particular entry in the viewer registry.
   *
   * @param aViewer
   *        The inIViewer object to cache.
   * @param aIndex
   *        The numerical index of the entry.
   */
  cacheViewer: function VR_CacheViewer(aViewer, aIndex)
  {
    var uid = this.getEntryProperty(aIndex, "uid");
    this.mViewerHash[uid] = { viewer: aViewer, entry: aIndex };
  },

  uncacheViewer: function VR_UncacheViewer(aViewer)
  {
    delete this.mViewerHash[aViewer.uid];
  },

  // for previously loaded viewers only
  getViewerByUID: function VR_GetViewerByUID(aUID)
  {
    return this.mViewerHash[aUID].viewer;
  },

  // for previously loaded viewers only
  getEntryForViewer: function VR_GetEntryForViewer(aViewer)
  {
    return this.mViewerHash[aViewer.uid].entry;
  },

  // for previously loaded viewers only
  getEntryByUID: function VR_GetEntryByUID(aUID)
  {
    return this.mViewerHash[aUID].aIndex;
  },

  getEntryProperty: function VR_GetEntryProperty(aIndex, aProp)
  {
    return this.mViewerDS.get(aIndex, aProp);
  },

  getEntryCount: function VR_GetEntryCount()
  {
    return this.mViewerDS.length;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Viewer Registration

  addNewEntry: function VR_AddNewEntry(aUID, aDescription, aFilter)
  {
  },

  removeEntry: function VR_RemoveEntry(aIndex)
  {
  },

  saveRegistry: function VR_SaveRegistry()
  {
  }
};

////////////////////////////////////////////////////////////////////////////
//// Listener Objects

function ViewerRegistryLoadObserver(aTarget)
{
  this.mTarget = aTarget;
}

ViewerRegistryLoadObserver.prototype =
{
  mTarget: null,

  onError: function VRLO_OnError(aStatus, aErrorMsg)
  {
    this.mTarget.onError(aStatus, aErrorMsg);
  },

  onDataSourceReady: function VRLO_OnDataSourceReady(aDS)
  {
    this.mTarget.onLoad(aDS);
  }
};
