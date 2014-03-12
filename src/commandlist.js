"use strict";

var cmd = require('./commands').cmd;

cmd.addCommand(/^(?:help|\?)(?:\s+(.*))?$/i, cmd.help, ["topic"]);

cmd.addCommand(/^l(ook)?( around)?$/i, cmd.look);
cmd.addCommand(/^l(?:ook)?\s+(?:at\s+)?(.+)?$/i, cmd.lookAt, ["target"]);

cmd.addCommand(/^(?:move|go)\s+(.+)$/i, cmd.move, ["direction"]);
cmd.addCommand(/^(north|east|south|west|up|down|enter|exit)$/i, cmd.move, ["direction"]);

cmd.addCommand(/^who$/i, cmd.who);

cmd.addCommand(/^(?:get|take|pick up) +(.+)$/i, cmd.get, ["target"]);
