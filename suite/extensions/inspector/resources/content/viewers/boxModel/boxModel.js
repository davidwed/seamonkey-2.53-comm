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

/***************************************************************
* BoxModelViewer --------------------------------------------
*  The viewer for the boxModel and visual appearance of an element.
* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
* REQUIRED IMPORTS:
*   chrome://inspector/content/jsutil/xpcom/XPCU.js
****************************************************************/

//////////// global variables /////////////////////

var viewer;

//////////// global constants ////////////////////

const kIMPORT_RULE = Components.interfaces.nsIDOMCSSRule.IMPORT_RULE;

//////////////////////////////////////////////////

window.addEventListener("load", BoxModelViewer_initialize, false);

function BoxModelViewer_initialize()
{
  viewer = new BoxModelViewer();
  viewer.initialize(parent.FrameExchange.receiveData(window));
}

////////////////////////////////////////////////////////////////////////////
//// class BoxModelViewer

function BoxModelViewer()
{
  this.mURL = window.location;
  this.mObsMan = new ObserverManager(this);
}

BoxModelViewer.prototype = 
{
  ////////////////////////////////////////////////////////////////////////////
  //// Initialization
  
  mSubject: null,
  mPane: null,
  
  ////////////////////////////////////////////////////////////////////////////
  //// interface inIViewer

  get uid() { return "boxModel" },
  get pane() { return this.mPane },

  get subject() { return this.mSubject },
  set subject(aObject) 
  {
    this.mSubject = aObject;
    this.showStats();
    this.mObsMan.dispatchEvent("subjectChange", { subject: aObject });
  },

  initialize: function(aPane)
  {
    this.initGroups();

    this.mPane = aPane;
    aPane.notifyViewerReady(this);
  },

  groupPosition:  {},
  groupDimension: {},
  groupMargin:    {},
  groupBorder:    {},
  groupPadding:   {},

  initGroups: function()
  {
    this.groupPosition.x =    document.getElementById("positionXValue");
    this.groupPosition.y =    document.getElementById("positionYValue");
    this.groupPosition.screenX =
                              document.getElementById("positionScreenXValue");
    this.groupPosition.screenY =
                              document.getElementById("positionScreenYValue");

    this.groupDimension.width  =
                              document.getElementById("dimensionWidthValue");
    this.groupDimension.height =
                              document.getElementById("dimensionHeightValue");

    this.groupMargin.top =    document.getElementById("marginTopValue");
    this.groupMargin.right =  document.getElementById("marginRightValue");
    this.groupMargin.bottom = document.getElementById("marginBottomValue");
    this.groupMargin.left =   document.getElementById("marginLeftValue");

    this.groupBorder.top =    document.getElementById("borderTopValue");
    this.groupBorder.right =  document.getElementById("borderRightValue");
    this.groupBorder.bottom = document.getElementById("borderBottomValue");
    this.groupBorder.left =   document.getElementById("borderLeftValue");

    this.groupPadding.top =    document.getElementById("paddingTopValue");
    this.groupPadding.right =  document.getElementById("paddingRightValue");
    this.groupPadding.bottom = document.getElementById("paddingBottomValue");
    this.groupPadding.left =   document.getElementById("paddingLeftValue");
  },

  destroy: function()
  {
  },

  isCommandEnabled: function(aCommand)
  {
    return false;
  },
  
  getCommand: function(aCommand)
  {
    return null;
  },

  ////////////////////////////////////////////////////////////////////////////
  //// event dispatching

  addObserver: function(aEvent, aObserver) { this.mObsMan.addObserver(aEvent, aObserver); },
  removeObserver: function(aEvent, aObserver) { this.mObsMan.removeObserver(aEvent, aObserver); },
  
  ////////////////////////////////////////////////////////////////////////////
  //// statistical updates
  
  showStats: function()
  {
    this.showPositionStats();
    this.showDimensionStats();
    this.showMarginStats();
    this.showBorderStats();
    this.showPaddingStats();
  },
  
  showStatistic: function(aElement,  aSize)
  {
    if (aSize == null) {
        aSize = "";
    }
    var str = aSize.toString();
    aElement.setAttribute("value", str);

    var nonzero = aSize != 0 && str.indexOf("0px");
    aElement.setAttribute("class", nonzero ? "plain nonzero" : "plain");

    aElement.setAttribute("size", str.length + 1);
  },
  
  showPositionStats: function()
  {
    var group = this.groupPosition;
    if ("boxObject" in this.mSubject) { // xul elements
      var bx = this.mSubject.boxObject;
      this.showStatistic(group.x, bx.x);
      this.showStatistic(group.y, bx.y);
      this.showStatistic(group.screenX, bx.screenX);
      this.showStatistic(group.screenY, bx.screenY);
      group.screenX.parentNode.hidden = false;
      group.screenY.parentNode.hidden = false;
    } else { // html elements
      this.showStatistic(group.x, this.mSubject.offsetLeft);
      this.showStatistic(group.y, this.mSubject.offsetTop);
      group.screenX.parentNode.hidden = true;
      group.screenY.parentNode.hidden = true;
    }
  },
  
  showDimensionStats: function()
  {
    var group = this.groupDimension;
    if ("boxObject" in this.mSubject) { // xul elements
      var bx = this.mSubject.boxObject;
      this.showStatistic(group.width,  bx.width);
      this.showStatistic(group.height, bx.height);
    } else { // html elements
      this.showStatistic(group.width,  this.mSubject.offsetWidth);
      this.showStatistic(group.height, this.mSubject.offsetHeight);
    }
  },

  getSubjectComputedStyle: function()
  {
    var view = this.mSubject.ownerDocument.defaultView;
    return view.getComputedStyle(this.mSubject, "");
  },

  showMarginStats: function()
  {
    var style = this.getSubjectComputedStyle();
    var data = [this.readMarginStyle(style, "top"), this.readMarginStyle(style, "right"), 
                this.readMarginStyle(style, "bottom"), this.readMarginStyle(style, "left")];
    this.showSideStats(this.groupMargin, data);
  },

  showBorderStats: function()
  {
    var style = this.getSubjectComputedStyle();
    var data = [this.readBorderStyle(style, "top"), this.readBorderStyle(style, "right"), 
                this.readBorderStyle(style, "bottom"), this.readBorderStyle(style, "left")];
    this.showSideStats(this.groupBorder, data);
  },

  showPaddingStats: function()
  {
    var style = this.getSubjectComputedStyle();
    var data = [this.readPaddingStyle(style, "top"), this.readPaddingStyle(style, "right"), 
                this.readPaddingStyle(style, "bottom"), this.readPaddingStyle(style, "left")];
    this.showSideStats(this.groupPadding, data);
  },

  showSideStats: function(aGroup, aData)
  {
    this.showStatistic(aGroup.top,    aData[0]);
    this.showStatistic(aGroup.right,  aData[1]);
    this.showStatistic(aGroup.bottom, aData[2]);
    this.showStatistic(aGroup.left,   aData[3]);
  },
  
  readMarginStyle: function(aStyle, aSide)
  {
    return aStyle.getPropertyCSSValue("margin-"+aSide).cssText;
  },
  
  readPaddingStyle: function(aStyle, aSide)
  {
    return aStyle.getPropertyCSSValue("padding-"+aSide).cssText;
  },
  
  readBorderStyle: function(aStyle, aSide)
  {
    var style = aStyle.getPropertyCSSValue("border-"+aSide+"-style").cssText;
    if (!style || !style.length) {
      return "none";
    } else {
      return aStyle.getPropertyCSSValue("border-"+aSide+"-width").cssText + " " + 
             style + " " +
             aStyle.getPropertyCSSValue("border-"+aSide+"-color").cssText;
    }
  }
};
