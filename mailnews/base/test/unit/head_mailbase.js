Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://testing-common/mailnews/mailTestUtils.js");
Cu.import("resource://testing-common/mailnews/localAccountUtils.js");

var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

var gDEPTH = "../../../../";

do_register_cleanup(function() {
  load(gDEPTH + "mailnews/resources/mailShutdown.js");
});
