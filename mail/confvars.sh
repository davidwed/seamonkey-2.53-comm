#! /bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

MOZ_APP_BASENAME=Thunderbird
MOZ_APP_NAME=thunderbird
MOZ_UPDATER=1
MOZ_THUNDERBIRD=1
MOZ_LDAP_XPCOM=1
MOZ_COMPOSER=1

if test "$OS_ARCH" = "WINNT" -o \
        "$OS_ARCH" = "Linux"; then
  MOZ_BUNDLED_FONTS=1
fi

if test "$OS_ARCH" = "WINNT"; then
  MOZ_MAINTENANCE_SERVICE=1
  if ! test "$HAVE_64BIT_BUILD"; then
    MOZ_VERIFY_MAR_SIGNATURE=1
  fi
fi

MOZ_MORK=1

MOZ_APP_VERSION_TXT=${_topsrcdir}/$MOZ_BUILD_APP/config/version.txt
MOZ_APP_VERSION=`cat $MOZ_APP_VERSION_TXT`
MOZ_APP_VERSION_DISPLAY_TXT=${_topsrcdir}/$MOZ_BUILD_APP/config/version_display.txt
MOZ_APP_VERSION_DISPLAY=`cat $MOZ_APP_VERSION_DISPLAY_TXT`
THUNDERBIRD_VERSION=$MOZ_APP_VERSION

MOZ_BRANDING_DIRECTORY=mail/branding/nightly
MOZ_OFFICIAL_BRANDING_DIRECTORY=other-licenses/branding/thunderbird
MOZ_APP_ID={3550f703-e582-4d05-9a08-453d09bdfdc6}
# This should usually be the same as the value MAR_CHANNEL_ID.
# If more than one ID is needed, then you should use a comma separated list
# of values.
ACCEPTED_MAR_CHANNEL_IDS=thunderbird-comm-release
# The MAR_CHANNEL_ID must not contain the following 3 characters: ",\t "
MAR_CHANNEL_ID=thunderbird-comm-release
MOZ_PROFILE_MIGRATOR=1
MOZ_BINARY_EXTENSIONS=1
MOZ_SEPARATE_MANIFEST_FOR_THEME_OVERRIDES=1

# Enable building ./signmar and running libmar signature tests
MOZ_ENABLE_SIGNMAR=1

MOZ_DEVTOOLS=all

NSS_EXTRA_SYMBOLS_FILE=${_topsrcdir}/../mailnews/nss-extra.symbols
