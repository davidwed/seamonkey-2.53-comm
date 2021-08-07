def test(mod, path, entity=None):
  import re
  # ignore anything but Thunderbird
  if mod not in ("netwerk", "dom", "toolkit", "security/manager",
                 "devtools/shared", "devtools/client",
                 "mail", "chat", "extensions/spellcheck",
                 "other-licenses/branding/thunderbird",
                 "mail/branding/thunderbird"):
    return "ignore"

  # ignore MOZ_LANGPACK_CONTRIBUTORS
  if mod == "mail" and path == "defines.inc" and \
     entity == "MOZ_LANGPACK_CONTRIBUTORS":
    return "ignore"
  # ignore dictionaries
  if mod == "extensions/spellcheck":
    return "ignore"

  if path == "chrome/messenger-region/region.properties":
    return ("ignore" if (re.match(r"browser\.search\.order\.[1-9]", entity) or
                         re.match(r"mail\.addr_book\.mapit_url\.[1-5]", entity))
            else "error")

  return "error"
