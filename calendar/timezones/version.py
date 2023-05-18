#!/usr/bin/python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import io
import json
import os.path

json_file = os.path.join(os.path.dirname(os.path.realpath(__file__)), "zones.json")

with io.open(json_file, "r", encoding='utf-8') as fp:
    data = json.load(fp)
    print(data["version"])
