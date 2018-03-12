Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

// Import the required setup scripts.
load("../../../resources/abSetup.js");

do_register_cleanup(function() {
  load("../../../resources/mailShutdown.js");
});
