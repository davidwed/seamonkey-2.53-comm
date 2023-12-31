#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Repo Defaults
# 'REV' controls the default rev for All the various repo's
# Define x_REV to override. Where x can be one of:
#  "COMM", "MOZILLA", "CHATZILLA", "INSPECTOR"
DEFAULTS = {
    # Global Default Revision
    'REV': "default",

    # URL of the default hg repository to clone for ChatZilla.
    'CHATZILLA_REPO': 'https://hg.mozilla.org/chatzilla/',
    # The stable revision to use
      'CHATZILLA_REV':  'SEA2_48_RELBRANCH',

    # URL of the default hg repository to clone for DOM Inspector.
    'INSPECTOR_REPO': 'https://hg.mozilla.org/dom-inspector/',
    # The stable revision to use
      'INSPECTOR_REV':  'DOMI_2_0_17',

    # URL of the default hg repository to clone for Mozilla.
    'MOZILLA_REPO': 'https://hg.mozilla.org/releases/mozilla-release/',
}

REPO_SHORT_NAMES = {
    'mozilla-central':  'moz',
    'dom-inspector':    'dom',
}


def get_DEFAULT_tag(index):
    if index in DEFAULTS:
        return DEFAULTS[index]
    else:
        return DEFAULTS['REV']

# The set of defaults below relate to the current switching mechanism between
# trunk or branches and back again if it is required.

# The current version expected in the .treestate file for nothing to happen.
# This reflects the "[treestate] src_update_version = ..." value.
#
# src_update_version values:
# '1' : mozilla/ may have been moved to mozilla-1.9.1 (or kept the same
#       depending on set-up).
# '2' : mozilla/ may have been moved back to mozilla-central.
CURRENT_TREESTATE_VERSION = '2'
# REGEX to match against, $1 should refer to protocol scheme
SWITCH_MOZILLA_REPO_REGEXP = '(ssh|http|https):\/\/hg\.mozilla\.org\/releases/mozilla-1.9.1\/?$'
# The location to back-up the existing mozilla repo to, e.g. ".mozilla-trunk"
# or ".mozilla-1.9.1".
SWITCH_MOZILLA_REPO_BACKUP_LOCATION = ".mozilla-1.9.1"
# This is the potential location for a repository from the last time we
# switched. Can be blank for no effect.
SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION = ".mozilla-trunk"
# This should be the same as DEFAULTS['MOZILLA_REPO'] but using %s instead
# of http for the scheme.
SWITCH_MOZILLA_REPO_REPLACE = '%s://hg.mozilla.org/mozilla-central/'
SWITCH_MOZILLA_BASE_REV = "GECKO_1_9_1_BASE"

import sys
pyver = sys.version_info
if pyver[0] <= 1 or (pyver[0] == 2 and pyver[1] < 6):
    sys.exit("ERROR: Python 2.6 or newer required")
elif pyver[0] >= 3:
    # Python series 3 will syntax error here, Hack needed per Bug 601649c#8
    print "ERROR: Python series 3 is not supported, use python 2.7"
    sys.exit()  # Do an explicit sys.exit for code clarity.
del pyver

import os
from optparse import OptionParser, OptionValueError
import re

topsrcdir = os.path.dirname(__file__)
if topsrcdir == '':
    topsrcdir = '.'

TREE_STATE_FILE = os.path.join(topsrcdir, '.treestate')

from subprocess import check_call, check_output


def check_call_output(cmd, *args, **kwargs):
    return check_output(cmd, *args, **kwargs)


