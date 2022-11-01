/* -*- Mode: javascript; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 ; js-indent-level: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource:///modules/IOUtils.js");

var gDirTree;
var abList = null;
var gAbResultsTree = null;
var gAbView = null;
var gAddressBookBundle;
// A boolean variable determining whether AB column should be shown
// in Contacts Sidebar in compose window.
var gShowAbColumnInComposeSidebar = false;

var kDefaultSortColumn = "GeneratedName";
var kDefaultAscending = "ascending";
var kDefaultDescending = "descending";
// kDefaultYear will be used in birthday calculations when no year is given;
// this is a leap year so that Feb 29th works.
const kDefaultYear = nearestLeap(new Date().getFullYear());
const kMaxYear = 9999;
const kMinYear = 1;
var kAllDirectoryRoot = "moz-abdirectory://";
var kLdapUrlPrefix = "moz-abldapdirectory://";
var kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab";
var kCollectedAddressbookURI = "moz-abmdbdirectory://history.mab";
// The default, generic contact image is displayed via CSS when the photoURI is
// blank.
var defaultPhotoURI = "";

var PERMS_DIRECTORY = parseInt("0755", 8);

// Controller object for Dir Pane
var DirPaneController =
{
  supportsCommand: function(command)
  {
    switch (command) {
      case "cmd_selectAll":
      case "cmd_delete":
      case "button_delete":
      case "cmd_properties":
      case "cmd_abToggleStartupDir":
      case "cmd_printcard":
      case "cmd_printcardpreview":
      case "cmd_newlist":
      case "cmd_newCard":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    switch (command) {
      case "cmd_selectAll":
        // The gDirTree pane only handles single selection, but normally we
        // enable cmd_selectAll as it will get forwarded to the results pane.
        // But if there is no gAbView, disable as we can't forward to anywhere.
        return (gAbView != null);
      case "cmd_delete":
      case "button_delete": {
        let selectedDir = getSelectedDirectory();
        if (!selectedDir)
          return false;
        let selectedDirURI = selectedDir.URI;

        // Context-sensitive labels for Edit > Delete menuitem.
        // We only have ABs or Mailing Lists in the directory pane.
        // For contacts and mixed selections, the label is set in
        // ResultsPaneController in abResultsPane.js.
        if (command == "cmd_delete") {
          goSetMenuValue(command, selectedDir.isMailList ?
                                  "valueList" : "valueAddressBook");
        }

        // If it's one of these special ABs, return false to disable deletion.
        if (selectedDirURI == kPersonalAddressbookURI ||
            selectedDirURI == kCollectedAddressbookURI ||
            selectedDirURI == (kAllDirectoryRoot + "?"))
          return false;

        // If the directory is a mailing list, and it is read-only,
        // return false to disable deletion.
        if (selectedDir.isMailList && selectedDir.readOnly)
          return false;

        // If the selected directory is an ldap directory,
        // and if the prefs for this directory are locked,
        // return false to disable deletion.
        if (selectedDirURI.startsWith(kLdapUrlPrefix))
        {
          let disable = false;
          try {
            let prefName = selectedDirURI.substr(kLdapUrlPrefix.length);
            disable = Services.prefs.getBoolPref(prefName + ".disable_delete");
          }
          catch(ex) {
            // If this preference is not set, that's ok.
          }
          if (disable)
            return false;
        }

        // Else return true to enable deletion (default).
        return true;
      }
      case "cmd_printcard":
      case "cmd_printcardpreview":
        return (GetSelectedCardIndex() != -1);
      case "cmd_properties": {
        let labelAttr = "valueGeneric";
        let accKeyAttr = "valueGenericAccessKey";
        let tooltipTextAttr = "valueGenericTooltipText";
        let isMailList;
        let selectedDir = getSelectedDirectory();
        if (selectedDir) {
          isMailList = selectedDir.isMailList;
          labelAttr = isMailList ? "valueMailingList"
                                 : "valueAddressBook";
          accKeyAttr = isMailList ? "valueMailingListAccessKey"
                                  : "valueAddressBookAccessKey";
          tooltipTextAttr = isMailList ? "valueMailingListTooltipText"
                                       : "valueAddressBookTooltipText";
        }
        goSetLabelAccesskeyTooltiptext("cmd_properties-button", null, null,
          tooltipTextAttr);
        goSetLabelAccesskeyTooltiptext("cmd_properties-contextMenu",
          labelAttr, accKeyAttr);
        goSetLabelAccesskeyTooltiptext("cmd_properties-menu",
          labelAttr, accKeyAttr);
        return (selectedDir != null);
      }
      case "cmd_abToggleStartupDir":
        return !!getSelectedDirectoryURI();
      case "cmd_newlist":
      case "cmd_newCard":
        return true;
      default:
        return false;
    }
  },

  doCommand: function(command)
  {
    switch (command) {
      case "cmd_printcard":
      case "cmd_printcardpreview":
      case "cmd_selectAll":
        SendCommandToResultsPane(command);
        break;
      case "cmd_delete":
      case "button_delete":
        if (gDirTree)
          AbDeleteSelectedDirectory();
        break;
      case "cmd_properties":
        AbEditSelectedDirectory();
        break;
      case "cmd_abToggleStartupDir":
        abToggleSelectedDirStartup();
        break;
      case "cmd_newlist":
        AbNewList();
        break;
      case "cmd_newCard":
        AbNewCard();
        break;
    }
  },

  onEvent: function(event)
  {
    // on blur events set the menu item texts back to the normal values
    if (event == "blur")
      goSetMenuValue("cmd_delete", "valueDefault");
  }
};

function SendCommandToResultsPane(command)
{
  ResultsPaneController.doCommand(command);

  // if we are sending the command so the results pane
  // we should focus the results pane
  gAbResultsTree.focus();
}

function AbNewLDAPDirectory()
{
  window.openDialog("chrome://messenger/content/addressbook/pref-directory-add.xul",
                    "",
                    "chrome,modal,resizable=no,centerscreen",
                    null);
}

function AbNewAddressBook()
{
  window.openDialog("chrome://messenger/content/addressbook/abAddressBookNameDialog.xul",
                    "",
                    "chrome,modal,resizable=no,centerscreen",
                    null);
}

function AbEditSelectedDirectory()
{
  let selectedDir = getSelectedDirectory();
  if (!selectedDir)
    return;

  if (selectedDir.isMailList) {
    goEditListDialog(null, selectedDir.URI);
  } else {
    window.openDialog(selectedDir.propertiesChromeURI,
                      "",
                      "chrome,modal,resizable=no,centerscreen",
                      {selectedDirectory: selectedDir});
  }
}

function updateDirTreeContext() {
  let startupItem = document.getElementById("dirTreeContext-startupDir");
  if (Services.prefs.getBoolPref("mail.addr_book.view.startupURIisDefault")) {
    let startupURI = Services.prefs.getCharPref("mail.addr_book.view.startupURI");
    let selectedDirURI = getSelectedDirectoryURI();
    startupItem.setAttribute("checked", (startupURI == selectedDirURI));
  } else {
    startupItem.setAttribute("checked", "false");
  }
}

function abToggleSelectedDirStartup()
{
  let selectedDirURI = getSelectedDirectoryURI();
  if (!selectedDirURI)
    return;

  let isDefault = Services.prefs.getBoolPref("mail.addr_book.view.startupURIisDefault");
  let startupURI = Services.prefs.getCharPref("mail.addr_book.view.startupURI");

  if (isDefault && (startupURI == selectedDirURI)) {
    // The current directory has been the default startup view directory;
    // toggle that off now. So there's no default startup view directory any more.
    Services.prefs.setBoolPref("mail.addr_book.view.startupURIisDefault", false);
  } else {
    // The current directory will now be the default view
    // when starting up the main AB window.
    Services.prefs.setCharPref("mail.addr_book.view.startupURI", selectedDirURI);
    Services.prefs.setBoolPref("mail.addr_book.view.startupURIisDefault", true);
  }

  // Update the checkbox in the menuitem.
  goUpdateCommand("cmd_abToggleStartupDir");
}

function AbDeleteSelectedDirectory()
{
  let selectedDirURI = getSelectedDirectoryURI();
  if (!selectedDirURI)
    return;

  AbDeleteDirectory(selectedDirURI);
}

function AbDeleteDirectory(aURI)
{
  // Determine strings for smart and context-sensitive user prompts
  // for confirming deletion.
  let directory = GetDirectoryFromURI(aURI);
  let confirmDeleteTitleID;
  let confirmDeleteTitle;
  let confirmDeleteMessageID;
  let confirmDeleteMessage;
  let brandShortName;
  let clearCollectionPrefs = false;

  if (directory.isMailList) {
    // It's a mailing list.
    confirmDeleteMessageID = "confirmDeleteThisMailingList";
    confirmDeleteTitleID = "confirmDeleteThisMailingListTitle";
  } else {
    // It's an address book: check which type.
    if (Services.prefs.getCharPref("mail.collect_addressbook") == aURI &&
        Services.prefs.getBoolPref("mail.collect_email_address_outgoing")) {
      // It's a collection address book: let's be clear about the consequences.
      brandShortName = document.getElementById("bundle_brand").getString("brandShortName");
      confirmDeleteMessageID = "confirmDeleteThisCollectionAddressbook";
      confirmDeleteTitleID = "confirmDeleteThisCollectionAddressbookTitle";
      clearCollectionPrefs = true;
    } else if (directory.URI.startsWith(kLdapUrlPrefix)) {
      // It's an LDAP directory, so we only delete our offline copy.
      confirmDeleteMessageID = "confirmDeleteThisLDAPDir";
      confirmDeleteTitleID = "confirmDeleteThisLDAPDirTitle";
    } else {
      // It's a normal personal address book: we'll delete its contacts, too.
      confirmDeleteMessageID = "confirmDeleteThisAddressbook";
      confirmDeleteTitleID = "confirmDeleteThisAddressbookTitle";
    }
  }

  // Get the raw strings with placeholders.
  confirmDeleteTitle   = gAddressBookBundle.getString(confirmDeleteTitleID);
  confirmDeleteMessage = gAddressBookBundle.getString(confirmDeleteMessageID);

  // Substitute placeholders as required.
  // Replace #1 with the name of the selected address book or mailing list.
  confirmDeleteMessage = confirmDeleteMessage.replace("#1", directory.dirName);
  if (brandShortName) {
    // For a collection address book, replace #2 with the brandShortName.
    confirmDeleteMessage = confirmDeleteMessage.replace("#2", brandShortName);
  }

  // Ask for confirmation before deleting
  if (!Services.prompt.confirm(window, confirmDeleteTitle,
                                       confirmDeleteMessage)) {
    // Deletion cancelled by user.
    return;
  }

  // If we're about to delete the collection AB, update the respective prefs.
  if (clearCollectionPrefs) {
    Services.prefs.setBoolPref("mail.collect_email_address_outgoing", false);

    // Change the collection AB pref to "Personal Address Book" so that we
    // don't get a blank item in prefs dialog when collection is re-enabled.
    Services.prefs.setCharPref("mail.collect_addressbook", kPersonalAddressbookURI);
  }

  MailServices.ab.deleteAddressBook(aURI);
}

function GetParentRow(aTree, aRow)
{
  var row = aRow;
  var level = aTree.view.getLevel(row);
  var parentLevel = level;
  while (parentLevel >= level) {
    row--;
    if (row == -1)
      return row;
    parentLevel = aTree.view.getLevel(row);
  }
  return row;
}

function InitCommonJS()
{
  gDirTree = document.getElementById("dirTree");
  abList = document.getElementById("addressbookList");
  gAddressBookBundle = document.getElementById("bundle_addressBook");

  // Make an entry for "All Address Books".
  if (abList) {
    abList.insertItemAt(0, gAddressBookBundle.getString("allAddressBooks"),
                        kAllDirectoryRoot + "?");
  }
}

function AbDelete()
{
  let types = GetSelectedCardTypes();
  if (types == kNothingSelected)
    return;

  // Determine strings for smart and context-sensitive user prompts
  // for confirming deletion.
  let confirmDeleteTitleID;
  let confirmDeleteTitle;
  let confirmDeleteMessageID;
  let confirmDeleteMessage;
  let itemName;
  let containingListName;
  let selectedDir = getSelectedDirectory();
  let numSelectedItems = gAbView.selection.count;

  switch(types) {
    case kListsAndCards:
      confirmDeleteMessageID = "confirmDelete2orMoreContactsAndLists";
      confirmDeleteTitleID   = "confirmDelete2orMoreContactsAndListsTitle";
      break;
    case kSingleListOnly:
      // Set item name for single mailing list.
      let theCard = GetSelectedAbCards()[0];
      itemName = theCard.displayName;
      confirmDeleteMessageID = "confirmDeleteThisMailingList";
      confirmDeleteTitleID   = "confirmDeleteThisMailingListTitle";
      break;
    case kMultipleListsOnly:
      confirmDeleteMessageID = "confirmDelete2orMoreMailingLists";
      confirmDeleteTitleID   = "confirmDelete2orMoreMailingListsTitle";
      break;
    case kCardsOnly:
      if (selectedDir.isMailList) {
        // Contact(s) in mailing lists will be removed from the list, not deleted.
        if (numSelectedItems == 1) {
          confirmDeleteMessageID = "confirmRemoveThisContact";
          confirmDeleteTitleID = "confirmRemoveThisContactTitle";
        } else {
          confirmDeleteMessageID = "confirmRemove2orMoreContacts";
          confirmDeleteTitleID   = "confirmRemove2orMoreContactsTitle";
        }
        // For removing contacts from mailing list, set placeholder value
        containingListName = selectedDir.dirName;
      } else {
        // Contact(s) in address books will be deleted.
        if (numSelectedItems == 1) {
          confirmDeleteMessageID = "confirmDeleteThisContact";
          confirmDeleteTitleID   = "confirmDeleteThisContactTitle";
        } else {
          confirmDeleteMessageID = "confirmDelete2orMoreContacts";
          confirmDeleteTitleID   = "confirmDelete2orMoreContactsTitle";
        }
      }
      if (numSelectedItems == 1) {
        // Set item name for single contact.
        let theCard = GetSelectedAbCards()[0];
        let nameFormatFromPref = Services.prefs.getIntPref("mail.addr_book.lastnamefirst");
        itemName = theCard.generateName(nameFormatFromPref);
      }
      break;
  }

  // Get the raw model strings.
  // For numSelectedItems == 1, it's simple strings.
  // For messages with numSelectedItems > 1, it's multi-pluralform string sets.
  // confirmDeleteMessage has placeholders for some forms.
  confirmDeleteTitle   = gAddressBookBundle.getString(confirmDeleteTitleID);
  confirmDeleteMessage = gAddressBookBundle.getString(confirmDeleteMessageID);

  // Get plural form where applicable; substitute placeholders as required.
  if (numSelectedItems == 1) {
    // If single selected item, substitute itemName.
    confirmDeleteMessage = confirmDeleteMessage.replace("#1", itemName);
  } else {
    // If multiple selected items, get the right plural string from the
    // localized set, then substitute numSelectedItems.
    confirmDeleteMessage = PluralForm.get(numSelectedItems, confirmDeleteMessage);
    confirmDeleteMessage = confirmDeleteMessage.replace("#1", numSelectedItems);
  }
  // If contact(s) in a mailing list, substitute containingListName.
  if (containingListName)
    confirmDeleteMessage = confirmDeleteMessage.replace("#2", containingListName);

  // Finally, show our smart confirmation message, and act upon it!
  if (!Services.prompt.confirm(window, confirmDeleteTitle,
                                       confirmDeleteMessage)) {
    // Deletion cancelled by user.
    return;
  }

  if (selectedDir.URI == (kAllDirectoryRoot + "?")) {
    // Delete cards from "All Address Books" view.
    let cards = GetSelectedAbCards();
    for (let i = 0; i < cards.length; i++) {
      let dirId = cards[i].directoryId
                          .substring(0, cards[i].directoryId.indexOf("&"));
      let directory = MailServices.ab.getDirectoryFromId(dirId);

      let cardArray =
        Cc["@mozilla.org/array;1"]
          .createInstance(Ci.nsIMutableArray);
      cardArray.appendElement(cards[i]);
      if (directory)
        directory.deleteCards(cardArray);
    }
    SetAbView(kAllDirectoryRoot + "?");
  } else {
    // Delete cards from address books or mailing lists.
    gAbView.deleteSelectedCards();
  }
}

function AbNewCard()
{
  goNewCardDialog(getSelectedDirectoryURI());
}

function AbEditCard(card)
{
  // Need a card,
  // but not allowing AOL special groups to be edited.
  if (!card)
    return;

  if (card.isMailList) {
    goEditListDialog(card, card.mailListURI);
  }
  else {
    goEditCardDialog(getSelectedDirectoryURI(), card);
  }
}

function AbNewMessage()
{
  let msgComposeType = Ci.nsIMsgCompType;
  let msgComposeFormat = Ci.nsIMsgCompFormat;

  let params = Cc["@mozilla.org/messengercompose/composeparams;1"].createInstance(Ci.nsIMsgComposeParams);
  if (params) {
    params.type = msgComposeType.New;
    params.format = msgComposeFormat.Default;
    let composeFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
    if (composeFields) {
      if (DirPaneHasFocus()) {
        let selectedDir = getSelectedDirectory();
        let hidesRecipients = false;
        try {
          // This is a bit of hackery so that extensions can have mailing lists
          // where recipients are sent messages via BCC.
          hidesRecipients = selectedDir.getBoolValue("HidesRecipients", false);
        } catch(e) {
          // Standard Thunderbird mailing lists do not have preferences
          // associated with them, so we'll silently eat the error.
        }

        if (selectedDir && selectedDir.isMailList && hidesRecipients)
          // Bug 669301 (https://bugzilla.mozilla.org/show_bug.cgi?id=669301)
          // We're using BCC right now to hide recipients from one another.
          // We should probably use group syntax, but that's broken
          // right now, so this will have to do.
          composeFields.bcc = GetSelectedAddressesFromDirTree();
        else
          composeFields.to = GetSelectedAddressesFromDirTree();
      } else {
        composeFields.to = GetSelectedAddresses();
      }
      params.composeFields = composeFields;
      MailServices.compose.OpenComposeWindowWithParams(null, params);
    }
  }
}

/**
 * Set up items in the View > Layout menupopup.  This function is responsible
 * for updating the menu items' state to reflect reality.
 *
 * @param event the event that caused the View > Layout menupopup to be shown
 */
function InitViewLayoutMenuPopup(event) {
  let dirPaneMenuItem = document.getElementById("menu_showDirectoryPane");
  dirPaneMenuItem.setAttribute("checked", document.getElementById(
    "dirTree-splitter").getAttribute("state") != "collapsed");

  let cardPaneMenuItem = document.getElementById("menu_showCardPane");
  cardPaneMenuItem.setAttribute("checked", document.getElementById(
    "results-splitter").getAttribute("state") != "collapsed");
}

// Generate a list of cards from the selected mailing list
// and get a comma separated list of card addresses. If the
// item selected in the directory pane is not a mailing list,
// an empty string is returned.
function GetSelectedAddressesFromDirTree()
{
  let selectedDir = getSelectedDirectory();

  if (!selectedDir || !selectedDir.isMailList)
    return "";

  let listCardsCount = selectedDir.addressLists.length;
  let cards = new Array(listCardsCount);
  for (let i = 0; i < listCardsCount; ++i)
    cards[i] = selectedDir.addressLists
                 .queryElementAt(i, Ci.nsIAbCard);
  return GetAddressesForCards(cards);
}

// Generate a comma separated list of addresses from a given
// set of cards.
function GetAddressesForCards(cards)
{
  var addresses = "";

  if (!cards) {
    Cu.reportError("GetAddressesForCards: |cards| is null.");
    return addresses;
  }

  var count = cards.length;

  // We do not handle the case where there is one or more null-ish
  // element in the Array.  Always non-null element is pushed into
  // cards[] array.

  let generatedAddresses = cards.map(GenerateAddressFromCard)
    .filter(function(aAddress) {
      return aAddress;
    });
  return generatedAddresses.join(',');
}

function SelectFirstAddressBook()
{
  if (gDirTree.view.selection.currentIndex != 0) {
    gDirTree.view.selection.select(0);
    // If gPreviousDirTreeIndex == 0 then DirPaneSelectionChange() and
    // ChangeDirectoryByURI() have already been run
    // (e.g. by the onselect event on the tree) so skip the call.
    if (gPreviousDirTreeIndex != 0)
      ChangeDirectoryByURI(getSelectedDirectoryURI());
  }
  gAbResultsTree.focus();
}

/**
 * Get the startup view directory from pref and select it in the
 * directory tree so that it gets shown.
 */
function selectStartupViewDirectory()
{
  let startupURI = Services.prefs.getCharPref("mail.addr_book.view.startupURI");
  if (!startupURI) {
    // If pref is empty, fall back to "All Address Books" root directory.
    startupURI = kAllDirectoryRoot + "?"
  }
  let startupDirTreeIndex = gDirectoryTreeView.getIndexForId(startupURI);
  // XXX TODO: If directory of startupURI is collapsed, we fail to find and
  // select it, so getIndexForId returns -1; for now, fall back to "All Address
  // Books" root directory.
  // We also end up here and redirect to "All ABs" root when default directory
  // is not found because it has been deleted; after fixing the collapsed case,
  // deletion will be the only case to end up here, then we could reset the pref
  // here (somewhat lazy and fuzzy).
  if (startupDirTreeIndex == -1) {
    startupDirTreeIndex = gDirectoryTreeView.getIndexForId(kAllDirectoryRoot + "?");
  }
  gDirectoryTreeView.selection.select(startupDirTreeIndex);
}

