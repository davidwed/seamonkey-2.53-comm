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
 *   Jason Barnabe <jason_barnabe@fastmail.fm>
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
* ComputedStyleViewer --------------------------------------------------------
*  The viewer for the computed CSS styles on a DOM element.
* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* REQUIRED IMPORTS:
*   chrome://inspector/content/jsutil/xpcom/XPCU.js
*   chrome://inspector/content/events/ObserverManager.js
*   chrome://inspector/content/commands/baseCommands.js
*   chrome://inspector/content/system/clipboardFlavors.js
*   chrome://inspector/content/xul/inBaseTreeView.js
*****************************************************************************/

//////////////////////////////////////////////////////////////////////////////
//// Global Variables

var viewer;

//////////////////////////////////////////////////////////////////////////////

window.addEventListener("load", ComputedStyleViewer_initialize, false);

function ComputedStyleViewer_initialize()
{
  viewer = new ComputedStyleViewer();
  viewer.initialize(parent.FrameExchange.receiveData(window));
}

//////////////////////////////////////////////////////////////////////////////
//// class ComputedStyleViewer

function ComputedStyleViewer()
{
  this.mObsMan = new ObserverManager(this);
  this.mURL = window.location;

  this.mTree = document.getElementById("olStyles");
}

//XXX Don't use anonymous functions
ComputedStyleViewer.prototype =
{
  ////////////////////////////////////////////////////////////////////////////
  //// Initialization

  mSubject: null,
  mPane: null,

  ////////////////////////////////////////////////////////////////////////////
  //// interface inIViewer

  get uid()
  {
    return "computedStyle";
  },

  get pane()
  {
    return this.mPane;
  },

  get subject()
  {
    return this.mSubject;
  },

  set subject(aObject)
  {
    var bo = this.mTree.treeBoxObject;
    var firstVisibleRow = -1;
    var selectedIndices;
    var currentIndex;
    if (this.mTreeView) {
      firstVisibleRow = bo.getFirstVisibleRow();
      selectedIndices = this.mTreeView.getSelectedIndices();
      currentIndex = this.mTreeView.selection.currentIndex;
    }

    this.mTreeView = new ComputedStyleView(aObject);
    this.mTree.view = this.mTreeView;

    if (firstVisibleRow >= 0) {
      bo.beginUpdateBatch();
      try {
        bo.scrollToRow(firstVisibleRow);
        let selection = this.mTreeView.selection;
        for (let i = 0, n = selectedIndices.length; i < n; ++i) {
          selection.toggleSelect(selectedIndices[i]);
        }
        selection.currentIndex = currentIndex;
      }
      catch (ex) {
        Components.utils.reportError(ex);
      }
      bo.endUpdateBatch();
    }

    this.mObsMan.dispatchEvent("subjectChange", { subject: aObject });
  },

  initialize: function CSVr_Initialize(aPane)
  {
    this.mPane = aPane;
    aPane.notifyViewerReady(this);
  },

  destroy: function CSVr_Destroy()
  {
    // We need to remove the view at this time or else it will attempt to
    // re-paint while the document is being deconstructed, resulting in some
    // nasty XPConnect assertions
    this.mTree.view = null;
  },

  isCommandEnabled: function CSVr_IsCommandEnabled(aCommand)
  {
    if (aCommand == "cmdEditCopy") {
      return this.mTree.view.selection.count > 0;
    }
    return false;
  },

  getCommand: function CSVr_GetCommand(aCommand)
  {
    if (aCommand == "cmdEditCopy") {
      return new cmdEditCopy(this.mTreeView.getSelectedRowObjects());
    }
    return null;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// event dispatching

  addObserver: function CSVr_AddObserver(aEvent, aObserver)
  {
    this.mObsMan.addObserver(aEvent, aObserver);
  },

  removeObserver: function CSVr_RemoveObserver(aEvent, aObserver)
  {
    this.mObsMan.removeObserver(aEvent, aObserver);
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Miscellaneous

  onItemSelected: function CSVr_OnItemSelected()
  {
    // This will (eventually) call isCommandEnabled on Copy
    viewer.pane.panelset.updateAllCommands();
  }
};

////////////////////////////////////////////////////////////////////////////
//// ComputedStyleView

function ComputedStyleView(aObject)
{
  var view = aObject.ownerDocument.defaultView;
  this.mStyleList = view.getComputedStyle(aObject, "");
  this.mRowCount = this.mStyleList.length;
}

ComputedStyleView.prototype = new inBaseTreeView();

ComputedStyleView.prototype.getCellText = function CSV_GetCellText(aRow, aCol)
{
  var prop = this.mStyleList.item(aRow);
  if (aCol.id == "olcStyleName") {
    return prop;
  }
  else if (aCol.id == "olcStyleValue") {
    return this.mStyleList.getPropertyValue(prop);
  }

  return null;
}

/**
  * Returns a CSSProperty for the row in the tree corresponding to the passed
  * index.
  * @param aIndex
  *        index of the row in the tree
  * @return a CSSProperty
  */
ComputedStyleView.prototype.getRowObjectFromIndex =
  function CSV_GetRowObjectFromIndex(aIndex)
{
  var prop = this.mStyleList.item(aIndex);
  return new CSSProperty(prop, this.mStyleList.getPropertyValue(prop));
}