def check_call_noisy(cmd, retryMax=0, *args, **kwargs):
    """Wrapper around execute_check_call() to allow retries before failing.

    |cmd|, is the command to try and execute.
    |retryMax|, is the maximum number of retries to attempt, 0 by default.
    """

    def execute_check_call(cmd, *args, **kwargs):
        print "Executing command:", cmd
        check_call(cmd, *args, **kwargs)

    # By default (= no retries), simply pass the call on.
    if retryMax == 0:
        execute_check_call(cmd, *args, **kwargs)
        return

    # Loop (1 + retryMax) times, at most.
    for r in range(0, 1 + retryMax):
        # Add a retry header, not for initial call.
        if r != 0:
            print >> sys.stderr, "Retrying previous command: %d of %d time(s)" % (r, retryMax)
        try:
            # (Re-)Try the call.
            execute_check_call(cmd, *args, **kwargs)
            # If the call succeeded then no more retries.
            break
        except:
            # Print the exception without its traceback.
            # This traceback starts in the try block, which should be low value.
            print >> sys.stderr, "The exception was:"
            sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
            # Add a blank line.
            print >> sys.stderr
        else:
            # Raise our own exception.
            # This traceback starts at (= reports) the initial caller line.
            raise Exception("Command '%s' failed %d time(s). Giving up." %
                            (cmd, retryMax + 1))


def repo_config():
    """Create/Update TREE_STATE_FILE as needed.

    switch_mozilla_repo() may be called if the branch that the mozilla repo is
    on needs changing
    """

    import ConfigParser

    config_version = CURRENT_TREESTATE_VERSION

    config = ConfigParser.ConfigParser()

    # If the file exists, see if we need to move to the stable branch.
    # If it doesn't exist, we assume the user hasn't pulled before (or has
    # done it manually) and therefore leave his mozilla/ repo as it is.
    if os.path.exists(TREE_STATE_FILE):
        config.read([TREE_STATE_FILE])

        if config.has_option('treestate', 'src_update_version'):
            config_version = config.get('treestate', 'src_update_version')
        else:
            # If src_update_version doesn't exist, assume this to be '1' and
            # apply the update. This was because the first version of this
            # migration allowed the existence of the file to equate to '1'.
            config_version = '1'

    # Do nothing if the current version is up to date.
    if config_version < CURRENT_TREESTATE_VERSION:
        switch_mozilla_repo()

    if not os.path.exists(TREE_STATE_FILE) or config_version < CURRENT_TREESTATE_VERSION:
        if not config.has_section('treestate'):
            config.add_section('treestate')
        config.set('treestate', 'src_update_version',
                   CURRENT_TREESTATE_VERSION)

        # Write this file out
        f = open(TREE_STATE_FILE, 'w')
        try:
            config.write(f)
        finally:
            f.close()


def switch_mozilla_repo():
    """If the mozilla/ repo matches SWITCH_MOZILLA_REPO_REGEXP then:
    1) Backup (unused anymore) checkout of mozilla/.
    2a) If SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION exists, move that to mozilla/.
    2b) Else clone the backup of mozilla/ up to the SWITCH_MOZILLA_BASE_REV
        revision and set the pull location to SWITCH_MOZILLA_REPO_REPLACE.

    It is expected that the normal pull/update functions in this script will
    update the new mozilla/ repo to the latest version.
    """

    mozilla_path = os.path.join(topsrcdir, 'mozilla')
    # Do nothing if there is no Mozilla directory.
    if not os.path.exists(mozilla_path):
        return

    import ConfigParser
    import re
    config = ConfigParser.ConfigParser()
    config_path = os.path.join(mozilla_path, '.hg', 'hgrc')
    config.read([config_path])
    if not config.has_option('paths', 'default'):
        # Abort, not to get into a possibly inconsistent state.
        sys.exit("Error: default path in %s is undefined!" % config_path)

    # Compile the Mozilla repository regex.
    moz_old_regex = re.compile(SWITCH_MOZILLA_REPO_REGEXP, re.I)
    match = moz_old_regex.match(config.get('paths', 'default'))
    # Do nothing if not pulling from the one we're trying to switch from.
    if not match:
        return

    config.set('paths', 'default',
               SWITCH_MOZILLA_REPO_REPLACE % match.group(1))

    if config.has_option('paths', 'default-push'):
        match = moz_old_regex.match(config.get('paths', 'default-push'))
        # Do not update this property if not pushing to Mozilla trunk.
        if match:
            config.set('paths', 'default-push',
                       SWITCH_MOZILLA_REPO_REPLACE % match.group(1))

    hgcloneopts = []
    if options.hgcloneopts:
        hgcloneopts = options.hgcloneopts.split()

    hgopts = []
    if options.hgopts:
        hgopts = options.hgopts.split()

    backup_mozilla_path = os.path.join(topsrcdir,
                                       SWITCH_MOZILLA_REPO_BACKUP_LOCATION)
    print "Moving mozilla to " + SWITCH_MOZILLA_REPO_BACKUP_LOCATION + "..."
    try:
        os.rename(mozilla_path, backup_mozilla_path)
    except:
        # Print the exception without its traceback.
        sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
        sys.exit("Error: Mozilla directory renaming failed!")

    # Does the user have a pre-existing backup repository?
    old_backup_repository = os.path.join(topsrcdir,
                                         SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION)
    if SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION != "" and \
            os.path.exists(old_backup_repository):
        # Yes, so let's use that
        print "Moving " + old_backup_repository + " to " + mozilla_path + "..."
        try:
            os.rename(old_backup_repository, mozilla_path)
        except:
            # Print the exception without its traceback.
            sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
            sys.exit("Error: Renaming old backup directory failed! You must recover manually.")
        # Let's leave the hgrc as it was, so any repo specific config is left
        # the same.
        return

    # Locally clone common repository history.
    check_call_noisy([options.hg, 'clone', '-r', SWITCH_MOZILLA_BASE_REV] +
                     hgcloneopts + hgopts + [backup_mozilla_path, mozilla_path],
                     retryMax=options.retries)

    # Rewrite hgrc for new local mozilla repo based on pre-existing hgrc
    # but with new values
    f = open(os.path.join(topsrcdir, 'mozilla', '.hg', 'hgrc'), 'w')
    try:
        config.write(f)
    finally:
        f.close()