function DirPaneClick(event)
{
  // we only care about left button events
  if (event.button != 0)
    return;

  // if the user clicks on the header / trecol, do nothing
  if (event.originalTarget.localName == "treecol") {
    event.stopPropagation();
    return;
  }
}

function DirPaneDoubleClick(event)
{
  // We only care about left button events.
  if (event.button != 0)
    return;

  // Ignore double clicking on invalid rows.
  let row = gDirTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
  if (row == -1 || row > gDirTree.view.rowCount-1)
    return;

  // Default action for double click is expand/collapse which ships with the tree.
  // For convenience, allow double-click to edit the properties of mailing
  // lists in directory tree.
  if (gDirTree && gDirTree.view.selection &&
      gDirTree.view.selection.count == 1 &&
      getSelectedDirectory().isMailList) {
    AbEditSelectedDirectory();
  }
}

function DirPaneSelectionChange()
{
  let uri = getSelectedDirectoryURI();
  // clear out the search box when changing folders...
  onAbClearSearch(false);
  if (gDirTree && gDirTree.view.selection && gDirTree.view.selection.count == 1) {
    gPreviousDirTreeIndex = gDirTree.currentIndex;
    ChangeDirectoryByURI(uri);
    document.getElementById("localResultsOnlyMessage")
            .setAttribute("hidden",
                          !gDirectoryTreeView.hasRemoteAB ||
                          uri != kAllDirectoryRoot + "?");
  }

  goUpdateCommand('cmd_newlist');
  goUpdateCommand('cmd_newCard');
}

