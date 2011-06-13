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
 * The Original Code is clipboard flavors for DOM Inspector.
 *
 * The Initial Developer of the Original Code is
 * Jason Barnabe <jason_barnabe@fastmail.fm>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
* Clipboard Flavors ----------------------------------------------------------
*   Flavors for copying inspected data to the clipboard.
* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* REQUIRED IMPORTS:
* chrome://inspector/content/utils.js
*****************************************************************************/

/**
 * Represents a CSS property.
 * @param aProperty
 *        the name of the property
 * @param aValue
 *        the value of the property
 * @param aImportant
 *        boolean indicating whether this is !important
 */
function CSSProperty(aProperty, aValue, aImportant)
{
  this.flavor = "inspector/css-property";
  this.delimiter = "\n";
  this.property = aProperty;
  this.value = aValue;
  this.important = aImportant == true;
}

/**
 * Returns a usable CSS string for the CSSProperty.
 * @return a string in the form "property: value;"
 */
CSSProperty.prototype.toString = function CSSProperty_ToString()
{
  return this.property + ": " + this.value + (this.important ?
                                                " !important" :
                                                "") + ";";
}

/**
 * Represents a DOM attribute.
 * @param aNode
 *        the attribute node
 */
function DOMAttribute(aNode)
{
  this.flavor = "inspector/dom-attribute";
  this.node = aNode.cloneNode(false);
  this.delimiter = " ";
}

/**
 * Returns a string representing an attribute name/value pair
 * @return a string in the form of 'name="value"'
 */
DOMAttribute.prototype.toString = function DOMA_ToString()
{
  return this.node.nodeName + '="' +
         InsUtil.unicodeToEntity(this.node.nodeValue) + '"';
};
