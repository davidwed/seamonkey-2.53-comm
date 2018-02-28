var jum = {}; Cu.import('resource://mozmill/modules/jum.js', jum);

var testPythonCallPost = function() {
  var status = "post";
  mozmill.firePythonCallbackAfterRestart("postCallback", status);
}
