/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["Sanitizer"];

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "AppConstants",
                                  "resource://gre/modules/AppConstants.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
                                  "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FormHistory",
                                  "resource://gre/modules/FormHistory.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Downloads",
                                  "resource://gre/modules/Downloads.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "DownloadsCommon",
                                  "resource:///modules/DownloadsCommon.jsm");

var Sanitizer = {
  get _prefs() {
    delete this._prefs;
    return this._prefs = Services.prefs.getBranch("privacy.sanitize.");
  },

  /**
   * Deletes privacy sensitive data in a batch, optionally showing the
   * sanitize UI, according to user preferences
   *
   * @returns  null if everything's fine
   *           an object in the form { itemName: error, ... } on (partial) failure
   */
  sanitize: function(aParentWindow) {
    this.readSettings(aParentWindow);
    return this.doPendingSanitize();
  },

  clearSettings: function() {
    for (var itemName in this.items)
      this.items[itemName].willClear = false;
  },

  readSettings: function(aParentWindow) {
    var itemPrefs = Services.prefs.getBranch("privacy.item.");
    for (var itemName in this.items) {
      var item = this.items[itemName];
      if ("clear" in item)
        item.willClear = itemPrefs.getBoolPref(itemName);
    }
    if (this._prefs.getBoolPref("promptOnSanitize")) {
      // make this an app-modal window on Mac.
      var win = "nsILocalFileMac" in Ci ? null
                                                           : aParentWindow;
      Services.ww.openWindow(win,
                             "chrome://communicator/content/sanitize.xul",
                             "Sanitize",
                             "chrome,titlebar,centerscreen,dialog,modal",
                             null);
    }
  },

  doPendingSanitize: function() {
    // do the actual sanitizing
    var errors = null;
    for (var itemName in this.items) {
      var item = this.items[itemName];
      if ("clear" in item && item.willClear && item.canClear) {
        // Some of these clear() may raise exceptions (see bug #265028)
        // to sanitize as much as possible, we catch and store them,
        // rather than fail fast.
        // Callers should check returned errors and give user feedback
        // about items that could not be sanitized
        try {
          item.clear();
        } catch(ex) {
          if (!errors)
            errors = {};
          errors[itemName] = ex;
          dump("Error sanitizing " + itemName + ": " + ex + "\n");
        }
      }
    }
    return errors;
  },

  // warning to the caller: this one may raise an exception (e.g. bug #265028)
  clearItem: function(aItemName) {
    if (this.items[aItemName].canClear)
      this.items[aItemName].clear();
  },

  setClearItem: function(aItemName, aWillClear) {
    this.items[aItemName].willClear = aWillClear;
  },

  willClearItem: function(aItemName) {
    return this.items[aItemName].willClear;
  },

  canClearItem: function(aItemName, aCallback, aArg) {
    var canClear = this.items[aItemName].canClear;
    if (typeof canClear == "function") {
      canClear(aCallback, aArg);
      return false;
    }

    aCallback(aItemName, canClear, aArg);
    return canClear;
  },

  // this is called on startup and shutdown, to perform pending sanitizations
  checkSettings: function() {
    if (this._prefs.getBoolPref("sanitizeOnShutdown") &&
        !this._prefs.prefHasUserValue("didShutdownSanitize"))
      this.readSettings();
    else
      this.clearSettings();
  },

  // clear plugin data
  _clearPluginData: function(aFlagName) {
    const nsIPluginHost = Ci.nsIPluginHost;
    var ph = Cc["@mozilla.org/plugin/host;1"]
               .getService(nsIPluginHost);

    if (!(aFlagName in nsIPluginHost))
      return;

    var flag = nsIPluginHost[aFlagName];
    var tags = ph.getPluginTags();
    for (var i = 0; i < tags.length; i++) {
      try {
        ph.clearSiteData(tags[i], null, flag, -1);
      } catch (ex) {
        // Ignore errors from the plugin
      }
    }
  },

  items: {
    cache: {
      clear: function() {
        // use try/catch for everything but the last task so we clear as much as possible
        try {
          Services.cache2.clear();
        } catch(ex) {}

        Cc["@mozilla.org/image/tools;1"]
          .getService(Ci.imgITools)
          .getImgCacheForDocument(null)
          .clearCache(false); // true=chrome, false=content
      },

      canClear: true
    },

    offlineApps: {
      clear: function() {
        // use try/catch for everything but the last task so we clear as much as possible
        try {
          Services.cache2
                  .appCacheStorage(Services.loadContextInfo.default, null)
                  .asyncEvictStorage(null);
        } catch(ex) {}
      },

      canClear: true
    },

    cookies: {
      clear: function() {
        var cookieMgr = Cc["@mozilla.org/cookiemanager;1"]
                          .getService(Ci.nsICookieManager);
        cookieMgr.removeAll();

        Sanitizer._clearPluginData("FLAG_CLEAR_ALL");

        // clear any network geolocation provider sessions
        try {
          Services.prefs.deleteBranch("geo.wifi.access_token.");
        } catch (e) {}
      },

      canClear: true
    },

    history: {
      clear: function() {
        ChromeUtils.import("resource://gre/modules/PlacesUtils.jsm");

        // use try/catch for everything but the last task so we clear as much as possible
        try {
          PlacesUtils.history.clear();
        } catch(ex) {}

        try {
          var os = Cc["@mozilla.org/observer-service;1"]
                     .getService(Ci.nsIObserverService);
          os.notifyObservers(null, "browser:purge-session-history");
        } catch(ex) {}
      },

        // bug 347231: Always allow clearing history due to dependencies on
        // the browser:purge-session-history notification. (like error console)
      canClear: true
    },

    urlbar: {
      clear: function() {
        // Clear last URL of the Open Web Location dialog
        try {
          Services.prefs.clearUserPref("general.open_location.last_url");
        } catch(ex) {}

        // Clear URLbar history (see also pref-history.js)
        var file = Cc["@mozilla.org/file/directory_service;1"]
                     .getService(Ci.nsIProperties)
                     .get("ProfD", Ci.nsIFile);
        file.append("urlbarhistory.sqlite");
        if (file.exists())
          file.remove(false);
      },

      get canClear() {
        if (!Services.prefs.prefIsLocked("general.open_location.last_url") &&
            Services.prefs.prefHasUserValue("general.open_location.last_url"))
          return true;

        var file = Cc["@mozilla.org/file/directory_service;1"]
                     .getService(Ci.nsIProperties)
                     .get("ProfD", Ci.nsIFile);
        file.append("urlbarhistory.sqlite");
        return file.exists();
      }
    },

    formdata: {
      clear: function() {
        // Clear undo history of all search and find bars.
        var windows = Services.wm.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
          var win = windows.getNext();
          var currentDocument = win.document;

          var findBar = currentDocument.getElementById("FindToolbar");
          if (findBar)
            findBar.clear();
          var searchBar = currentDocument.getElementById("searchbar");
          if (searchBar && searchBar.textbox)
            searchBar.textbox.reset();
          var sideSearchBar = win.BrowserSearch.searchSidebar;
          if (sideSearchBar)
            sideSearchBar.reset();
        }

        var change = { op: "remove" };
        FormHistory.update(change);
      },

      canClear: function(aCallback, aArg) {
        var windows = Services.wm.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
          var win = windows.getNext();
          var currentDocument = win.document;

          var findBar = currentDocument.getElementById("FindToolbar");
          if (findBar && findBar.hasTransactions) {
            aCallback("formdata", true, aArg);
            return false;
          }
          var searchBar = currentDocument.getElementById("searchbar");
          if (searchBar && searchBar.textbox && searchBar.textbox.editor) {
            var transactionMgr = searchBar.textbox.editor.transactionManager;
            if (searchBar.value ||
                transactionMgr.numberOfUndoItems ||
                transactionMgr.numberOfRedoItems) {
              aCallback("formdata", true, aArg);
              return false;
            }
          }
          var sideSearchBar = win.BrowserSearch.searchSidebar;
          if (sideSearchBar) {
            var sidebarTm = sideSearchBar.editor.transactionManager;
            if (sideSearchBar.value ||
                sidebarTm.numberOfUndoItems ||
                sidebarTm.numberOfRedoItems) {
              aCallback("formdata", true, aArg);
              return false;
            }
          }
        }

        var count = 0;
        var countDone = {
          handleResult: aResult => count = aResult,
          handleError: aError => Cu.reportError(aError),
          handleCompletion(aReason) {
            aCallback("formdata", !aReason && count, aArg);
          }
        };
        FormHistory.count({}, countDone);
        return false;
      }
    },

    downloads: {
      // Just say yes to avoid adding some async logic.
      canClear: true,
      async clear() {
        try {
          // Clear all completed/cancelled downloads.
          let list = await Downloads.getList(Downloads.ALL);
          list.removeFinished(null);
        } finally {
        }
      },
    },

    passwords: {
      clear: function() {
        var pwmgr = Cc["@mozilla.org/login-manager;1"]
                      .getService(Ci.nsILoginManager);
        pwmgr.removeAllLogins();
      },

      get canClear() {
        var pwmgr = Cc["@mozilla.org/login-manager;1"]
                      .getService(Ci.nsILoginManager);
        var count = pwmgr.countLogins("", "", ""); // count all logins
        return (count > 0);
      }
    },

    sessions: {
      clear: function() {
        // clear all auth tokens
        Cc["@mozilla.org/security/pk11tokendb;1"]
          .createInstance(Ci.nsIPK11TokenDB)
          .getInternalKeyToken()
          .checkPassword("");

        // clear plain HTTP auth sessions
        var authMgr = Cc["@mozilla.org/network/http-auth-manager;1"]
                        .getService(Ci.nsIHttpAuthManager);
        authMgr.clearAll();
      },

      canClear: true
    }
  }
};
