# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# NOTE: The packager is not only used in calendar/lightning but should be
# general enough to be able to repackage other sub-extensions like
# calendar/providers/gdata. This means no lightning-specific files, no version
# numbers directly from lightning and be careful with relative paths.

# This packager can be used to repackage extensions. To use it, set the
# following variables in your Makefile, then include this file.
#   XPI_NAME = lightning # The extension path name
#   XPI_PKGNAME = lightning-2.2.en-US.mac # The extension package name
#   XPI_VERSION = 2.2 # The extension version
#
# For the upload target to work, you also need to set:
#   LIGHTNING_VERSION = 2.2  # Will be used to replace the Thunderbird version
#   						 # in POST_UPLOAD_CMD

include $(MOZILLA_SRCDIR)/toolkit/mozapps/installer/package-name.mk

XPI_STAGE_PATH = $(DIST)/xpi-stage
_ABS_XPI_STAGE_PATH = $(ABS_DIST)/xpi-stage
ENUS_PKGNAME=$(subst .$(AB_CD),.en-US,$(XPI_PKGNAME))
XPI_ZIP_IN=$(_ABS_XPI_STAGE_PATH)/$(ENUS_PKGNAME).xpi

$(XPI_STAGE_PATH):
	mkdir -p $@

$(XPI_ZIP_IN): ensure-stage-dir

# Target Directory used for the l10n files
L10N_TARGET = $(XPI_STAGE_PATH)/$(XPI_NAME)-$(AB_CD)

# We're unpacking directly into FINAL_TARGET, this keeps code to do manual
# repacks cleaner.
unpack: $(XPI_ZIP_IN)
	if test -d $(XPI_STAGE_PATH)/$(XPI_NAME); then \
	  $(RM) -r -v $(XPI_STAGE_PATH)/$(XPI_NAME); \
	fi
	$(NSINSTALL) -D $(XPI_STAGE_PATH)/$(XPI_NAME)
	cd $(XPI_STAGE_PATH)/$(XPI_NAME) && $(UNZIP) $(XPI_ZIP_IN)
	@echo done unpacking

# Nothing to package for en-US, its just the usual english xpi
langpack-en-US:
	@echo "Skipping $@ as en-US is the default"

merge-%: AB_CD=$*
merge-%:
	$(RM) -rf $(REAL_LOCALE_MERGEDIR)/calendar
	$(MOZILLA_SRCDIR)/mach compare-locales \
	    --merge $(REAL_LOCALE_MERGEDIR)/.. \
	    $(commtopsrcdir)/calendar/locales/l10n.toml \
	    $(L10NBASEDIR) \
	    $*

	# This file requires a bugfix with string changes, see bug 1154448
	[ -f $(L10NBASEDIR)/$*/calendar/chrome/calendar/calendar-extract.properties ] && \
	  $(RM) $(REAL_LOCALE_MERGEDIR)/calendar/chrome/calendar/calendar-extract.properties \
	  || true

# Calling these targets with prerequisites causes the libs and subsequent
# targets to be switched in order due to some make voodoo. Therefore we call
# the targets explicitly, which seems to work better. Also, the
# target-specific variable are not expanded for dependent targets.
langpack-%: L10N_XPI_NAME=$(XPI_NAME)-$*
langpack-%: L10N_XPI_PKGNAME=$(subst $(AB_CD),$*,$(XPI_PKGNAME))
langpack-%: AB_CD=$*
langpack-%:
	$(MAKE) AB_CD=$(AB_CD) ensure-stage-dir
	$(MAKE) L10N_XPI_NAME=$(L10N_XPI_NAME) L10N_XPI_PKGNAME=$(L10N_XPI_PKGNAME) AB_CD=$(AB_CD) \
	  repack-stage repack-process-extrafiles libs-$(AB_CD)
	@echo "Done packaging $(L10N_XPI_PKGNAME).xpi"

clobber-%: AB_CD=$*
clobber-%:
	$(RM) -r $(L10N_TARGET)

repackage-zip-%:
	@echo "Already repackaged zip for $* in langpack step"

repack-stage:
	@echo "Repackaging $(XPI_PKGNAME) locale for Language $(AB_CD)"
	$(RM) -rf $(L10N_TARGET)
	cp -R $(XPI_STAGE_PATH)/$(XPI_NAME) $(L10N_TARGET)
	grep -v '^locale [a-z\-]\+ en-US' $(L10N_TARGET)/chrome.manifest > $(L10N_TARGET)/chrome.manifest~ && \
	  mv $(L10N_TARGET)/chrome.manifest~ $(L10N_TARGET)/chrome.manifest
	find $(abspath $(L10N_TARGET)) -name '*en-US*' -print0 | xargs -0 rm -rf


# Actual locale packaging targets. If L10N_XPI_NAME is set, then use it.
# Otherwise keep the original XPI_NAME
# Overriding the final target is a bit of a hack for universal builds
# so that we can ensure we get the right xpi that gets repacked.
libs-%: FINAL_XPI_NAME=$(if $(L10N_XPI_NAME),$(L10N_XPI_NAME),$(XPI_NAME))
libs-%: FINAL_XPI_PKGNAME=$(if $(L10N_XPI_PKGNAME),$(L10N_XPI_PKGNAME),$(XPI_PKGNAME))
libs-%: AB_CD=$*
libs-%:
	@$(MAKE) merge-$*
	$(MAKE) -C locales libs AB_CD=$* FINAL_TARGET=$(ABS_DIST)/xpi-stage/$(FINAL_XPI_NAME) \
	  XPI_NAME=$(FINAL_XPI_NAME) XPI_PKGNAME=$(FINAL_XPI_PKGNAME) USE_EXTENSION_MANIFEST=1
	$(MAKE) -C locales tools AB_CD=$* FINAL_TARGET=$(ABS_DIST)/xpi-stage/$(FINAL_XPI_NAME) \
	  XPI_NAME=$(FINAL_XPI_NAME) XPI_PKGNAME=$(FINAL_XPI_PKGNAME) USE_EXTENSION_MANIFEST=1

# The calling makefile might need to process some extra files. Provide an empty
# rule to overwrite
repack-process-extrafiles:
