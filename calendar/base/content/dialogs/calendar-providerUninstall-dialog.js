/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported onLoad, onAccept, onCancel */

ChromeUtils.import("resource://calendar/modules/calUtils.jsm");

function onLoad() {
    let extension = window.arguments[0].extension;
    document.getElementById("provider-name-label").value = extension.name;

    let calendarList = document.getElementById("calendar-list");

    for (let calendar of cal.getCalendarManager().getCalendars({})) {
        if (calendar.providerID != extension.id) {
            continue;
        }

        let item = createXULElement("richlistitem");
        item.setAttribute("calendar-id", calendar.id);
        item.setAttribute("value", calendar.name);

        let checkbox = createXULElement("checkbox");
        checkbox.classList.add("calendar-selected");
        item.appendChild(checkbox);

        let image = createXULElement("image");
        image.classList.add("calendar-color");
        item.appendChild(image);
        image.style.backgroundColor = calendar.getProperty("color");

        let label = createXULElement("label");
        label.classList.add("calendar-name");
        label.setAttribute("value", calendar.name);
        item.appendChild(label);

        calendarList.appendChild(item);
    }
}

function onAccept() {
    // Tell our caller that the extension should be uninstalled.
    let args = window.arguments[0];
    args.shouldUninstall = true;

    let calendarList = document.getElementById("calendar-list");

    // Unsubscribe from all selected calendars
    let calMgr = cal.getCalendarManager();
    for (let item of calendarList.children) {
        if (item.querySelector(".calendar-selected").checked) {
            calMgr.unregisterCalendar(calMgr.getCalendarById(item.getAttribute("calendar-id")));
        }
    }
    return true;
}

function onCancel() {
    let args = window.arguments[0];
    args.shouldUninstall = false;

    return true;
}