function ChangeDirectoryByURI(uri = kPersonalAddressbookURI)
{
  SetAbView(uri);

  // Actively de-selecting if there are any pre-existing selections
  // in the results list.
  if (gAbView && gAbView.getCardFromRow(0))
    gAbView.selection.clearSelection();
  else
    // the selection changes if we were switching directories.
    ResultsPaneSelectionChanged()
}

function AbNewList()
{
  goNewListDialog(getSelectedDirectoryURI());
}

function goNewListDialog(selectedAB)
{
  window.openDialog("chrome://messenger/content/addressbook/abMailListDialog.xul",
                    "",
                    "chrome,modal,resizable=no,centerscreen",
                    {selectedAB:selectedAB});
}

function goEditListDialog(abCard, listURI)
{
  let params = {
    abCard: abCard,
    listURI: listURI,
    refresh: false, // This is an out param, true if OK in dialog is clicked.
  };
  window.openDialog("chrome://messenger/content/addressbook/abEditListDialog.xul",
                    "",
                    "chrome,modal,resizable=no,centerscreen",
                    params);
  if (params.refresh) {
    ChangeDirectoryByURI(listURI); // force refresh
  }
}

function goNewCardDialog(selectedAB)
{
  window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                    "",
                    "chrome,modal,resizable=no,centerscreen",
                    {selectedAB:selectedAB});
}

