/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This module handles migrating mail-specific preferences, etc. Migration has
 * traditionally been a part of msgMail3PaneWindow.js, but separating the code
 * out into a module makes unit testing much easier.
 */

var EXPORTED_SYMBOLS = ["MailMigrator"];

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource:///modules/IOUtils.js");

ChromeUtils.defineModuleGetter(this, "LoginHelper",
                               "resource://gre/modules/LoginHelper.jsm");

var MailMigrator = {
  /**
   * Switch the given fonts to the given encodings, but only if the current fonts
   * are defaults.
   */
  _switchDefaultFonts: function MailMigrator__switchDefaultFonts(aFonts,
                                                                 aEncodings) {
    for (let encoding of aEncodings) {
      let serifPref = "font.name.serif." + encoding;
      let sansPref = "font.name.sans-serif." + encoding;
      let variableSizePref = "font.size.variable." + encoding;
      // This is expected to be one of sans-serif or serif, and determines what
      // we'll link the variable font size to.
      let isSansDefault = Services.prefs.getCharPref("font.default." + encoding) ==
                            "sans-serif";

      if (!Services.prefs.prefHasUserValue(serifPref)) {
        Services.prefs.setCharPref(serifPref, aFonts.serif);
        if (!isSansDefault)
          Services.prefs.setIntPref(variableSizePref, aFonts.variableSize);
      }

      if (!Services.prefs.prefHasUserValue(sansPref)) {
        Services.prefs.setCharPref(sansPref, aFonts.sans);
        if (isSansDefault)
          Services.prefs.setIntPref(variableSizePref, aFonts.variableSize);
      }

      let monospacePref = "font.name.monospace." + encoding;
      let fixedSizePref = "font.size.fixed." + encoding;
      if (!Services.prefs.prefHasUserValue(monospacePref)) {
        Services.prefs.setCharPref(monospacePref, aFonts.monospace);
        Services.prefs.setIntPref(fixedSizePref, aFonts.fixedSize);
      }
    }
  },

  /**
   * Migrate to ClearType fonts (Cambria, Calibri and Consolas) on Windows Vista
   * and above.
   */
  migrateToClearTypeFonts: function MailMigrator_migrateToClearTypeFonts() {
    // Windows...
    if ("@mozilla.org/windows-registry-key;1" in Cc) {
      // Only migrate on Vista (Windows version 6.0) and above
      if (Services.sysinfo.getPropertyAsDouble("version") >= 6.0) {
        let fontPrefVersion =
          Services.prefs.getIntPref("mail.font.windows.version");
        if (fontPrefVersion < 2) {
          let fonts = {
            serif: "Cambria",
            sans: "Calibri",
            monospace: "Consolas",
            variableSize: 17,
            fixedSize: 14,
          };
          // Encodings to switch to the new fonts.
          let encodings = [];
          // (Thunderbird 3.1)
          if (fontPrefVersion < 1)
            encodings.push("x-unicode", "x-western");
          // (Thunderbird 3.2)
          encodings.push("x-cyrillic", "el");

          this._switchDefaultFonts(fonts, encodings);

          Services.prefs.setIntPref("mail.font.windows.version", 2);
        }
      }
    }
  },

  /**
   * Determine if the UI has been upgraded in a way that requires us to reset
   * some user configuration.  If so, performs the resets.
   */
  _migrateUI: function() {
    // The code for this was ported from
    // mozilla/browser/components/nsBrowserGlue.js
    const UI_VERSION = 15;
    const MESSENGER_DOCURL = "chrome://messenger/content/messenger.xul";
    const UI_VERSION_PREF = "mail.ui-rdf.version";
    let currentUIVersion = 0;

    try {
      currentUIVersion = Services.prefs.getIntPref(UI_VERSION_PREF);
    } catch(ex) {}

    if (currentUIVersion >= UI_VERSION)
      return;

    let xulStore = Cc["@mozilla.org/xul/xulstore;1"].getService(Ci.nsIXULStore);

    let newProfile = (currentUIVersion == 0);
    if (newProfile) {
      // Collapse the main menu by default if the override pref
      // "mail.main_menu.collapse_by_default" is set to true.
      if (Services.prefs.getBoolPref("mail.main_menu.collapse_by_default")) {
        xulStore.setValue(MESSENGER_DOCURL, "mail-toolbar-menubar2", "autohide", "true");
      }

      // Set to current version to skip all the migration below.
      currentUIVersion = UI_VERSION;
    }

    try {
      // UI versions below 5 could only exist in an old profile with localstore.rdf
      // file used for the XUL store. Since TB55 this file is no longer read.
      // Since UI version 5, the xulstore.json file is being used, so we only
      // support those version here, see bug 1371898.

      // In UI version 6, we move the otherActionsButton button to the
      // header-view-toolbar.
      if (currentUIVersion < 6) {
        let cs = xulStore.getValue(MESSENGER_DOCURL, "header-view-toolbar", "currentset");
        if (cs && !cs.includes("otherActionsButton")) {
          // Put the otherActionsButton button at the end.
          cs = cs + "," + "otherActionsButton";
          xulStore.setValue(MESSENGER_DOCURL, "header-view-toolbar", "currentset", cs);
        }
      }

      // In UI version 7, the three-state doNotTrack setting was reverted back
      // to two-state. This reverts a (no longer supported) setting of "please
      // track me" to the default "don't say anything".
      if (currentUIVersion < 7) {
        try {
          if (Services.prefs.getBoolPref("privacy.donottrackheader.enabled") &&
              Services.prefs.getIntPref("privacy.donottrackheader.value") != 1) {
            Services.prefs.clearUserPref("privacy.donottrackheader.enabled");
            Services.prefs.clearUserPref("privacy.donottrackheader.value");
          }
        }
        catch (ex) {}
      }

      // In UI version 8, we change from boolean browser.display.use_document_colors
      // to the tri-state browser.display.document_color_use.
      if (currentUIVersion < 8) {
        const kOldColorPref = "browser.display.use_document_colors";
        if (Services.prefs.prefHasUserValue(kOldColorPref) &&
            !Services.prefs.getBoolPref(kOldColorPref)) {
          Services.prefs.setIntPref("browser.display.document_color_use", 2);
        }
      }

      // Limit the charset detector pref to values (now) available from the UI.
      if (currentUIVersion < 9) {
        let detector = null;
        try {
          detector = Services.prefs.getComplexValue("intl.charset.detector",
                                                    Ci.nsIPrefLocalizedString).data;
        } catch (ex) { }
        if (!(detector == "" ||
              detector == "ja_parallel_state_machine" ||
              detector == "ruprob" ||
              detector == "ukprob")) {
          // If the encoding detector pref value is not reachable from the UI,
          // reset to default (varies by localization).
          Services.prefs.clearUserPref("intl.charset.detector");
        }
      }

      // This one is needed also in all new profiles.
      // Add an expanded entry for All Address Books.
      if (currentUIVersion < 10 || newProfile) {
        const DIR_TREE_FILE = "directoryTree.json";

        // If the file exists, read its contents, prepend the "All ABs" URI
        // and save it, else, just write the "All ABs" URI to the file.
        let data = IOUtils.loadFileToString(DIR_TREE_FILE);
        if (!data || data == "[]") {
          data = "";
        } else if (data.length > 0) {
          data = data.substring(1, data.length - 1);
        }

        data = "[" + "\"moz-abdirectory://?\"" +
               ((data.length > 0) ? ("," + data) : "") + "]";

        IOUtils.saveStringToFile(DIR_TREE_FILE, data);
      }

      // Several Latin language groups were consolidated into x-western.
      if (currentUIVersion < 11) {
        let group = null;
        try {
          group = Services.prefs.getComplexValue("font.language.group",
                                                 Ci.nsIPrefLocalizedString);
        } catch (ex) {}
        if (group &&
            ["tr", "x-baltic", "x-central-euro"].some(g => g == group.data)) {
          group.data = "x-western";
          Services.prefs.setComplexValue("font.language.group",
                                         Ci.nsIPrefLocalizedString, group);
        }
      }

      // The obsolete files signons.txt, signons2.txt and signons3.txt got
      // removed from the profile directory.
      if (currentUIVersion < 12) {
        LoginHelper.removeLegacySignonFiles();
      }

      // Untangled starting in Paragraph mode from Enter key preference
      if (currentUIVersion < 13) {
        Services.prefs.setBoolPref("mail.compose.default_to_paragraph",
          Services.prefs.getBoolPref("editor.CR_creates_new_p"));
        Services.prefs.clearUserPref("editor.CR_creates_new_p");
      }

      // Migrate remote content exceptions for email addresses which are
      // encoded as chrome URIs.
      if (currentUIVersion < 14) {
        let permissionsDB =
          Services.dirsvc.get("ProfD", Ci.nsIFile);
        permissionsDB.append("permissions.sqlite");
        let db = Services.storage.openDatabase(permissionsDB);

        try {
          let statement = db.createStatement(
            "select origin,permission from moz_perms where " +
            // Avoid 'like' here which needs to be escaped.
            "substr(origin, 1, 28)='chrome://messenger/content/?';");
          try {
            while (statement.executeStep()) {
              let origin = statement.getUTF8String(0);
              let permission = statement.getInt32(1);
              Services.perms.remove(
                Services.io.newURI(origin), "image");
              origin = origin.replace("chrome://messenger/content/?",
                                      "chrome://messenger/content/");
              Services.perms.add(
                Services.io.newURI(origin), "image", permission);
            }
          } finally {
            statement.finalize();
          }

          // Sadly we still need to clear the database manually. Experiments
          // showed that the permissions manager deleted only one record.
          db.beginTransactionAs(Ci.mozIStorageConnection
                                  .TRANSACTION_EXCLUSIVE);
          try {
            db.executeSimpleSQL("delete from moz_perms where " +
              "substr(origin, 1, 28)='chrome://messenger/content/?';");
            db.commitTransaction();
          } catch (ex) {
            db.rollbackTransaction();
            throw ex;
          }
        } finally {
          db.close();
        }
      }

      // Changed notification sound behaviour on OS X.
      if (currentUIVersion < 15) {
        ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
        if (AppConstants.platform == "macosx") {
          // For people updating from versions < 52 who had "Play system sound"
          // selected for notifications. As TB no longer plays system sounds,
          // uncheck the pref to match the new behaviour.
          const soundPref = "mail.biff.play_sound";
          if (Services.prefs.getBoolPref(soundPref) &&
              Services.prefs.getIntPref(soundPref + ".type") == 0) {
            Services.prefs.setBoolPref(soundPref, false);
          }
        }
      }

      // Update the migration version.
      Services.prefs.setIntPref(UI_VERSION_PREF, UI_VERSION);

    } catch(e) {
      Cu.reportError("Migrating from UI version " + currentUIVersion + " to " +
                     UI_VERSION + " failed. Error message was: " + e + " -- " +
                     "Will reattempt on next start.");
    }
  },

  /**
   * Perform any migration work that needs to occur after the Account Wizard
   * has had a chance to appear.
   */
  migratePostAccountWizard: function MailMigrator_migratePostAccountWizard() {
    this.migrateToClearTypeFonts();
  },

  /**
   * Perform any migration work that needs to occur once the user profile has
   * been loaded.
   */
  migrateAtProfileStartup: function MailMigrator_migrateAtProfileStartup() {
    this._migrateUI();
  },
};
