/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "mozilla/ArrayUtils.h"

#include "nsCOMPtr.h"
#include "nsGNOMEShellService.h"
#include "nsShellService.h"
#include "nsIServiceManager.h"
#include "nsIFile.h"
#include "nsIProperties.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIPrefService.h"
#include "prenv.h"
#include "nsString.h"
#include "nsIGIOService.h"
#include "nsIGSettingsService.h"
#include "nsIStringBundle.h"
#include "nsIOutputStream.h"
#include "nsIProcess.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIImageLoadingContent.h"
#include "imgIRequest.h"
#include "imgIContainer.h"
#include "mozilla/Sprintf.h"
#include "nsIImageToPixbuf.h"
#include "nsXULAppAPI.h"

#include <glib.h>
#include <glib-object.h>
#include <gtk/gtk.h>
#include <gdk/gdk.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <limits.h>
#include <stdlib.h>

struct ProtocolAssociation {
  uint16_t app;
  const char* protocol;
};

struct MimeTypeAssociation {
  uint16_t app;
  const char* mimeType;
  const char* extensions;
};

static const ProtocolAssociation gProtocols[] = {
  { nsIShellService::BROWSER, "http" },
  { nsIShellService::BROWSER, "https" },
  { nsIShellService::MAIL, "mailto" },
  { nsIShellService::NEWS, "news" },
  { nsIShellService::NEWS, "snews" },
  { nsIShellService::RSS, "feed" }
};

static const MimeTypeAssociation gMimeTypes[] = {
  { nsIShellService::BROWSER, "text/html", "htm html" },
  { nsIShellService::BROWSER, "application/xhtml+xml", "xhtml" },
  { nsIShellService::MAIL, "message/rfc822", "eml" },
  { nsIShellService::RSS, "application/rss+xml", "rss" }
};

#define kDesktopBGSchema "org.gnome.desktop.background"
#define kDesktopImageGSKey "picture-uri"
#define kDesktopOptionGSKey "picture-options"
#define kDesktopDrawBGGSKey "draw-background"
#define kDesktopColorGSKey "primary-color"

NS_IMPL_ISUPPORTS(nsGNOMEShellService, nsIGNOMEShellService, nsIShellService)

nsresult
GetBrandName(nsACString& aBrandName)
{
  // get the product brand name from localized strings
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> brandBundle;
  rv = bundleService->CreateBundle(BRAND_PROPERTIES, getter_AddRefs(brandBundle));
  NS_ENSURE_TRUE(brandBundle, rv);

  nsAutoString brandName;
  rv = brandBundle->GetStringFromName("brandShortName", brandName);
  NS_ENSURE_SUCCESS(rv, rv);

  CopyUTF16toUTF8(brandName, aBrandName);
  return rv;
}

nsresult
nsGNOMEShellService::Init()
{
  nsresult rv;

  // Check G_BROKEN_FILENAMES.  If it's set, then filenames in glib use
  // the locale encoding.  If it's not set, they use UTF-8.
  mUseLocaleFilenames = PR_GetEnv("G_BROKEN_FILENAMES") != nullptr;

 if (GetAppPathFromLauncher()) return NS_OK;

  nsCOMPtr<nsIFile> appPath;
  rv = NS_GetSpecialDirectory(XRE_EXECUTABLE_FILE, getter_AddRefs(appPath));
  NS_ENSURE_SUCCESS(rv, rv);

  return appPath->GetNativePath(mAppPath);
}

bool nsGNOMEShellService::GetAppPathFromLauncher() {
  gchar *tmp;

  const char* launcher = PR_GetEnv("MOZ_APP_LAUNCHER");
  if (!launcher) return false;

  if (g_path_is_absolute(launcher)) {
    mAppPath = launcher;
    tmp = g_path_get_basename(launcher);
    gchar* fullpath = g_find_program_in_path(tmp);
    if (fullpath && mAppPath.Equals(fullpath)) mAppIsInPath = true;
    g_free(fullpath);
  } else {
    tmp = g_find_program_in_path(launcher);
    if (!tmp) return false;
    mAppPath = tmp;
    mAppIsInPath = true;
  }

  g_free(tmp);
  return true;
}

bool
nsGNOMEShellService::HandlerMatchesAppName(const char* aHandler)
{
  bool matches = false;
  gint argc;
  gchar** argv;
  if (g_shell_parse_argv(aHandler, &argc, &argv, nullptr) && argc > 0) {
    gchar* command = nullptr;
    if (!mUseLocaleFilenames)
      command = g_find_program_in_path(argv[0]);
    else {
      gchar* nativeFile = g_filename_from_utf8(argv[0], -1,
                                               nullptr, nullptr, nullptr);
      if (nativeFile) {
        command = g_find_program_in_path(nativeFile);
        g_free(nativeFile);
      }
    }
    matches = command && mAppPath.Equals(command);
    g_free(command);
    g_strfreev(argv);
  }

  return matches;
}