def backup_cvs_extension(extensionName, extensionDir, extensionPath):
    """Backup (obsolete) cvs checkout of extensionName.
    """

    # Do nothing if there is no extensionName cvs directory.
    if not os.path.exists(os.path.join(extensionPath, 'CVS')):
        return

    extensionBackupPath = extensionPath + '-cvs'
    print "Moving %s to %s-cvs..." % (extensionDir, extensionDir)
    try:
        os.rename(extensionPath, extensionBackupPath)
    except:
        # Print the exception without its traceback.
        sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
        sys.exit("Error: %s directory renaming failed!" % extensionName)


def do_hg_pull(dir, repository, hg, rev, hgtool=None, hgtool1=None):
    """Clone if the dir doesn't exist, pull if it does.
    """

    fulldir = os.path.join(topsrcdir, dir)

    hgcloneopts = []
    if options.hgcloneopts:
        hgcloneopts = options.hgcloneopts.split()

    hgopts = []
    if options.hgopts:
        hgopts = options.hgopts.split()

    if hgtool or hgtool1:
        if not os.path.exists(hgtool):
            hgtool = hgtool1

    if hgtool:
        hgtoolcmd = hgtool.split()
        # We need to strip the trailing slash from the repository url so that
        # the hg tool gets a url that's consistent with the rest of the build
        # automation.
        repo = repository.rstrip('/')

        # Make sure to unset the PROPERTIES_FILE variable, otherwise hgtool
        # might use this for the revisions and branches.
        hgtoolenv = os.environ.copy()
        if 'PROPERTIES_FILE' in hgtoolenv:
            del hgtoolenv['PROPERTIES_FILE']

        # Set up the tool options, most importantly the revision
        hgtoolopts = ['-r', rev]
        if options.verbose:
            hgtoolopts.append('-v')

        check_call_noisy(['python'] + hgtoolcmd +
                         hgtoolopts +
                         [repo, fulldir],
                         env=hgtoolenv,
                         retryMax=options.retries)
    else:
        if not os.path.exists(fulldir):
            fulldir = os.path.join(topsrcdir, dir)
            check_call_noisy([hg, 'clone'] + hgcloneopts + hgopts +
                             [repository, fulldir],
                             retryMax=options.retries)
        else:
            cmd = [hg, 'pull', '-R', fulldir] + hgopts
            if repository is not None:
                cmd.append(repository)
            check_call_noisy(cmd, retryMax=options.retries)

        # update to specific revision
        cmd = [hg, 'update', '-r', rev, '-R', fulldir] + hgopts
        if options.verbose:
            cmd.append('-v')
        # Explicitly never retry 'hg update': otherwise any merge failures are
        # ignored.
        # This command is local: a failure can't be caused by a network error.
        check_call_noisy(cmd, retryMax=0)

    check_call([hg, 'parent', '-R', fulldir,
                '--template=Updated to revision {node}.\n'])

    if options.tinderbox_print and dir != '.':
        got_rev = check_call_output([hg, 'parent', '-R', fulldir,
                                     '--template={node}'])

        url = check_call_output([hg, 'paths', 'default', '-R', fulldir]).rstrip().rstrip('/')
        repo_name = url.split('/')[-1]
        repo_short_name = REPO_SHORT_NAMES.get(repo_name, repo_name)

        print "TinderboxPrint:<a href=%s/rev/%s title='Built from %s revision %s'>%s:%s</a>" % (url, got_rev, repo_name, got_rev, repo_short_name, got_rev)


