/*
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
 * Copyright (C) 2001 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 *   Joe Hewitt <hewitt@netscape.com> (original author)
 */

/***************************************************************
* SidebarPrefs -------------------------------------------------
*  The controller for the lovely sidebar prefs panel.
* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
* REQUIRED IMPORTS:
*   chrome://inspector/content/jsutil/xpcom/XPCU.js
*   chrome://inspector/content/jsutil/rdf/RDFU.js
****************************************************************/

//////////// global variables /////////////////////

var sidebarPref;

//////////// global constants ////////////////////

const kDirServiceCID       = "@mozilla.org/file/directory_service;1"
const kNCURI               = "http://home.netscape.com/NC-rdf#";
const kSidebarPanelId      = "UPnls"; // directory services property to find panels.rdf
const kSidebarURNPanelList = "urn:sidebar:current-panel-list";
const kSidebarURN3rdParty  = "urn:sidebar:3rdparty-panel";
const kSidebarURL          = "chrome://inspector/content/sidebar.xul";
const kSidebarTitle        = "DOM Inspector";

//////////////////////////////////////////////////

window.addEventListener("load", SidebarPrefs_initialize, false);

function SidebarPrefs_initialize()
{
  sidebarPref = new SidebarPrefs();
  sidebarPref.initSidebarData();
}

///// class SidebarPrefs /////////////////////////

function SidebarPrefs()
{
}

SidebarPrefs.prototype = 
{
  
  ///////////////////////////////////////////////////////////////////////////
  // Because nsSidebar has been so mean to me, I'm going to re-write it's
  // addPanel code right here so I don't have to fight with it.  Pbbbbt!
  ///////////////////////////////////////////////////////////////////////////

  initSidebarData: function()
  {
    var file = this.getDirectoryFile(kSidebarPanelId);
    if (file)
      RDFU.loadDataSource(file, gSidebarLoadListener);
  },

  initSidebarData2: function(aDS)
  {
    var res = aDS.GetTarget(gRDF.GetResource(kSidebarURNPanelList), gRDF.GetResource(kNCURI + "panel-list"), true);
    this.mDS = aDS;
    this.mPanelSeq = RDFU.makeSeq(aDS, res);
    this.mPanelRes = gRDF.GetResource(kSidebarURN3rdParty + ":" + kSidebarURL);
    
    if (this.isSidebarInstalled()) {
      document.getElementById("tbxSidebar").setAttribute("hidden", "true");      
    }
  },

  isSidebarInstalled: function()
  {
    return this.mPanelSeq.IndexOf(this.mPanelRes) != -1;
  },

  installSidebar: function()
  {
    if (!this.isSidebarInstalled()) {
      this.mDS.Assert(this.mPanelRes, gRDF.GetResource(kNCURI + "title"), gRDF.GetLiteral(kSidebarTitle), true);
      this.mDS.Assert(this.mPanelRes, gRDF.GetResource(kNCURI + "content"), gRDF.GetLiteral(kSidebarURL), true);
      this.mPanelSeq.AppendElement(this.mPanelRes);
      this.forceSidebarRefresh();
      
      // XXX localize this
      var msg = document.getElementById("txSidebarMsg");
      msg.removeChild(msg.firstChild);
      msg.appendChild(document.createTextNode("The sidebar is installed.")); 
      var btn = document.getElementById("btnSidebarInstall");
      btn.setAttribute("disabled", "true");
      
      return true;
    } else
      return false;
  },

  forceSidebarRefresh: function()
  {
    var listRes = gRDF.GetResource(kSidebarURNPanelList);
    var refreshRes = gRDF.GetResource(kNCURI + "refresh");
    var trueRes = gRDF.GetLiteral("true");
    this.mDS.Assert(listRes, refreshRes, trueRes, true);
    this.mDS.Unassert(listRes, refreshRes, trueRes);
  },

  getDirectoryFile: function(aFileId)
  {
    try {
      var dirService = XPCU.getService(kDirServiceCID, "nsIProperties");
      var file = dirService.get(aFileId, Components.interfaces.nsIFile);
      if (!file.exists())
        return null;
      return file.URL;
    } catch (ex) {
      return null;
    }
  }

};

var gSidebarLoadListener = {
  onDataSourceReady: function(aDS) 
  {
    sidebarPref.initSidebarData2(aDS);
  },

  onError: function()
  {
  }
};

