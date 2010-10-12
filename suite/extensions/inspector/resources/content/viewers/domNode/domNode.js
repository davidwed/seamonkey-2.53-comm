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
 *   Shawn Wilsher <me@shawnwilsher.com>
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
* DOMNodeViewer --------------------------------------------------------------
*  The default viewer for DOM Nodes
*****************************************************************************/

//////////////////////////////////////////////////////////////////////////////
//// Global Constants

const kDOMViewCID = "@mozilla.org/inspector/dom-view;1";

//////////////////////////////////////////////////////////////////////////////
//// Global Variables

var viewer;
var gPromptService;

//////////////////////////////////////////////////////////////////////////////

window.addEventListener("load", DOMNodeViewer_initialize, false);

function DOMNodeViewer_initialize()
{
  viewer = new DOMNodeViewer();
  viewer.initialize(parent.FrameExchange.receiveData(window));
}

//////////////////////////////////////////////////////////////////////////////
//// DOMNodeViewer Class

function DOMNodeViewer()  // implements inIViewer
{
  this.mObsMan = new ObserverManager(this);

  this.mURL = window.location;
  this.mAttrTree = document.getElementById("olAttr");

  // prepare and attach the DOM DataSource
  this.mDOMView = XPCU.createInstance(kDOMViewCID, "inIDOMView");
  this.mDOMView.whatToShow = NodeFilter.SHOW_ATTRIBUTE;
  this.mAttrTree.treeBoxObject.view = this.mDOMView;
}