NS_IMETHODIMP
nsGNOMEShellService::IsDefaultClient(bool aStartupCheck, uint16_t aApps,
                                     bool* aIsDefaultClient)
{
  *aIsDefaultClient = false;

  nsCString handler;
  nsCOMPtr<nsIGIOMimeApp> app;
  nsCOMPtr<nsIGIOService> giovfs = do_GetService(NS_GIOSERVICE_CONTRACTID);

  for (unsigned i = 0; i < mozilla::ArrayLength(gProtocols); i++) {
    if (aApps & gProtocols[i].app) {
      nsDependentCString protocol(gProtocols[i].protocol);
      if (giovfs) {
        giovfs->GetAppForURIScheme(protocol, getter_AddRefs(app));
        if (!app)
          return NS_OK;

        if (NS_SUCCEEDED(app->GetCommand(handler)) &&
            !HandlerMatchesAppName(handler.get()))
         return NS_OK;
      }
    }
  }

  *aIsDefaultClient = true;
  return NS_OK;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDefaultClient(bool aForAllUsers,
                                      bool aClaimAllTypes, uint16_t aApps)
{
  nsresult rv;

  nsCOMPtr<nsIGIOMimeApp> app;
  nsCOMPtr<nsIGIOService> giovfs = do_GetService(NS_GIOSERVICE_CONTRACTID);
  if (giovfs) {
    nsCString brandName;
    rv = GetBrandName(brandName);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = giovfs->FindAppFromCommand(mAppPath, getter_AddRefs(app));
    if (NS_FAILED(rv)) {
      // Application was not found in the list of installed applications
      // provided by OS. Fallback to create appInfo from command and name.
      rv = giovfs->CreateAppFromCommand(mAppPath, brandName, getter_AddRefs(app));
      NS_ENSURE_SUCCESS(rv, rv);
    }

    // set handler for the protocols
    for (unsigned int i = 0; i < mozilla::ArrayLength(gProtocols); ++i) {
      if (aApps & gProtocols[i].app) {
        nsDependentCString protocol(gProtocols[i].protocol);
        if (app) {
          rv = app->SetAsDefaultForURIScheme(protocol);
          NS_ENSURE_SUCCESS(rv, rv);
        }
      }
    }

    for (unsigned i = 0; i < mozilla::ArrayLength(gMimeTypes); i++) {
      if (aApps & gMimeTypes[i].app) {
        rv = app->SetAsDefaultForMimeType(nsDependentCString(gMimeTypes[i].mimeType));
        NS_ENSURE_SUCCESS(rv, rv);
        rv = app->SetAsDefaultForFileExtensions(nsDependentCString(gMimeTypes[i].extensions));
        NS_ENSURE_SUCCESS(rv, rv);
      }
    }
  }

  return NS_OK;
}

NS_IMETHODIMP
nsGNOMEShellService::GetCanSetDesktopBackground(bool* aResult)
{
  // for Gnome or desktops using the same GSettings keys
  const char *currentDesktop = getenv("XDG_CURRENT_DESKTOP");
  if (currentDesktop && strstr(currentDesktop, "GNOME") != nullptr) {
    *aResult = true;
    return NS_OK;
  }
  const char *gnomeSession = getenv("GNOME_DESKTOP_SESSION_ID");
  if (gnomeSession) {
    *aResult = true;
  } else {
    *aResult = false;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDesktopBackground(nsIDOMElement* aElement,
                                          int32_t aPosition,
                                          const nsACString& aImageName)
{
  nsCString brandName;
  nsresult rv = GetBrandName(brandName);
  NS_ENSURE_SUCCESS(rv, rv);

  // build the file name
  nsCString filePath(PR_GetEnv("HOME"));
  filePath.Append('/');
  filePath.Append(brandName);
  filePath.AppendLiteral("_wallpaper.png");

  // get the image container
  nsCOMPtr<nsIImageLoadingContent> imageContent(do_QueryInterface(aElement, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<imgIRequest> request;
  rv = imageContent->GetRequest(nsIImageLoadingContent::CURRENT_REQUEST,
                                getter_AddRefs(request));
  NS_ENSURE_TRUE(request, rv);

  nsCOMPtr<imgIContainer> container;
  rv = request->GetImage(getter_AddRefs(container));
  NS_ENSURE_TRUE(request, rv);

  nsCOMPtr<nsIImageToPixbuf> imgToPixbuf(do_GetService("@mozilla.org/widget/image-to-gdk-pixbuf;1"));
  if (!imgToPixbuf)
    return NS_ERROR_NOT_AVAILABLE;

  GdkPixbuf* pixbuf = imgToPixbuf->ConvertImageToPixbuf(container);
  if (!pixbuf)
    return NS_ERROR_NOT_AVAILABLE;

  // write the image to a file in the home dir
  gboolean res = gdk_pixbuf_save(pixbuf, filePath.get(), "png",
                                 nullptr, nullptr);

  g_object_unref(pixbuf);
  if (!res)
    return NS_ERROR_FAILURE;

  // Set desktop wallpaper filling style.
  nsAutoCString options;
  switch (aPosition) {
    case BACKGROUND_TILE:
      options.AssignLiteral("wallpaper");
      break;
    case BACKGROUND_STRETCH:
      options.AssignLiteral("stretched");
      break;
    case BACKGROUND_FILL:
      options.AssignLiteral("zoom");
      break;
    case BACKGROUND_FIT:
      options.AssignLiteral("scaled");
      break;
    default:
      options.AssignLiteral("centered");
      break;
  }

  nsCOMPtr<nsIGSettingsService> gsettings(do_GetService(NS_GSETTINGSSERVICE_CONTRACTID));
  if (gsettings) {
    nsCOMPtr<nsIGSettingsCollection> background_settings;
    gsettings->GetCollectionForSchema(NS_LITERAL_CSTRING(kDesktopBGSchema),
                                      getter_AddRefs(background_settings));
    if (background_settings) {
      gchar *file_uri = g_filename_to_uri(filePath.get(), nullptr, nullptr);
      if (!file_uri)
       return NS_ERROR_FAILURE;

      background_settings->SetString(NS_LITERAL_CSTRING(kDesktopOptionGSKey),
                                     options);
      background_settings->SetString(NS_LITERAL_CSTRING(kDesktopImageGSKey),
                                     nsDependentCString(file_uri));
      g_free(file_uri);
      background_settings->SetBoolean(NS_LITERAL_CSTRING(kDesktopDrawBGGSKey),
                                      true);
      return NS_OK;
    }
  }

  return NS_ERROR_FAILURE;
}

#define COLOR_16_TO_8_BIT(_c) ((_c) >> 8)

NS_IMETHODIMP
nsGNOMEShellService::GetDesktopBackgroundColor(uint32_t *aColor)
{
  nsCOMPtr<nsIGSettingsService> gsettings(do_GetService(NS_GSETTINGSSERVICE_CONTRACTID));
  nsCOMPtr<nsIGSettingsCollection> background_settings;

  if (gsettings)
    gsettings->GetCollectionForSchema(NS_LITERAL_CSTRING(kDesktopBGSchema),
                                      getter_AddRefs(background_settings));

  nsCString background;
  if (background_settings)
    background_settings->GetString(NS_LITERAL_CSTRING(kDesktopColorGSKey),
                                   background);

  if (background.IsEmpty())
    return NS_ERROR_FAILURE;

  GdkColor color;
  NS_ENSURE_TRUE(gdk_color_parse(background.get(), &color), NS_ERROR_FAILURE);

  *aColor = COLOR_16_TO_8_BIT(color.red) << 16 |
            COLOR_16_TO_8_BIT(color.green) << 8 |
            COLOR_16_TO_8_BIT(color.blue);
  return NS_OK;
}

#define COLOR_8_TO_16_BIT(_c) ((_c) << 8 | (_c))

NS_IMETHODIMP
nsGNOMEShellService::SetDesktopBackgroundColor(uint32_t aColor)
{
  NS_ENSURE_ARG_MAX(aColor, 0xFFFFFF);

  uint8_t red = aColor >> 16;
  uint8_t green = aColor >> 8;
  uint8_t blue = aColor;
  char colorString[14];
  sprintf(colorString, "#%04x%04x%04x", COLOR_8_TO_16_BIT(red),
          COLOR_8_TO_16_BIT(green), COLOR_8_TO_16_BIT(blue));

  nsCOMPtr<nsIGSettingsService> gsettings(do_GetService(NS_GSETTINGSSERVICE_CONTRACTID));
  if (gsettings) {
    nsCOMPtr<nsIGSettingsCollection> background_settings;
    gsettings->GetCollectionForSchema(NS_LITERAL_CSTRING(kDesktopBGSchema),
                                      getter_AddRefs(background_settings));
    if (background_settings) {
      background_settings->SetString(NS_LITERAL_CSTRING(kDesktopColorGSKey),
                                     nsDependentCString(colorString));
      return NS_OK;
    }
  }

  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsGNOMEShellService::OpenApplicationWithURI(nsIFile* aApplication, const nsACString& aURI)
{
  nsresult rv;
  nsCOMPtr<nsIProcess> process =
    do_CreateInstance("@mozilla.org/process/util;1", &rv);
  if (NS_FAILED(rv))
    return rv;

  rv = process->Init(aApplication);
  if (NS_FAILED(rv))
    return rv;

  const nsCString& spec = PromiseFlatCString(aURI);
  const char* specStr = spec.get();
  return process->Run(false, &specStr, 1);
}

NS_IMETHODIMP
nsGNOMEShellService::GetDefaultFeedReader(nsIFile** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
