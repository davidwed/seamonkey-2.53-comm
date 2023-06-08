/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

ChromeUtils.import("resource://gre/modules/Preferences.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

function run_test() {
    do_calendar_startup(run_next_test);
}

// tests for calL10NUtils.jsm
/* Incomplete - still missing test coverage for:
   * getAnyString
   * getString
   * getCalString
   * getLtnString
   * getDateFmtString
   * formatMonth
   * createLocaleCollator
*/

add_task(async function calendarInfo_test() {
    let data = [{
        input: { locale: "en-US" },
        expected: {
            properties: [
                "firstDayOfWeek", "minDays", "weekendStart", "weekendEnd",
                "calendar", "locale"
            ]
        }
    }, {
        input: { locale: "EN-US" },
        expected: {
            properties: [
                "firstDayOfWeek", "minDays", "weekendStart", "weekendEnd",
                "calendar", "locale"
            ]
        }
    }, {
        input: { locale: "et" },
        expected: {
            properties: [
                "firstDayOfWeek", "minDays", "weekendStart", "weekendEnd",
                "calendar", "locale"
            ]
        }
    }, {
        input: { locale: null }, // this also would trigger caching tests
        expected: {
            properties: [
                "firstDayOfWeek", "minDays", "weekendStart", "weekendEnd",
                "calendar", "locale"
            ]
        }
    }];
    let useOSLocaleFormat = Preferences.get("intl.regional_prefs.use_os_locales", false);
    // let localeService = Cc["@mozilla.org/intl/localeservice;1"].getService(Ci.mozILocaleService);
    let osprefs = Cc["@mozilla.org/intl/ospreferences;1"].getService(Ci.mozIOSPreferences);
    let appLocale = Services.locale.getAppLocalesAsBCP47()[0];
    let rsLocale = osprefs.getRegionalPrefsLocales()[0];

    let i = 0;
    for (let test of data) {
        i++;
        let info = cal.l10n.calendarInfo(test.input.locale);
        equal(
            Object.keys(info).length,
            test.expected.properties.length,
            "expected number of attributes (test #" + i + ")"
        );
        for (let prop of test.expected.properties) {
            ok(prop in info, prop + " exists (test #" + i + ")");
        }

        if (!test.input.locale && appLocale != rsLocale) {
            // if aLoacle is null we test with the current date and time formatting setting
            // let's test the caching mechanism - this test section is pointless if app and
            // OS locale are the same like probably on automation
            Preferences.set("intl.regional_prefs.use_os_locales", !useOSLocaleFormat);
            let info2 = cal.l10n.calendarInfo();
            equal(
                Object.keys(info).length,
                test.expected.properties.length,
                "caching test - equal number of properties (test #" + i + ")"
            );
            for (let prop of Object.keys(info)) {
                ok(prop in info2,
                   "caching test - " + prop + " exists in both objects (test #" + i + ")");
                equal(
                    info2[prop],
                    info[prop],
                    "caching test - value for " + prop + " is equal in both objects (test #" + i + ")"
                );
            }
            // we reset the cache and test again - it's suffient here to find one changed property,
            // so we use locale since that must change always in that scenario
            info2 = cal.l10n.calendarInfo(null, true);
            Preferences.set("intl.regional_prefs.use_os_locales", useOSLocaleFormat);
            notEqual(
                info2.locale,
                info.locale,
                "caching retest - value for locale is different in both objects (test #" + i + ")"
            );
        }
    }
});
