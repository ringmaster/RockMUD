"use strict";

var cmd = require('./commands').cmd,
	skill = require('./skills').skill;

cmd.addCommand(/^(?:help|\?)(?:\s+(.*))?$/i, cmd.help, ["topic"]);

cmd.addCommand(/^l(ook)?( around)?$/i, cmd.look);
cmd.addCommand(/^l(?:ook)?\s+(?:at\s+)?(.+)?$/i, cmd.lookAt, ["target"]);

cmd.addCommand(/^(?:move|go)\s+(.+)$/i, cmd.move, ["direction"]);
cmd.addCommand(/^(north|east|south|west|up|down|enter|exit)$/i, cmd.move, ["direction"]);
cmd.addCommand(/^where$/i, cmd.where);

cmd.addCommand(/^who$/i, cmd.who);
cmd.addCommand(/^(wear|drop|remove|get|take|pick up|leave|put down|equip|kill)$/i, cmd.doWhat, ["what"]);

cmd.addCommand(/^(?:get|take|pick up) +(?:(?:the|a|an) +)?(.+)$/i, cmd.get, ["target"]);
cmd.addCommand(/^(?:drop|leave|put down) +(?:(?:the|a|an) +)?(.+)$/i, cmd.drop, ["target"]);
cmd.addCommand(/^(?:wear|wield|equip|eq) +(?:(?:the|a|an) +)?(.+)$/i, cmd.wear, ["target"]);
cmd.addCommand(/^(?:remove|unequip|dequip|de) +(?:(?:the|a|an) +)?(.+)$/i, cmd.remove, ["target"]);
cmd.addCommand(/^i(nventory)?$/i, cmd.inventory);
cmd.addCommand(/^eq(uipment)?$/i, cmd.equipment);

cmd.addCommand(/^restore$/i, cmd.restore);
cmd.addCommand(/^reload$/i, cmd.reload);

cmd.addCommand(/^save$/i, cmd.save);
cmd.addCommand(/^(score|stats)$/i, cmd.score);
cmd.addCommand(/^skills$/i, cmd.skills);
cmd.addCommand(/^quit$/i, cmd.quit);

cmd.addCommand(/^kill (.+)$/i, cmd.kill, ["target"]);
cmd.addCommand(/^bash$/i, skill.bash);

cmd.addCommand(/^(title)$/i, cmd.title, ["title"]);
cmd.addCommand(/^title (.+)$/i, cmd.title, ["title"]);

cmd.addCommand(/^(?:say |")([^"].*)$/i, cmd.say, ["speech"]);
cmd.addCommand(/^(?:yell |!)(.+)$/i, cmd.yell, ["speech"]);
cmd.addCommand(/^(?:emote |:)(.+)$/i, cmd.emote, ["speech"]);
cmd.addCommand(/^chat (.+)$/i, cmd.chat, ["speech"]);
cmd.addCommand(/^(?:wall(?:op) |achat |""")(.+)$/i, cmd.achat, ["speech"]);

