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
* JSObjectViewer -------------------------------------------------------------
*  The viewer for all facets of a javascript object.
* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* REQUIRED IMPORTS:
*   chrome://inspector/content/utils.js
*   chrome://inspector/content/hooks.js
*   chrome://inspector/content/jsutil/events/ObserverManager.js
*   chrome://inspector/content/jsutil/xpcom/XPCU.js
*****************************************************************************/

//////////////////////////////////////////////////////////////////////////////
//// Global Constants

const kClipboardHelperCID  = "@mozilla.org/widget/clipboardhelper;1";

//////////////////////////////////////////////////////////////////////////////
//// Class JSObjectViewer

function JSObjectViewer()
{
  this.mObsMan = new ObserverManager(this);
}

JSObjectViewer.prototype =
{
  ////////////////////////////////////////////////////////////////////////////
  //// Initialization

  mSubject: null,
  mPane: null,

  ////////////////////////////////////////////////////////////////////////////
  //// interface inIViewer

  get uid()
  {
    return "jsObject";
  },

  get pane()
  {
    return this.mPane;
  },

  get selection()
  {
    return this.mSelection;
  },

  get subject()
  {
    return this.mSubject;
  },

  set subject(aObject)
  {
    aObject = this.unwrapObject(aObject);
    this.mSubject = aObject;
    this.emptyTree(this.mTreeKids);
    var ti = this.addTreeItem(this.mTreeKids, bundle.getString("root.title"),
                              aObject, aObject);
    ti.setAttribute("open", "true");

    this.mObsMan.dispatchEvent("subjectChange", { subject: aObject });
  },

  initialize: function JSOVr_Initialize(aPane)
  {
    this.mPane = aPane;
    this.mTree = document.getElementById("treeJSObject");
    this.mTreeKids = document.getElementById("trchJSObject");

    aPane.notifyViewerReady(this);
  },

  destroy: function JSOVr_Destroy()
  {
  },

  isCommandEnabled: function JSOVr_IsCommandEnabled(aCommand)
  {
    switch (aCommand) {
      case "cmdCopyValue":
      case "cmdEvalExpr":
        return this.mTree.view.selection.count == 1;
      case "cmdEditInspectInNewWindow":
        let item = getSelectedItem();
        return !!item &&
               cmdEditInspectInNewWindowBase.isInspectable(item.__JSValue__);
    }
    return false;
  },

  getCommand: function JSOVr_GetCommand(aCommand)
  {
    if (aCommand in window) {
      return new window[aCommand]();
    }
    return null;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Event Dispatching

  addObserver: function JSOVr_AddObserver(aEvent, aObserver)
  {
    this.mObsMan.addObserver(aEvent, aObserver);
  },

  removeObserver: function JSOVr_RemoveObserver(aEvent, aObserver)
  {
    this.mObsMan.removeObserver(aEvent, aObserver);
  },

  ////////////////////////////////////////////////////////////////////////////
  //// UI Commands

  cmdCopyValue: function JSOVr_CmdCopyValue()
  {
    var sel = getSelectedItem();
    if (sel) {
      var val = sel.__JSValue__;
      if (val) {
        var helper = XPCU.getService(kClipboardHelperCID,
                                     "nsIClipboardHelper");
        helper.copyString(val);
      }
    }
  },

  cmdEvalExpr: function JSOVr_CmdEvalExpr()
  {
    var sel = getSelectedItem();
    if (sel) {
      var win = openDialog("chrome://inspector/content/viewers/jsObject/evalExprDialog.xul",
                           "_blank", "chrome", this, sel);
    }
  },

  doEvalExpr: function JSOVr_DoEvalExpr(aExpr, aItem, aNewView)
  {
    // TODO: I should really write some C++ code to execute the js code in the
    // js context of the inspected window

    try {
      var f = Function("target", aExpr);
      var result = f(aItem.__JSValue__);

      if (result) {
        if (aNewView) {
          inspectObject(result);
        }
        else {
          this.subject = result;
        }
      }
    }
    catch (ex) {
      dump("Error in expression.\n");
      throw (ex);
    }
  },

  onTreeSelectionChange: function JSOVr_OnTreeSelectionChange()
  {
    this.pane.panelset.updateAllCommands();

    // There's no need to worry about any other commands outside this
    // commandset; cmdInspectInNewWindow is global, so it just got updated.
    var commands = document.getElementById("cmdsJSObjectViewer").childNodes;
    for (let i = 0, n = commands.length; i < n; ++i) {
      let command = commands[i];
      if (this.isCommandEnabled(command.id)) {
        command.removeAttribute("disabled");
      }
      else {
        command.setAttribute("disabled", true);
      }
    }
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Tree Construction

  emptyTree: function JSOVr_EmptyTree(aTreeKids)
  {
    while (aTreeKids.hasChildNodes()) {
      aTreeKids.removeChild(aTreeKids.lastChild);
    }
  },

  buildPropertyTree: function JSOVr_BuildPropertyTree(aTreeChildren, aObject)
  {
    // sort the properties
    var propertyNames = [];
    for (let prop in aObject) {
      propertyNames.push(prop);
    }


   /**
    * A sorter for numeric values. Numerics come before non-numerics. If both
    * parameters are non-numeric, returns 0.
    *
    * @param a
    *        One value to compare.
    * @param b
    *        The other value to compare against a.
    * @return -1 if a should come before b, 1 if b should come before a, or 0
    *         if they are equal
    */
    function sortNumeric(a, b) {
      if (isNaN(a)) {
        return isNaN(b) ? 0 : 1;
      }
      if (isNaN(b)) {
        return -1;
      }
      return a - b;
    }

   /**
    * A sorter for the JavaScript object property names. Sort order: constants
    * with numeric values sorted numerically by value then alphanumerically
    * by name, all other constants sorted alphanumerically by name, non-
    * constants with numeric names sorted numerically by name (ex: array
    * indices), all other non-constants sorted alphanumerically by name.
    *
    * @param a
    *        One name to compare.
    * @param b
    *        The other name to compare against a.
    * @return -1 if a should come before b, 1 if b should come before a, 0 if
    *         they are equal
    */
    function sortFunction(a, b) {
      // assume capitalized non-numeric property names are constants
      var aIsConstant = a == a.toUpperCase() && isNaN(a);
      var bIsConstant = b == b.toUpperCase() && isNaN(b);
      // constants come first
      if (aIsConstant) {
        if (bIsConstant) {
          // both are constants. sort by numeric value, then non-numeric name
          return sortNumeric(aObject[a], aObject[b]) || a.localeCompare(b);
        }
        // a is constant, b is not
        return -1;
      }
      if (bIsConstant) {
        // b is constant, a is not
        return 1;
      }
      // neither are constants. go by numeric property name, then non-numeric
      // property name
      return sortNumeric(a, b) || a.localeCompare(b);
    }
    propertyNames.sort(sortFunction);

    // load them into the tree
    for (let i = 0; i < propertyNames.length; i++) {
      try {
        this.addTreeItem(aTreeChildren, propertyNames[i],
                         this.unwrapObject(aObject[propertyNames[i]]),
                         aObject);
      }
      catch (ex) {
        // hide unsightly NOT YET IMPLEMENTED errors when accessing certain
        // properties
      }
    }
  },

  addTreeItem:
    function JSOVr_AddTreeItem(aTreeChildren, aName, aValue, aObject)
  {
    var ti = document.createElement("treeitem");
    ti.__JSObject__ = aObject;
    ti.__JSValue__ = aValue;

    var value;
    if (aValue === null) {
      value = "(null)";
    }
    else if (aValue === undefined) {
      value = "(undefined)";
    }
    else {
      try {
        value = aValue.toString();
        value = value.replace(/\n|\r|\t|\v/g, " ");
      }
      catch (ex) {
        value = "";
      }
    }

    ti.setAttribute("typeOf", typeof(aValue));

    if (typeof(aValue) == "object" && aValue !== null) {
      ti.setAttribute("container", "true");
    }
    else if (typeof(aValue) == "string") {
      value = "\"" + value + "\"";
    }

    var tr = document.createElement("treerow");
    ti.appendChild(tr);

    var tc = document.createElement("treecell");
    tc.setAttribute("label", aName);
    tr.appendChild(tc);
    tc = document.createElement("treecell");
    tc.setAttribute("label", value);
    if (aValue === null) {
      tc.setAttribute("class", "inspector-null-value-treecell");
    }
    tr.appendChild(tc);

    aTreeChildren.appendChild(ti);

    // listen for changes to open attribute
    this.mTreeKids.addEventListener("DOMAttrModified", onTreeItemAttrModified,
                                    false);

    return ti;
  },

  openTreeItem: function JSOVr_OpenTreeItem(aItem)
  {
    var treechildren = aItem.getElementsByTagName("treechildren").item(0);
    if (!treechildren) {
      treechildren = document.createElement("treechildren");
      this.buildPropertyTree(treechildren, aItem.__JSValue__);
      aItem.appendChild(treechildren);
    }
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Miscellaneous Utility Methods

  unwrapObject: function JSOVr_UnwrapObject(aObject)
  {
    /* unwrap() throws for primitive values, so don't call it for those */
    if (typeof(aObject) === "object" && aObject &&
        "unwrap" in XPCNativeWrapper) {
      aObject = XPCNativeWrapper.unwrap(aObject);
    }
    return aObject;
  }
};

function onTreeItemAttrModified(aEvent)
{
  if (aEvent.attrName == "open") {
    viewer.openTreeItem(aEvent.target);
  }
}

function getSelectedItem()
{
  var tree = document.getElementById("treeJSObject");
  if (tree.view.selection.count == 1) {
    let minAndMax = {};
    tree.view.selection.getRangeAt(0, minAndMax, minAndMax);
    return tree.contentView.getItemAtIndex(minAndMax.value);
  }
  return null;    
}

function toggleItem(aItem)
{
  var tree = document.getElementById("treeJSObject");
  var row = tree.currentView.getIndexOfItem(aItem);
  if (row >= 0) {
    tree.view.toggleOpenState(row);
  }
}

//////////////////////////////////////////////////////////////////////////////
//// Transactions

function cmdEditInspectInNewWindow()
{
  var selected = getSelectedItem();
  this.mObject = selected && selected.__JSValue__;
}

cmdEditInspectInNewWindow.prototype = new cmdEditInspectInNewWindowBase();
