Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://testing-common/mailnews/mailTestUtils.js");

var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

var gDEPTH = "../../../../../";

// glodaTestHelper.js does all the rest of the imports

do_register_cleanup(function() {
  load(gDEPTH + "mailnews/resources/mailShutdown.js");
});