function goEditCardDialog(abURI, card)
{
  window.openDialog("chrome://messenger/content/addressbook/abEditCardDialog.xul",
                    "",
                    "chrome,modal,resizable=no,centerscreen",
                    {abURI:abURI, card:card});
}

function setSortByMenuItemCheckState(id, value)
{
    var menuitem = document.getElementById(id);
    if (menuitem) {
      menuitem.setAttribute("checked", value);
    }
}

function InitViewSortByMenu()
{
    var sortColumn = kDefaultSortColumn;
    var sortDirection = kDefaultAscending;

    if (gAbView) {
      sortColumn = gAbView.sortColumn;
      sortDirection = gAbView.sortDirection;
    }

    // this approach is necessary to support generic columns that get overlaid.
    let elements = document.querySelectorAll('[name="sortas"]');
    for (let i = 0; i < elements.length; i++) {
      let cmd = elements[i].id;
      let columnForCmd = cmd.substr(10); // everything right of cmd_SortBy
      setSortByMenuItemCheckState(cmd, (sortColumn == columnForCmd));
    }

    setSortByMenuItemCheckState("sortAscending", (sortDirection == kDefaultAscending));
    setSortByMenuItemCheckState("sortDescending", (sortDirection == kDefaultDescending));
}

function GenerateAddressFromCard(card)
{
  if (!card)
    return "";

  var email;

  if (card.isMailList)
  {
    var directory = GetDirectoryFromURI(card.mailListURI);
    email = directory.description || card.displayName;
  }
  else
    email = card.primaryEmail;

  return MailServices.headerParser.makeMimeAddress(card.displayName, email);
}

function GetDirectoryFromURI(uri)
{
  return MailServices.ab.getDirectory(uri);
}

