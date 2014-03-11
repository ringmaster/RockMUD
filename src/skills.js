"use strict";

var Dice = require('./dice').roller,
Character = require('./character').character,
Room = require('./rooms').room,
io = require('../server').io,
players = require('../server').players,
areas = require('../server').areas,

Skill = function() {

};

/*
* Melee Skills
*/
Skill.prototype.bash = function(r, s) { 
	if (s.player.position === 'fighting' && s.player.class == 'fighter') {
		s.emit('msg', {msg: 'BASH!', styleClass: 'skill bash'});
	}
}

module.exports.skill = new Skill();
