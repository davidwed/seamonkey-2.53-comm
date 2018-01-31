ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource://testing-common/mailnews/mailTestUtils.js");
ChromeUtils.import("resource://testing-common/mailnews/localAccountUtils.js");

var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();


do_register_cleanup(function() {
  load("../../../../../mailnews/resources/mailShutdown.js");
});
