/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is ChatZilla.
 *
 * The Initial Developer of the Original Code is James Ross.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   James Ross <silver@warwickcompsoc.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/* The serialized file format is pretty generic... each line (using any line
 * separator, so we don't mind being moved between platforms) consists of
 * a command name, and some parameters (optionally). The commands 'start'
 * and 'end' mark the chunks of properties for each object - in this case
 * motifs. Every command inside a start/end block is considered a property
 * for the object. There are some rules, but we are generally pretty flexible.
 *
 * Example file:
 *   START <Array>
 *     START 0
 *       "message" "Food%3a%20Mmm...%20food..."
 *     END
 *     START 1
 *       "message" "Busy%3a%20Working."
 *     END
 *     START 2
 *       "message" "Not%20here."
 *     END
 *   END
 *
 * The whitespace at the start of the inner lines is generated by the
 * serialisation process, but is ignored when parsing - it is only to make
 * the file more readable.
 *
 * The START command may be followed by one or both of a class name (enclosed
 * in angle brackets, as above) and a property name (the first non-<>-enclosed
 * word). Top-level START commands must not have a property name, although a
 * class name is fine. Only the following class names are supported:
 *   - Object (the default)
 *   - Array
 *
 * For arrays, there are some limitations; saving an array cannot save any
 * properties that are not numerics, due to limitations in JS' for...in
 * enumeration. Thus, for loading, only items with numeric property names are
 * allowed. If an item is STARTed inside an array, and specifies no property
 * name, it will be push()ed into the array instead.
 */

function TextSerializer(file)
{
    this._initialized = false;
    if (typeof file == "string")
        this._file = new nsLocalFile(file);
    else
        this._file = file;
    this._open = false;
    this._buffer = "";
    this._lines = [];
    this.lineEnd = "\n";
    this._initialized = true;
}

/* open(direction)
 *
 * Opens the serializer on the file specified when created, in either the read
 * ("<") or write (">") directions. When the file is open, only the appropriate
 * direction of serialization/deserialization may be performed.
 *
 * Note: serialize and deserialize automatically open the file if it is not
 *       open.
 */
TextSerializer.prototype.open =
function ts_open(dir)
{
    if (!ASSERT((dir == ">") || (dir == "<"), "Bad serialization direction!"))
        return false;
    if (this._open)
        return false;

    this._fileStream = new LocalFile(this._file, dir);
    if ((typeof this._fileStream == "object") && this._fileStream)
        this._open = true;

    return this._open;
}

/* close()
 *
 * Closes the file stream and ends reading or writing.
 */
TextSerializer.prototype.close =
function ts_close()
{
    if (this._open)
    {
        this._fileStream.close();
        delete this._fileStream;
        this._open = false;
    }
    return true;
}

/* serialize(object)
 *
 * Serializes a single object into the file stream. All properties of the object
 * are stored in the stream, including properties that contain other objects.
 */
TextSerializer.prototype.serialize =
function ts_serialize(obj)
{
    if (!this._open)
        this.open(">");
    if (!ASSERT(this._open, "Unable to open the file for writing!"))
        return false;

    var me = this;

    function writeObjProps(o, indent)
    {
        function writeProp(name, val)
        {
            me._fileStream.write(indent + "\"" + ecmaEscape(name) + "\" " + val +
                                 me.lineEnd);
        };

        for (var p in o)
        {
            switch (typeof o[p])
            {
                case "string":
                    writeProp(p, '"' + ecmaEscape(o[p]) + '"');
                    break;

                case "number":
                    writeProp(p, o[p]);
                    break;

                case "function":
                    if (o[p] instanceof RegExp)
                        writeProp(p, ecmaEscape("" + o[p]));
                    // Can't serialize non-RegExp functions (yet).
                    break;

                case "null":
                    writeProp(p, "null");
                    break;

                case "undefined":
                    writeProp(p, "undefined");
                    break;

                case "object":
                    var className = "";
                    if (o[p] instanceof Array)
                        className = "<Array> ";

                    me._fileStream.write(indent + "START " + className +
                                         ecmaEscape(p) + me.lineEnd);
                    writeObjProps(o[p], indent + "  ");
                    me._fileStream.write(indent + "END" + me.lineEnd);
                    break;

                default:
                    // Can't handle anything else!
            }
        }
    };

    if (obj instanceof Array)
        this._fileStream.write("START <Array>" + this.lineEnd);
    else
        this._fileStream.write("START" + this.lineEnd);
    writeObjProps(obj, "  ");
    this._fileStream.write("END" + this.lineEnd);
}

