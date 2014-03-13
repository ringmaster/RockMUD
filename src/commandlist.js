"use strict";

var cmd = require('./commands').cmd;

cmd.addCommand(/^(?:help|\?)(?:\s+(.*))?$/i, cmd.help, ["topic"]);

cmd.addCommand(/^l(ook)?( around)?$/i, cmd.look);
cmd.addCommand(/^l(?:ook)?\s+(?:at\s+)?(.+)?$/i, cmd.lookAt, ["target"]);

cmd.addCommand(/^(?:move|go)\s+(.+)$/i, cmd.move, ["direction"]);
cmd.addCommand(/^(north|east|south|west|up|down|enter|exit)$/i, cmd.move, ["direction"]);

cmd.addCommand(/^who$/i, cmd.who);

cmd.addCommand(/^(?:get|take|pick up) +(.+)$/i, cmd.get, ["target"]);
cmd.addCommand(/^(?:drop|leave|put down) +(.+)$/i, cmd.drop, ["target"]);
cmd.addCommand(/^i(nventory)?$/i, cmd.inventory);

cmd.addCommand(/^restore$/i, cmd.restore);
cmd.addCommand(/^save$/i, cmd.save);
cmd.addCommand(/^score$/i, cmd.score);

cmd.addCommand(/^kill (.+)$/i, cmd.kill, ["target"]);

cmd.addCommand(/^(?:say |")(.+)$/i, cmd.say, ["speech"]);
cmd.addCommand(/^(?:emote |:)(.+)$/i, cmd.emote, ["speech"]);

