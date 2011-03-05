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
 * The Original Code is mozilla.org code for the DOM Inspector.
 *
 * The Initial Developer of the Original Code is
 *   Shawn Wilsher <me@shawnwilsher.com>
 * 
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dave Townsend <dave.townsend@blueprintit.co.uk>
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

///////////////////////////////////////////////////////////////////////////////
//// Global Variables

var dialog;

///////////////////////////////////////////////////////////////////////////////
//// Initialization/Destruction

window.addEventListener("load", InsertDialog_initialize, false);

function InsertDialog_initialize()
{
  dialog = new InsertDialog();
  dialog.initialize();
}

///////////////////////////////////////////////////////////////////////////////
//// class InsertDialog

function InsertDialog()
{
  this.mDoc  = window.arguments[0];
  this.mData = window.arguments[1];

  this.nodeType  = document.getElementById("ml_nodeType");
  this.tagName = document.getElementById("tx_tagName");
  this.nodeValue = document.getElementById("tx_nodeValue");
  this.namespace = document.getElementById("tx_namespace");
  this.menulist  = document.getElementById("ml_namespace");
  this.customNS  = document.getElementById("mi_custom");
}

InsertDialog.prototype =
{
 /**
  * This function initializes the content of the dialog.
  */
  initialize: function initialize()
  {
    var menulist   = this.menulist;
    var menuitems  = menulist.firstChild.childNodes;
    var defaultNS  = document.getElementById("mi_namespace");
    var accept     = document.documentElement.getButton("accept");

    menulist.disabled = !this.mData.enableNamespaces;
    defaultNS.value        = this.mDoc.documentElement.namespaceURI;

    if (this.mData.enableNamespaces) {
      let uri = this.mData.namespaceURI;
      menulist.value = uri;
      if (!menulist.selectedItem) {
        // The original node's namespace isn't one listed in the menulist.
        this.customNS.value = uri;
        menulist.selectedItem = this.customNS;
      }
    }
    this.updateNamespace();
    this.updateType();
    this.tagName.focus();
  },

 /**
  * The function that is called on accept.  Sets data.
  */
  accept: function accept()
  {
    switch (this.nodeType.value)
    {
      case "element":
      	this.mData.type     = Components.interfaces.nsIDOMNode.ELEMENT_NODE;
        this.mData.value    = this.tagName.value;
        break;
      case "text":
      	this.mData.type     = Components.interfaces.nsIDOMNode.TEXT_NODE;
        this.mData.value    = this.nodeValue.value;
        break;
    }
    this.mData.namespaceURI = this.namespace.value;
    this.mData.accepted     = true;
    return true;
  },

 /**
  * updateType changes the visibility of rows based on the node type.
  */
  updateType: function updateType()
  {
    switch (dialog.nodeType.value)
    {
      case "text":
        document.getElementById("row_text").hidden = false;
        document.getElementById("row_element").hidden = true;
        break;
      case "element":
        document.getElementById("row_text").hidden = true;
        document.getElementById("row_element").hidden = false;
        break;
    }
    dialog.toggleAccept();
  },

 /**
  * updateNamespace updates the namespace textbox based on the namespace menu.
  */
  updateNamespace: function updateNamespace()
  {
    this.namespace.disabled = dialog.menulist.selectedItem != this.customNS;
    this.namespace.value    = dialog.menulist.value;
  },

  /**
   * Change the "Custom" menuitem's value to reflect the namespace textbox's
   * value.
   *
   * This fires on input events, so if the user switches away from the
   * "Custom" menuitem and then back, the previously-entered value remains.
   */
  updateCustom: function updateCustom()
  {
    this.customNS.value = this.namespace.value;
  },

 /**
  * toggleAccept enables/disables the Accept button when there is/isn't an
  *   attribute name.
  */
  toggleAccept: function toggleAccept()
  {
    document.documentElement.getButton("accept").disabled = 
      (dialog.tagName.value == "") && (dialog.nodeType.selectedItem.value == "element");
  }
};
