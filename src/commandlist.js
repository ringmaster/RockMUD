"use strict";

var cmd = require('./commands').cmd;

cmd.addCommand(/^(?:help|\?)(?:\s+(.*))?$/i, cmd.help, ["topic"]);
cmd.addCommand(/^l(ook)?( around)?$/i, cmd.look);
cmd.addCommand(/^l(?:ook)?\s+(?:at\s+)?(.+)?$/i, cmd.lookAt, ["target"]);
cmd.addCommand(/^move (.+)$/i, cmd.move, ["direction"]);