// returns null if abURI is not a mailing list URI
function GetParentDirectoryFromMailingListURI(abURI)
{
  var abURIArr = abURI.split("/");
  /*
   turn turn "moz-abmdbdirectory://abook.mab/MailList6"
   into ["moz-abmdbdirectory:","","abook.mab","MailList6"]
   then, turn ["moz-abmdbdirectory:","","abook.mab","MailList6"]
   into "moz-abmdbdirectory://abook.mab"
  */
  if (abURIArr.length == 4 && abURIArr[0] == "moz-abmdbdirectory:" && abURIArr[3] != "") {
    return abURIArr[0] + "/" + abURIArr[1] + "/" + abURIArr[2];
  }

  return null;
}

/**
 * Return true if the directory pane has focus, otherwise false.
 */
function DirPaneHasFocus()
{
  return (top.document.commandDispatcher.focusedElement == gDirTree);
}

/**
 * Get the selected directory object.
 *
 * @return The object of the currently selected directory
 */
function getSelectedDirectory()
{
  // Contacts Sidebar
  if (abList)
    return MailServices.ab.getDirectory(abList.value);

  // Main Address Book
  if (gDirTree.currentIndex < 0)
    return null;
  return gDirectoryTreeView.getDirectoryAtIndex(gDirTree.currentIndex);
}

/**
 * Get the URI of the selected directory.
 *
 * @return The URI of the currently selected directory
 */
function getSelectedDirectoryURI()
{
  // Contacts Sidebar
  if (abList)
    return abList.value;

  // Main Address Book
  if (gDirTree.currentIndex < 0)
    return null;
  return gDirectoryTreeView.getDirectoryAtIndex(gDirTree.currentIndex).URI;
}

/**
 * DEPRECATED legacy function wrapper for addon compatibility;
 * use getSelectedDirectoryURI() instead!
 * Return the URI of the selected directory.
 */
function GetSelectedDirectory()
{
  return getSelectedDirectoryURI();
}

/**
 * Clears the contents of the search input field,
 * possibly causing refresh of results.
 *
 * @param aRefresh  Set to false if the refresh isn't needed,
 *                  e.g. window/AB is going away so user will not see anything.
 */
function onAbClearSearch(aRefresh = true)
{
  let searchInput = document.getElementById("peopleSearchInput");
  if (!searchInput || !searchInput.value)
    return;

  searchInput.value = "";
  if (aRefresh)
    onEnterInSearchBar();
}

