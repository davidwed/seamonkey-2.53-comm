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
 * Christopher A. Aillon <christopher@aillon.com>.
 * Portions created by the Initial Developer are Copyright (C) 2003
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Christopher A. Aillon <christopher@aillon.com>
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsISupportsString     = Components.interfaces.nsISupportsString;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;

function InspectorCmdLineHandler() {}
InspectorCmdLineHandler.prototype =
{
  classDescription: "DOM Inspector Command Line Handler",
  classID: Components.ID("{38293526-6b13-4d4f-a075-71939435b408}"),
  contractID: "@mozilla.org/commandlinehandler/general-startup;1?type=inspector",
  /* Needed for XPCOMUtils NSGetModule */
  _xpcom_categories: [{category: "command-line-handler",
                       entry: "m-inspector"}],

  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler]),

  /* nsICommandLineHandler */
  handle : function handler_handle(cmdLine) {
    var args = Components.classes["@mozilla.org/supports-string;1"]
                         .createInstance(nsISupportsString);
    try {
      var uristr = cmdLine.handleFlagWithParam("inspector", false);
      if (uristr == null)
        return;
      try {
        args.data = cmdLine.resolveURI(uristr).spec;
      }
      catch (e) {
        return;
      }
    }
    catch (e) {
      cmdLine.handleFlag("inspector", true);
    }

    var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                           .getService(nsIWindowWatcher);
    wwatch.openWindow(null, "chrome://inspector/content/", "_blank",
                      "chrome,dialog=no,all", args);
  },

  helpInfo : "  -inspector <url>     Open the DOM inspector.\n"
};


/**
 * XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
 * XPCOMUtils.generateNSGetModule is for Mozilla 1.9.0 (Firefox 3.0).
 */
if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([InspectorCmdLineHandler]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([InspectorCmdLineHandler]);