def check_retries_option(option, opt_str, value, parser):
    if value < 0:
        raise OptionValueError("%s option value needs to be positive (not '%d')" %
                               (opt_str, value))
    setattr(parser.values, option.dest, value)


def do_apply_patch(hg, patch, repo):
    check_call_noisy([hg,
                      'import',
                      '-R', repo,
                      '-m', "local patch from %s" % patch,
                      '--no-commit', '--force',
                      patch,
                      ],
                     retryMax=0
                     )
    return

import glob


def do_apply_patches(topsrcdir, hg):
    prefix_map = {
        'mozilla': 'mozilla',
        'chatzilla': os.path.join('mozilla', 'extensions', 'irc'),
        'inspector': os.path.join('mozilla', 'extensions', 'inspector'),
    }

    for prefix in prefix_map.keys():
        prefix_dir = prefix_map.get(prefix)
        files = glob.glob("%s*.patch" % prefix)
        files.sort()
        for file in files:
            patch = os.path.join(topsrcdir, file)
            if os.path.exists(patch):
                do_apply_patch(hg, patch, prefix_dir)

o = OptionParser(usage="%prog [options] checkout")
o.add_option("-m", "--comm-repo", dest="comm_repo",
             default=None,
             help="URL of comm (Calendar/Mail/Suite) repository to pull from (default: use hg default in .hg/hgrc)")
o.add_option("--skip-comm", dest="skip_comm",
             action="store_true", default=False,
             help="Skip pulling the comm (Calendar/Mail/Suite) repository.")
o.add_option("--comm-rev", dest="comm_rev",
             default=None,
             help="Revision of comm (Calendar/Mail/Suite) repository to update to. If not present, COMM_REV from the environment will be used. If that doesn't exist the default is: \"" + get_DEFAULT_tag('COMM_REV') + "\"")

o.add_option("-z", "--mozilla-repo", dest="mozilla_repo",
             default=None,
             help="URL of Mozilla repository to pull from (default: use hg default in mozilla/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULTS['MOZILLA_REPO'] + "\".)")
o.add_option("--skip-mozilla", dest="skip_mozilla",
             action="store_true", default=False,
             help="Skip pulling the Mozilla repository.")
o.add_option("--mozilla-rev", dest="mozilla_rev",
             default=None,
             help="Revision of Mozilla repository to update to. If not present, MOZILLA_REV from the environment will be used. If that doesn't exist the default is: \"" + get_DEFAULT_tag('MOZILLA_REV') + "\"")

o.add_option("--inspector-repo", dest="inspector_repo",
             default=None,
             help="URL of DOM Inspector repository to pull from (default: use hg default in mozilla/extensions/inspector/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULTS['INSPECTOR_REPO'] + "\".)")
o.add_option("--skip-inspector", dest="skip_inspector",
             action="store_true", default=False,
             help="Skip pulling the DOM Inspector repository.")
