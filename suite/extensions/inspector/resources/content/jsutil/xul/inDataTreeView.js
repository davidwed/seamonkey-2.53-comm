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
 * The Original Code is DOM Inspector.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Alexander Surkov <surkov.alexander@gmail.com> (original author)
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
//// inDataTreeView

function inDataTreeView()
{
  this.mRows = [];
}

///////////////////////////////////////////////////////////////////////////////
//// inDataTreeView. nsITreeView interface implementation

inDataTreeView.prototype = new inBaseTreeView();

inDataTreeView.prototype.__defineGetter__("rowCount",
  function inDataTreeView_rowCount()
  {
    return this.mRows.length;
  }
);

inDataTreeView.prototype.getCellText =
  function inDataTreeView_getCellText(aRowIdx, aCol)
{
  var row = this.getRowAt(aRowIdx);
  return row ? row.node.data[aCol.id] : "";
};

inDataTreeView.prototype.isContainer =
  function inDataTreeView_isContainer(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  return row ? row.node.children.length > 0 : false;
};

inDataTreeView.prototype.isContainerOpen =
  function inDataTreeView_isContainerOpen(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  return row ? row.isOpen : false;
};

inDataTreeView.prototype.isContainerEmpty =
  function inDataTreeView_isContainerEmpty(aRowIdx)
{
  return !this.isContainer(aRowIdx);
};

inDataTreeView.prototype.getLevel =
  function inDataTreeView_getLevel(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  return row ? row.node.level : 0;
};

inDataTreeView.prototype.getParentIndex =
  function inDataTreeView_getParentIndex(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  if (!row) {
    return -1;
  }

  for (let i = aRowIdx - 1; i >= 0; --i) {
    let checkRow = this.getRowAt(i);
    if (checkRow.node == row.node.parent) {
      return i;
    }
  }

  return -1;
};

inDataTreeView.prototype.hasNextSibling =
  function inDataTreeView_hasNextSibling(aRowIdx, aAfterRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  if (!row || !row.node.parent) {
    return false;
  }

  var lastIdx = row.node.parent.children.length - 1;
  return row.node.parent.children[lastIdx] != row.node;
};

inDataTreeView.prototype.toggleOpenState =
  function inDataTreeView_toggleOpenState(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  if (!row) {
    return;
  }

  var oldCount = this.rowCount;
  if (row.isOpen) {
    this.collapseNode(aRowIdx);
  }
  else {
    this.expandNode(aRowIdx);
  }

  this.mTree.invalidateRow(aRowIdx);
  this.mTree.rowCountChanged(aRowIdx + 1, this.rowCount - oldCount);
};

///////////////////////////////////////////////////////////////////////////////
//// inDataTreeView. Public.

/**
 * Append the child row to the row at the given index.
 */
inDataTreeView.prototype.appendChild =
  function inDataTreeView_appendChild(aParent, aData)
{
  var node = new inDataTreeViewNode(aData);
  if (aParent) {
    node.level = aParent.level + 1;
    node.parent = aParent;
    aParent.children.push(node);
    return node;
  }

  this.mRows.push(new inDataTreeViewRow(node));
  return node;
};

///////////////////////////////////////////////////////////////////////////////
//// inDataTreeView. Tree utils.

/**
 * Expands a tree node on the given row.
 */
inDataTreeView.prototype.expandNode =
  function inDataTreeView_expandNode(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  if (!row) {
    return;
  }

  var kids = row.node.children;
  var kidCount = kids.length;

  for (let i = this.rowCount - 1; i > aRowIdx; --i) {
    this.mRows[i + kidCount] = this.mRows[i];
  }

  for (let i = 0; i < kidCount; ++i) {
    this.mRows[aRowIdx + i + 1] = new inDataTreeViewRow(kids[i]);
  }

  row.isOpen = true;
};

/**
 * Collapse a tree node on the given row.
 */
inDataTreeView.prototype.collapseNode =
  function inDataTreeView_collapseNode(aRowIdx)
{
  var row = this.getRowAt(aRowIdx);
  if (!row) {
    return;
  }

  var removeCount = 0;
  var rowLevel = row.node.level;
  for (let idx = aRowIdx + 1; idx < this.rowCount; idx++) {
    if (this.getRowAt(idx).node.level <= rowLevel) {
      removeCount = idx - aRowIdx - 1;
      break;
    }
  }
  this.mRows.splice(aRowIdx + 1, removeCount);

  row.isOpen = false;
};

/**
 * Return a tree row object by the given row index.
 */
inDataTreeView.prototype.getRowAt =
  function inDataTreeView_getRowAt(aRowIdx)
{
  if (aRowIdx < 0 || aRowIdx >= this.rowCount) {
    return null;
  }

  return this.mRows[aRowIdx];
}

/**
 * Return a tree row data object by the given row index.
 */
inDataTreeView.prototype.getDataAt =
  function inDataTreeView_getDataAt(aRowIdx)
{
  if (aRowIdx < 0 || aRowIdx >= this.rowCount) {
    return null;
  }

  return this.mRows[aRowIdx].node.data;
};

///////////////////////////////////////////////////////////////////////////////
//// inDataTreeViewNode

function inDataTreeViewNode(aData)
{
  this.parent = null;
  this.children = [];

  this.level = 0;
  this.data = aData;
}

function inDataTreeViewRow(aNode)
{
  this.node = aNode;
  this.isOpen = false;
}