DOMNodeViewer.prototype =
{
  ////////////////////////////////////////////////////////////////////////////
  //// Initialization

  mDOMView: null,
  mSubject: null,
  mPanel: null,

  get selectedIndex()
  {
    return this.mAttrTree.currentIndex;
  },

 /**
  * Returns an array of the selected indices
  */
  get selectedIndices()
  {
    var indices = [];
    var rangeCount = this.mAttrTree.view.selection.getRangeCount();
    for (var i = 0; i < rangeCount; ++i) {
      var start = {};
      var end = {};
      this.mAttrTree.view.selection.getRangeAt(i, start, end);
      for (var c = start.value; c <= end.value; ++c) {
        indices.push(c);
      }
    }
    return indices;
  },

 /**
  * Returns a DOMAttribute from the selected index
  */
  get selectedAttribute()
  {
    var index = this.selectedIndex;
    return index >= 0 ?
      new DOMAttribute(this.mDOMView.getNodeFromRowIndex(index)) : null;
  },

 /**
  * Returns an array of DOMAttributes from the selected indices
  */
  get selectedAttributes()
  {
    var indices = this.selectedIndices;
    var attrs = [];
    for (var i = 0; i < indices.length; ++i) {
      var idx = this.mDOMView.getNodeFromRowIndex(indices[i]);
      attrs.push(new DOMAttribute(idx));
    }
    return attrs;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// interface inIViewer

  //// attributes

  get uid()
  {
    return "domNode"
  },

  get pane()
  {
    return this.mPanel
  },


  get selection()
  {
    return null
  },


  get subject()
  {
    return this.mSubject
  },

  set subject(aObject)
  {
    // the node value's textbox won't fire onchange when we change subjects, so
    // let's fire it. this won't do anything if it wasn't actually changed
    viewer.pane.panelset.execCommand('cmdEditTextValue');

    this.mSubject = aObject;
    var deck = document.getElementById("dkContent");

    switch (aObject.nodeType) {
      // things with useful nodeValues
      case Node.TEXT_NODE:
      case Node.CDATA_SECTION_NODE:
      case Node.COMMENT_NODE:
      case Node.PROCESSING_INSTRUCTION_NODE:
        deck.setAttribute("selectedIndex", 1);
        var txb = document.getElementById("txbTextNodeValue").value =
                  aObject.nodeValue;
        break;
      //XXX this view is designed for elements, write a more useful one for
      // document nodes, etc.
      default:
        var bundle = this.pane.panelset.stringBundle;
        deck.setAttribute("selectedIndex", 0);

        this.setTextValue("localName", aObject.localName);
        this.setTextValue("nodeType", bundle.getString(aObject.nodeType));
        this.setTextValue("namespace", aObject.namespaceURI);
    }

    var hideAttributes = aObject.nodeType != Node.ELEMENT_NODE;
    this.mAttrTree.hidden = hideAttributes;
    if (!hideAttributes && aObject != this.mDOMView.rootNode) {
      this.mDOMView.rootNode = aObject;
      this.mAttrTree.view.selection.select(-1);
    }

    this.mObsMan.dispatchEvent("subjectChange", { subject: aObject });
  },

  // methods

  initialize: function DNVr_Initialize(aPane)
  {
    this.mPanel = aPane;
    aPane.notifyViewerReady(this);
  },

  destroy: function DNVr_Destroy()
  {
    // the node value's textbox won't fire onchange when we change views, so
    // let's fire it. this won't do anything if it wasn't actually changed
    viewer.pane.panelset.execCommand('cmdEditTextValue');
  },

  isCommandEnabled: function DNVr_IsCommandEnabled(aCommand)
  {
    // NB: This function can be fired before the subject is set.
    switch (aCommand) {
      case "cmdEditPaste":
        var flavor = this.mPanel.panelset.clipboardFlavor;
        return (flavor == "inspector/dom-attribute" ||
                flavor == "inspector/dom-attributes");
      case "cmdEditInsert":
        return this.subject && this.subject.nodeType == Node.ELEMENT_NODE;
      case "cmdEditCut":
      case "cmdEditCopy":
      case "cmdEditDelete":
        return this.selectedAttribute != null;
      case "cmdEditEdit":
        return this.mAttrTree.currentIndex >= 0 &&
                 this.mAttrTree.view.selection.count == 1;
      case "cmdEditTextValue":
        if (this.subject) {
          // something with a useful nodeValue
          if (this.subject.nodeType == Node.TEXT_NODE ||
              this.subject.nodeType == Node.CDATA_SECTION_NODE ||
              this.subject.nodeType == Node.COMMENT_NODE ||
              this.subject.nodeType == Node.PROCESSING_INSTRUCTION_NODE) {
            // did something change?
            return this.subject.nodeValue !=
                   document.getElementById("txbTextNodeValue").value;
          }
        }
        return false;
    }
    return false;
  },

  getCommand: function DNVr_GetCommand(aCommand)
  {
    switch (aCommand) {
      case "cmdEditCut":
        return new cmdEditCut();
      case "cmdEditCopy":
        return new cmdEditCopy(this.selectedAttributes);
      case "cmdEditPaste":
        return new cmdEditPaste();
      case "cmdEditInsert":
        var command = new cmdEditInsert();
        return command.promptFor();
      case "cmdEditEdit":
        var command = new cmdEditEdit();
        return command.promptFor();
      case "cmdEditDelete":
        return new cmdEditDelete();
      case "cmdEditTextValue":
        return new cmdEditTextValue();
    }
    return null;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Event Dispatching

  addObserver: function DNVr_AddObserver(aEvent, aObserver)
  {
    this.mObsMan.addObserver(aEvent, aObserver);
  },

  removeObserver: function DNVr_RemoveObserver(aEvent, aObserver)
  {
    this.mObsMan.removeObserver(aEvent, aObserver);
  },

  ////////////////////////////////////////////////////////////////////////////
  //// Uncategorized

  setTextValue: function DNVr_SetTextValue(aName, aText)
  {
    var field = document.getElementById("tx_" + aName);
    if (field) {
      field.value = aText;
    }
  }
};

//////////////////////////////////////////////////////////////////////////////
//// Command Objects

function cmdEditCut() {}
cmdEditCut.prototype =
{
  // required for nsITransaction
  QueryInterface: txnQueryInterface,
  merge: txnMerge,
  isTransient: false,

  cmdCopy: null,
  cmdDelete: null,
  doTransaction: function DNVr_Cut_DoTransaction()
  {
    if (!this.cmdCopy) {
      this.cmdDelete = new cmdEditDelete();
      this.cmdCopy = new cmdEditCopy(viewer.selectedAttributes);
      this.cmdCopy.doTransaction();
    }
    this.cmdDelete.doTransaction();
  },

  undoTransaction: function DVVr_Cut_UndoTransaction()
  {
    this.cmdDelete.undoTransaction();
  },

  redoTransaction: txnRedoTransaction
};

function cmdEditPaste() {}
cmdEditPaste.prototype =
{
  // required for nsITransaction
  QueryInterface: txnQueryInterface,
  merge: txnMerge,
  isTransient: false,

  pastedAttr: null,
  previousAttrValue: null,
  subject: null,
  flavor: null,

  doTransaction: function DNVr_Paste_DoTransaction()
  {
    var subject, pastedAttr, flavor;
    if (this.subject) {
      subject = this.subject;
      pastedAttr = this.pastedAttr;
      flavor = this.flavor;
    }
    else {
      subject = viewer.subject;
      pastedAttr = viewer.pane.panelset.getClipboardData();
      flavor = viewer.pane.panelset.clipboardFlavor;
      this.pastedAttr = pastedAttr;
      this.subject = subject;
      this.flavor = flavor;
      if (flavor == "inspector/dom-attributes") {
        this.previousAttrValue = [];
        for (var i = 0; i < pastedAttr.length; ++i) {
          this.previousAttrValue[pastedAttr[i].node.nodeName] =
            viewer.subject.getAttribute(pastedAttr[i].node.nodeName);
        }
      }
      else if (flavor == "inspector/dom-attribute") {
        this.previousAttrValue =
          viewer.subject.getAttribute(pastedAttr.node.nodeName);
      }
    }

    if (subject && pastedAttr) {
      if (flavor == "inspector/dom-attributes") {
        for (var i = 0; i < pastedAttr.length; ++i) {
          subject.setAttribute(pastedAttr[i].node.nodeName,
                               pastedAttr[i].node.nodeValue);
        }
      }
      else if (flavor == "inspector/dom-attribute") {
        subject.setAttribute(pastedAttr.node.nodeName,
                             pastedAttr.node.nodeValue);
      }
    }
  },

  undoTransaction: function DNVr_Paste_UndoTransaction()
  {
    if (this.pastedAttr) {
      if (this.flavor == "inspector/dom-attributes") {
        for (var i = 0; i < this.pastedAttr.length; ++i) {
          var attrNodeName = this.pastedAttr[i].node.nodeName;
          if (this.previousAttrValue[attrNodeName]) {
            this.subject.setAttribute(attrNodeName,
                                      this.previousAttrValue[attrNodeName]);
          }
          else {
            this.subject.removeAttribute(attrNodeName);
          }
        }
      }
      else if (this.flavor == "inspector/dom-attribute") {
        if (this.previousAttrValue) {
          this.subject.setAttribute(this.pastedAttr.node.nodeName,
                                    this.previousAttrValue);
        }
        else {
          this.subject.removeAttribute(this.pastedAttr.node.nodeName);
        }
      }
    }
  },

  redoTransaction: txnRedoTransaction
};

function cmdEditInsert() {}
cmdEditInsert.prototype =
{
  // required for nsITransaction
  QueryInterface: txnQueryInterface,
  merge: txnMerge,
  isTransient: false,

  attr: null,
  subject: null,
  name: null,
  value: null,
  namespaceURI: null,
  accepted: false,

  promptFor: function DNVr_Insert_PromptFor()
  {
    var bundle = viewer.pane.panelset.stringBundle;
    var title = bundle.getString("newAttribute.title");
    var doc = viewer.subject.ownerDocument;

    window.openDialog("chrome://inspector/content/viewers/domNode/" +
                      "domNodeDialog.xul", "insert",
                      "chrome,modal,centerscreen", this, title, doc);

    this.subject = viewer.subject;

    return this.accepted ? this : null;
  },

  doTransaction: function DNVr_Insert_DoTransaction()
  {
    this.subject.setAttributeNS(this.namespaceURI,
                                this.name,
                                this.value);
  },

  undoTransaction: function DNVr_Insert_UndoTransaction()
  {
    if (this.subject == viewer.subject) {
      this.subject.removeAttributeNS(this.namespaceURI,
                                     this.name);
    }
  },

  redoTransaction: txnRedoTransaction
};

function cmdEditDelete() {}
cmdEditDelete.prototype =
{
  // required for nsITransaction
  QueryInterface: txnQueryInterface,
  merge: txnMerge,
  isTransient: false,

  attrs: null,
  subject: null,

  doTransaction: function DNVr_Delete_DoTransaction()
  {
    var attrs = this.attrs ? this.attrs : viewer.selectedAttributes;
    if (attrs) {
      this.attrs = attrs;
      this.subject = viewer.subject;
      for (var i = 0; i < this.attrs.length; ++i) {
        this.subject.removeAttribute(this.attrs[i].node.nodeName);
      }
    }
  },

  undoTransaction: function DNVr_Delete_UndoTransaction()
  {
    if (this.attrs) {
      for (var i = 0; i < this.attrs.length; ++i) {
        this.subject.setAttribute(this.attrs[i].node.nodeName,
                                  this.attrs[i].node.nodeValue);
      }
    }
  },

  redoTransaction: txnRedoTransaction
};

// XXX when editing the a attribute in this document:
// data:text/xml,<x a="hi&#x0a;lo&#x0d;go"/>
// You only get "hi" and not the mutltiline text (windows)
// This seems to work on Linux, but not very usable
function cmdEditEdit() {}
cmdEditEdit.prototype =
{
  // required for nsITransaction
  QueryInterface: txnQueryInterface,
  merge: txnMerge,
  isTransient: false,

  subject: null,
  name: null,
  value: null,
  namespaceURI: null,
  previousValue: null,
  previousNamespaceURI: null,
  accepted: false,

  promptFor: function DNVr_Edit_PromptFor()
  {
    var attr = viewer.selectedAttribute.node;
    if (!attr) {
      return null;
    }
    var bundle = viewer.pane.panelset.stringBundle;
    var title = bundle.getString("editAttribute.title");
    var doc = attr.ownerDocument;

    this.subject              = viewer.subject;
    this.name                 = attr.nodeName;
    this.previousValue        = attr.nodeValue;
    this.previousNamespaceURI = attr.namespaceURI;
    this.value                = this.previousValue;
    this.namespaceURI         = this.previousNamespaceURI;

    window.openDialog("chrome://inspector/content/viewers/domNode/" +
                      "domNodeDialog.xul", "edit",
                      "chrome,modal,centerscreen", this, title, doc);

    return this.accepted ? this : null;
  },

  doTransaction: function DNVr_Edit_DoTransaction()
  {
    if (this.previousNamespaceURI == this.namespaceURI) {
      this.subject.setAttributeNS(this.previousNamespaceURI,
                                  this.name,
                                  this.value);
    }
    else {
      this.subject.removeAttributeNS(this.previousNamespaceURI,
                                     this.name);
      this.subject.setAttributeNS(this.namespaceURI,
                                  this.name,
                                  this.value);
    }
  },

  undoTransaction: function DNVr_Edit_UndoTransaction()
  {
    if (this.previousNamespaceURI == this.namespaceURI) {
      this.subject.setAttributeNS(this.previousNamespaceURI,
                                  this.name,
                                  this.previousValue);
    }
    else {
      this.subject.removeAttributeNS(this.namespaceURI,
                                     this.name);
      this.subject.setAttributeNS(this.previousNamespaceURI,
                                  this.name,
                                  this.previousValue);
    }
  },

  redoTransaction: txnRedoTransaction
};

/**
 * Handles editing of text nodes.
 */
function cmdEditTextValue() {
  this.newValue = document.getElementById("txbTextNodeValue").value;
  this.subject = viewer.subject;
  this.previousValue = this.subject.nodeValue;
}

cmdEditTextValue.prototype =
{
  // required for nsITransaction
  QueryInterface: txnQueryInterface,
  merge: txnMerge,
  isTransient: false,

  doTransaction: function DNVr_EditText_DoTransaction()
  {
    this.subject.nodeValue = this.newValue;
  },

  undoTransaction: function DNVr_EditText_UndoTransaction()
  {
    this.subject.nodeValue = this.previousValue;
    this.refreshView();
  },

  redoTransaction: function DNVr_EditText_RedoTransaction()
  {
    this.doTransaction();
    this.refreshView();
  },

  refreshView: function DNVr_EditText_RefreshView() {
    // if we're still on the same subject, update the textbox
    if (viewer.subject == this.subject) {
      document.getElementById("txbTextNodeValue").value =
               this.subject.nodeValue;
    }
  }
};