// sets focus into the quick search box
function QuickSearchFocus()
{
  let searchInput = document.getElementById("peopleSearchInput");
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

/**
 * Returns an nsIFile of the directory in which contact photos are stored.
 * This will create the directory if it does not yet exist.
 */
function getPhotosDir() {
  let file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  // Get the Photos directory
  file.append("Photos");
  if (!file.exists() || !file.isDirectory())
    file.create(Ci.nsIFile.DIRECTORY_TYPE, PERMS_DIRECTORY);
  return file;
}

/**
 * Returns a URI specifying the location of a photo based on its name.
 * If the name is blank, or if the photo with that name is not in the Photos
 * directory then the default photo URI is returned.
 *
 * @param aPhotoName The name of the photo from the Photos folder, if any.
 *
 * @return A URI pointing to a photo.
 */
function getPhotoURI(aPhotoName) {
  if (!aPhotoName)
    return defaultPhotoURI;
  var file = getPhotosDir();
  try {
    file.append(aPhotoName);
  }
  catch (e) {
    return defaultPhotoURI;
  }
  if (!file.exists())
    return defaultPhotoURI;
  return Services.io.newFileURI(file).spec;
}

/**
 * Copies the photo at the given URI in a folder named "Photos" in the current
 * profile folder.
 * The filename is randomly generated and is unique.
 * The URI is used to obtain a channel which is then opened synchronously and
 * this stream is written to the new file to store an offline, local copy of the
 * photo.
 *
 * @param aUri The URI of the photo.
 *
 * @return An nsIFile representation of the photo.
 */
function storePhoto(aUri)
{
  if (!aUri)
    return false;

  // Get the photos directory and check that it exists
  let file = getPhotosDir();

  // Create a channel from the URI and open it as an input stream
  let channel = Services.io.newChannelFromURI2(Services.io.newURI(aUri),
                                               null,
                                               Services.scriptSecurityManager.getSystemPrincipal(),
                                               null,
                                               Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL,
                                               Ci.nsIContentPolicy.TYPE_OTHER);
  let istream = channel.open();

  // Get the photo file
  file = makePhotoFile(file, findPhotoExt(channel));

  return IOUtils.saveStreamToFile(istream, file);
}

/**
 * Finds the file extension of the photo identified by the URI, if possible.
 * This function can be overridden (with a copy of the original) for URIs that
 * do not identify the extension or when the Content-Type response header is
 * either not set or isn't 'image/png', 'image/jpeg', or 'image/gif'.
 * The original function can be called if the URI does not match.
 *
 * @param aUri The URI of the photo.
 * @param aChannel The opened channel for the URI.
 *
 * @return The extension of the file, if any, including the period.
 */
function findPhotoExt(aChannel) {
  var mimeSvc = Cc["@mozilla.org/mime;1"]
                  .getService(Ci.nsIMIMEService);
  var ext = "";
  var uri = aChannel.URI;
  if (uri instanceof Ci.nsIURL)
    ext = uri.fileExtension;
  try {
    return mimeSvc.getPrimaryExtension(aChannel.contentType, ext);
  } catch (e) {}
  return ext;
}

/**
 * Generates a unique filename to be used for a local copy of a contact's photo.
 *
 * @param aPath      The path to the folder in which the photo will be saved.
 * @param aExtension The file extension of the photo.
 *
 * @return A unique filename in the given path.
 */
function makePhotoFile(aDir, aExtension) {
  var filename, newFile;
  // Find a random filename for the photo that doesn't exist yet
  do {
    filename = new String(Math.random()).replace("0.", "") + "." + aExtension;
    newFile = aDir.clone();
    newFile.append(filename);
  } while (newFile.exists());
  return newFile;
}

/**
 * Validates the given year and returns it, if it looks sane.
 * Returns kDefaultYear (a leap year), if no valid date is given.
 * This ensures that month/day calculations still work.
 */
function saneBirthYear(aYear) {
  return aYear && (aYear <= kMaxYear) && (aYear >= kMinYear) ? aYear : kDefaultYear;
}

/**
 * Returns the nearest leap year before aYear.
 */
function nearestLeap(aYear) {
  for (let year = aYear; year > 0; year--) {
    if (new Date(year, 1, 29).getMonth() == 1)
      return year;
  }
  return 2000;
}

/**
 * Sets the label, accesskey, and tooltiptext attributes of an element from
 * custom attributes of the same element. Typically, the element will be a
 * command or broadcaster element. JS does not allow omitting function arguments
 * in the middle of the arguments list, so in that case, please pass an explicit
 * falsy argument like null or undefined instead; the respective attributes will
 * not be touched. Empty strings ("") from custom attributes will be applied
 * correctly. Hacker's shortcut: Passing empty string ("") for any of the custom
 * attribute names will also set the respective main attribute to empty string ("").
 * Examples:
 *
 * goSetLabelAccesskeyTooltiptext("cmd_foo", "valueFlavor", "valueFlavorAccesskey");
 * goSetLabelAccesskeyTooltiptext("cmd_foo", "valueFlavor", "valueFlavorAccesskey",
 *                                           "valueFlavorTooltiptext");
 * goSetLabelAccesskeyTooltiptext("cmd_foo", null, null, "valueFlavorTooltiptext");
 * goSetLabelAccesskeyTooltiptext("cmd_foo", "", "", "valueFlavorTooltiptext");
 *
 * @param aID                    the ID of an XUL element (attribute source and target)
 * @param aLabelAttribute        (optional) the name of a custom label attribute of aID, or ""
 * @param aAccessKeyAttribute    (optional) the name of a custom accesskey attribute of aID, or ""
 * @param aTooltipTextAttribute  (optional) the name of a custom tooltiptext attribute of aID, or ""
 */
function goSetLabelAccesskeyTooltiptext(aID, aLabelAttribute, aAccessKeyAttribute,
                                             aTooltipTextAttribute)
{
  let node = top.document.getElementById(aID);
  if (!node) {
    // tweak for composition's abContactsPanel
    node = document.getElementById(aID);
  }
  if (!node)
    return;

  for (let [attr, customAttr] of [["label",       aLabelAttribute      ],
                                  ["accesskey",   aAccessKeyAttribute  ],
                                  ["tooltiptext", aTooltipTextAttribute]]) {
    if (customAttr) {
      // In XUL (DOM Level 3), getAttribute() on non-existing attributes returns
      // "" (instead of null), which is indistinguishable from existing valid
      // attributes with value="", so we have to check using hasAttribute().
      if (node.hasAttribute(customAttr)) {
        let value = node.getAttribute(customAttr);
        node.setAttribute(attr, value);
      } else {  // missing custom attribute
        dump('Something wrong here: goSetLabelAccesskeyTooltiptext("' + aID + '", ...): ' +
             'Missing custom attribute: ' + customAttr + '\n');
      }
    } else if (customAttr === "") {
      node.removeAttribute(attr);
    }
  }
}