o.add_option("--inspector-rev", dest="inspector_rev",
             default=None,
             help="Revision of DOM Inspector repository to update to. Default: \"" + get_DEFAULT_tag('INSPECTOR_REV') + "\"")

o.add_option("--chatzilla-repo", dest="chatzilla_repo",
             default=None,
             help="URL of ChatZilla repository to pull from (default: use hg default in mozilla/extensions/irc/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULTS['CHATZILLA_REPO'] + "\".)")
o.add_option("--skip-chatzilla", dest="skip_chatzilla",
             action="store_true", default=False,
             help="Skip pulling the ChatZilla repository.")
o.add_option("--chatzilla-rev", dest="chatzilla_rev",
             default=None,
             help="Revision of ChatZilla repository to update to. Default: \"" + get_DEFAULT_tag('CHATZILLA_REV') + "\"")

o.add_option("--skip-venkman", dest="skip_venkman",
             action="store_true", default=False,
             help="Obsolete option, supported for backwards compat.")
o.add_option("--venkman-rev", dest="venkman_rev",
             default=None,
             help="Obsolete option, supported for backwards compat.")

o.add_option("--hg", dest="hg", default=os.environ.get('HG', 'hg'),
             help="The location of the hg binary")
o.add_option("-v", "--verbose", dest="verbose",
             action="store_true", default=False,
             help="Enable verbose output on hg updates")
o.add_option("--hgtool", dest="hgtool",
             default=None,
             help="Path to hgtool, if wanted")
o.add_option("--hgtool1", dest="hgtool1",
             default=None,
             help="Alternative path to hgtool, if wanted")
o.add_option("--hg-options", dest="hgopts",
             help="Pass arbitrary options to hg commands (i.e. --debug, --time)")
o.add_option("--hg-clone-options", dest="hgcloneopts",
             help="Pass arbitrary options to hg clone commands (i.e. --uncompressed)")

o.add_option("--retries", dest="retries", type="int", metavar="NUM",
             default=1, help="Number of times to retry a failed command before giving up. (default: 1)",
             action="callback", callback=check_retries_option)

o.add_option("-r", "--rev", dest="default_rev",
             default=None,
             help="Revision of all repositories to update to, unless otherwise specified.")

o.add_option("--apply-patches", dest="apply_patches",
             action="store_true", default=False,
             help="Look for and apply local patches (repo*.patch)")

o.add_option("--tinderbox-print", dest="tinderbox_print",
             action="store_true", default=False,
             help="Print repo revisions for Tinderbox")


def fixup_comm_repo_options(options):
    """Check options.comm_repo value.

    options.comm_repo is normally None.
    This is fine -- our "hg pull" command will omit the repo URL.
    The exception is the initial checkout, which does an "hg clone".
    That command requires a repository URL.
    """

    if options.comm_repo is None and \
            not os.path.exists(os.path.join(topsrcdir, '.hg')):
        o.print_help()
        print
        print "Error: the -m option is required for the initial checkout!"
        sys.exit(2)

    # If COMM_REV is passed via environment, prefer that over the passed
    # option so that automation can pass tagged versions while still defaulting
    # to a certain revision via client.py-args.
    envRev = os.environ.get("COMM_REV")
    if envRev:
        if options.comm_rev and options.comm_rev != envRev:
            print "Warning: Preferring COMM_REV (%s) over passed revision (%s)" % (envRev, options.comm_rev)
        else:
            print "Using COMM_REV from environment (%s)" % envRev
        options.comm_rev = envRev

    # If no version was set before, use the default comm revision.
    if options.comm_rev is None:
        options.comm_rev = get_DEFAULT_tag("COMM_REV")