/* deserialize()
 *
 * Reads in enough of the file to deserialize (realize) a single object. The
 * object deserialized is returned; all sub-properties of the object are
 * deserialized with it.
 */
TextSerializer.prototype.deserialize =
function ts_deserialize()
{
    if (!this._open)
        this.open("<");
    if (!ASSERT(this._open, "Unable to open the file for reading!"))
        return false;

    var obj = null;
    var rv = null;
    var objs = new Array();

    while (true)
    {
        if (this._lines.length == 0)
        {
            this._buffer += this._fileStream.read();
            // Got more data in the buffer, so split into lines.
            // The last one doesn't count - the rest get added to the full list.
            var lines = this._buffer.split(/[\r\n]+/);
            this._buffer = lines.pop();
            this._lines = this._lines.concat(lines);
            if (this._lines.length == 0)
                break;
        }

        // Split each line into "command params...".
        var parts = this._lines[0].match(/^\s*(\S+)(?:\s+(.*))?$/);
        var command = parts[1];
        var params = parts[2];

        // 'start' and 'end' commands are special.
        switch (command.toLowerCase())
        {
            case "start":
                var paramList = new Array();
                if (params)
                    paramList = params.split(/\s+/g);

                var className = "";
                if ((paramList.length > 0) && /^<\w+>$/i.test(paramList[0]))
                {
                    className = paramList[0].substr(1, paramList[0].length - 2);
                    paramList.shift();
                }

                if (!rv)
                {
                    /* The top-level objects are not allowed a property name
                     * in their START command (it is meaningless).
                     */
                    ASSERT(paramList.length == 0, "Base object with name!");
                    // Construct the top-level object.
                    if (className)
                        rv = obj = new window[className]();
                    else
                        rv = obj = new Object();
                }
                else
                {
                    var n;
                    if (paramList.length == 0)
                    {
                        /* Create a new object level, but with no name. This is
                         * only valid if the parent level is an array.
                         */
                        if (!ASSERT(obj instanceof Array, "Parent not Array!"))
                            return null;
                        if (className)
                            n = new window[className]();
                        else
                            n = new Object();
                        objs.push(obj);
                        obj.push(n);
                        obj = n;
                    }
                    else
                    {
                        /* Create a new object level, store the reference on the
                         * parent, and set the new object as the current.
                         */
                        if (className)
                            n = new window[className]();
                        else
                            n = new Object();
                        objs.push(obj);
                        obj[ecmaUnescape(paramList[0])] = n;
                        obj = n;
                    }
                }

                this._lines.shift();
                break;

            case "end":
                this._lines.shift();
                if (rv && (objs.length == 0))
                {
                    // We're done for the day.
                    return rv;
                }
                // Return to the previous object level.
                obj = objs.pop();
                if (!ASSERT(obj, "Waaa! no object level to return to!"))
                    return rv;
                break;

            default:
                this._lines.shift();
                // The property name may be enclosed in quotes.
                if (command[0] == '"')
                    command = command.substr(1, command.length - 2);
                // But it is always escaped.
                command = ecmaUnescape(command);

                if (!obj)
                {
                    /* If we find a line that is NOT starting a new object, and
                     * we don't have a current object, we just assume the START
                     * command was missed.
                     */
                    rv = obj = new Object();
                }
                if (params[0] == '"') // String
                {
                    // Remove quotes, then unescape.
                    params = params.substr(1, params.length - 2);
                    obj[command] = ecmaUnescape(params);
                }
                else if (params[0] == "/") // RegExp
                {
                    var p = params.match(/^\/(.*)\/(\w*)$/);
                    if (ASSERT(p, "RepExp entry malformed, ignored!"))
                    {
                        var re = new RegExp(ecmaUnescape(p[1]), p[2]);
                        obj[command] = re;
                    }
                }
                else if (params == "null") // null
                {
                    obj[command] = null;
                }
                else if (params == "undefined") // undefined
                {
                    obj[command] = undefined;
                }
                else // Number
                {
                    obj[command] = Number(params);
                }
                break;
        }
    }
    return null;
}
