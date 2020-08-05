/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

ChromeUtils.import("resource:///modules/imXPCOMUtils.jsm");
ChromeUtils.import("resource:///modules/jsProtoHelper.jsm");

XPCOMUtils.defineLazyGetter(this, "_", () =>
  l10nHelper("chrome://chat/locale/twitter.properties")
);

function Account(aProtocol, aImAccount)
{
  this._init(aProtocol, aImAccount);
}
Account.prototype = {
  __proto__: GenericAccountPrototype,

  connect: function() {
    this.WARN(
      "Twitter is no longer supported due to Twitter disabling the streaming " +
        "support in their API. See bug 1445778."
    );
    this.reportDisconnecting(
      Ci.prplIAccount.ERROR_OTHER_ERROR,
      _("twitter.disabled")
    );
    this.reportDisconnected();
  },

  // Nothing to do.
  // unInit() {},

};

function TwitterProtocol() {
  this.registerCommands();
}
TwitterProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get normalizedName() {
    return "twitter";
  },
  get name() {
    return _("twitter.protocolName");
  },
  get iconBaseURI() {
    return "chrome://prpl-twitter/skin/";
  },
  get noPassword() {
    return true;
  },
  getAccount(aImAccount) {
    return new Account(this, aImAccount);
  },
  classID: Components.ID("{31082ff6-1de8-422b-ab60-ca0ac0b2af13}"),
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([TwitterProtocol]);