def fixup_mozilla_repo_options(options):
    """Handle special case: initial checkout of Mozilla.

    See fixup_comm_repo_options().
    """
    if options.mozilla_repo is None:
        if not os.path.exists(os.path.join(topsrcdir, 'mozilla')):
            options.mozilla_repo = DEFAULTS['MOZILLA_REPO']
        else:
            # Fallback to using .hgrc as hgtool/share needs the repo
            import ConfigParser
            config = ConfigParser.ConfigParser()
            config_path = os.path.join(topsrcdir, 'mozilla', '.hg', 'hgrc')
            config.read([config_path])
            if not config.has_option('paths', 'default'):
                # Abort, not to get into a possibly inconsistent state.
                sys.exit("Error: default path in %s is undefined!" %
                         config_path)

            options.mozilla_repo = config.get('paths', 'default')

    # If MOZILLA_REV is passed via environment, prefer that over the passed
    # option so that automation can pass tagged versions while still defaulting
    # to a certain revision via client.py-args.
    envRev = os.environ.get("MOZILLA_REV")
    if envRev:
        if options.mozilla_rev and options.mozilla_rev != envRev:
            print "Warning: Preferring MOZILLA_REV (%s) over passed revision (%s)" % (envRev, options.mozilla_rev)
        else:
            print "Using MOZILLA_REV from environment (%s)" % envRev
        options.mozilla_rev = envRev

    # If no version was set before, use the default mozilla revision.
    if options.mozilla_rev is None:
        options.mozilla_rev = get_DEFAULT_tag("MOZILLA_REV")


def fixup_chatzilla_repo_options(options):
    """Handle special case: initial hg checkout of Chatzilla.

    See fixup_comm_repo_options().
    backup_cvs_extension() is also called.
    """

    extensionPath = os.path.join(topsrcdir, 'mozilla', 'extensions', 'irc')

    backup_cvs_extension('Chatzilla', 'irc', extensionPath)

    if options.chatzilla_repo is None and not os.path.exists(extensionPath):
        options.chatzilla_repo = DEFAULTS['CHATZILLA_REPO']

    if options.chatzilla_rev is None:
        options.chatzilla_rev = get_DEFAULT_tag("CHATZILLA_REV")


def fixup_inspector_repo_options(options):
    """Handle special case: initial checkout of DOM Inspector.

    See fixup_comm_repo_options().
    """

    # No cvs backup needed as DOM Inspector was part (and removed from)
    # Mozilla hg repository.
    if options.inspector_repo is None and \
            not os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions',
                                            'inspector')):
        options.inspector_repo = DEFAULTS['INSPECTOR_REPO']

    if options.inspector_rev is None:
        options.inspector_rev = get_DEFAULT_tag("INSPECTOR_REV")


try:
    (options, (action,)) = o.parse_args()
except ValueError:
    o.print_help()
    sys.exit(2)

if options.default_rev:
    # We now wish to override all the DEFAULTS.
    DEFAULTS['REV'] = options.default_rev
    for index in ['CHATZILLA', 'INSPECTOR', 'COMM', 'MOZILLA']:
        index += "_REV"
        # Clear the rest from file-defaults
        if index in DEFAULTS:
            del DEFAULTS[index]

if action in ('checkout', 'co'):
    # Update Comm repository configuration.
    repo_config()

    if not options.skip_comm:
        fixup_comm_repo_options(options)
        do_hg_pull('.', options.comm_repo, options.hg, options.comm_rev)

    if not options.skip_mozilla:
        fixup_mozilla_repo_options(options)
        do_hg_pull('mozilla', options.mozilla_repo, options.hg,
                   options.mozilla_rev, options.hgtool, options.hgtool1)

    # Check whether destination directory exists for these extensions.
    if (not options.skip_chatzilla or not options.skip_inspector) and \
       not os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions')):
        # Don't create the directory: Mozilla repository should provide it...
        sys.exit("Error: mozilla/extensions directory does not exist;" +
                 " ChatZilla, and/or DOM Inspector cannot be checked out!")

    if not options.skip_chatzilla:
        fixup_chatzilla_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'irc'),
                   options.chatzilla_repo, options.hg, options.chatzilla_rev)

    if not options.skip_inspector:
        fixup_inspector_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'inspector'),
                   options.inspector_repo, options.hg, options.inspector_rev)

    if options.apply_patches:
        do_apply_patches(topsrcdir, options.hg)

else:
    o.print_help()
    sys.exit(2)
