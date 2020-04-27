#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import print_function, unicode_literals

import sys
import os
from datetime import datetime

import buildconfig

def get_gecko_repo_info():
    repo = buildconfig.substs.get('MOZ_GECKO_SOURCE_REPO', None)
    rev = buildconfig.substs.get('MOZ_GECKO_SOURCE_CHANGESET', None)
    if not repo:
        repo = buildconfig.substs.get('MOZ_SOURCE_REPO', None)
        rev = buildconfig.substs.get('MOZ_SOURCE_CHANGESET', None)

    return repo, rev


def get_comm_repo_info():
    repo = buildconfig.substs.get('MOZ_COMM_SOURCE_REPO', None)
    rev = buildconfig.substs.get('MOZ_COMM_SOURCE_CHANGESET', None)

    return repo, rev


def get_source_url(repo, rev):
    source_url = ''
    if "git" in repo:
        source_url = '%s/tree/%s' % (repo, rev)
    else:
        source_url = '%s/rev/%s' % (repo, rev)

    return source_url


def gen_platformini(output, platform_ini):
    gecko_repo, gecko_rev = get_gecko_repo_info()

    with open(platform_ini, 'r') as fp:
        data = fp.readlines()

    for i in range(len(data)):
        if data[i].startswith('SourceRepository='):
            data[i] = 'SourceRepository=%s\n' % gecko_repo
        elif data[i].startswith('SourceStamp='):
            data[i] = 'SourceStamp=%s\n' % gecko_rev

    with open(platform_ini, 'w') as fp:
        fp.writelines(data)

    output.write('platform.ini updated.\n')


def gen_sourcestamp(output):
    buildid = os.environ.get('MOZ_BUILD_DATE')
    if buildid and len(buildid) != 14:
        print('Ignoring invalid MOZ_BUILD_DATE: %s' % buildid, file=sys.stderr)
        buildid = None
    if not buildid:
        buildid = datetime.now().strftime('%Y%m%d%H%M%S')
    output.write('{}\n'.format(buildid))

    gecko_repo, gecko_rev = get_gecko_repo_info()
    comm_repo, comm_rev  = get_comm_repo_info()
    if gecko_repo:
        output.write('{}\n'.format(get_source_url(gecko_repo, gecko_rev)))

    if comm_repo:
        output.write('{}\n'.format(get_source_url(comm_repo, comm_rev)))


def source_repo_header(output):
    """
    Appends the Gecko source repository information to source-repo.h
    This information should be set in buildconfig.substs by moz.configure
    """
    gecko_repo, gecko_rev = get_gecko_repo_info()
    comm_repo, comm_rev  = get_comm_repo_info()

    if None in [gecko_repo, gecko_rev, comm_repo, comm_rev]:
        Exception("Source information not found in buildconfig."
                  "Try setting GECKO_HEAD_REPOSITORY and GECKO_HEAD_REV"
                  "as well as MOZ_SOURCE_REPO and MOZ_SOURCE_CHANGESET"
                  "environment variables and running mach configure again.")

    output.write('#define MOZ_GECKO_SOURCE_STAMP {}\n'.format(gecko_rev))
    if comm_rev:
        output.write('#define MOZ_COMM_SOURCE_STAMP {}\n'.format(comm_rev))
        output.write('#define MOZ_SOURCE_STAMP {}\n'.format(comm_rev))
    else:
        output.write('#define MOZ_SOURCE_STAMP {}\n'.format(gecko_rev))

    if buildconfig.substs.get('MOZ_INCLUDE_SOURCE_INFO') and gecko_repo:
        gecko_source_url = get_source_url(gecko_repo, gecko_rev)
        output.write('#define MOZ_GECKO_SOURCE_REPO {}\n'.format(gecko_repo))
        output.write('#define MOZ_GECKO_SOURCE_URL {}\n'.format(gecko_source_url))
        if comm_repo:
            comm_source_url = get_source_url(comm_repo, comm_rev)
            output.write('#define MOZ_COMM_SOURCE_REPO {}\n'.format(comm_repo))
            output.write('#define MOZ_COMM_SOURCE_URL {}\n'.format(comm_source_url))
            output.write('#define MOZ_SOURCE_REPO {}\n'.format(comm_repo))
            output.write('#define MOZ_SOURCE_URL {}\n'.format(comm_source_url))
        else:
            output.write('#define MOZ_SOURCE_REPO {}\n'.format(gecko_repo))
            output.write('#define MOZ_SOURCE_URL {}\n'.format(gecko_source_url))


def main(args):
    if args:
        func = globals().get(args[0])
        if func:
            return func(sys.stdout, *args[1:])

    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
