/*
* All non-combat commands that one would consider 'general' to a all
* users (like get, look, and movement). Anything combat (even potentially) related is in skills.js
*/
"use strict";

var fs = require('fs'),
Character = require('./character').character,
Room = require('./rooms').room,
Combat = require('./combat').combat,
io = require('../server').io,
players = require('../server').players,
time = require('../server').time,
areas = require('../server').areas;

var Cmd = function () {
	this.commands = [];
};

Cmd.prototype.dispatch = function(s, r) {
	var i = 0,
		z = 0,
		params = {},
		map = [],
		result = false;

	for(i; i < this.commands.length; i++) {
		if(result = r.msg.match(this.commands[i].match)) {
			// If a submatch map was provided, map the submatches to named parameters
			if (typeof this.commands[i].map !== 'undefined' && this.commands[i].map.constructor == Array) {
				map = this.commands[i].map.slice(0);
				map.unshift("entire");
				for (z; z < map.length; z++) {
					params[map[z]] = result[z] ? result[z] : '';
				}
			}
			r.params = params;
			return this.commands[i].fn;
		}
	}
	return false;
}

Cmd.prototype.addCommand = function(match, fn, map) {
	this.commands.push({match: match, fn: fn, map: map});
}

/**
 * Command.  Add a new command to the command list
 * @param s
 * @param r
 * @todo make this function work
 */
Cmd.prototype.addNewCommand = function(s, r) {
	if (s.player.role === 'admin') {
		Cmd.addCommand(new RegExp(r.params.command, 'i'), r.params.method);
		s.emit('msg', {
			msg: 'Command added.'
		});
	}
	else {
		s.emit('msg', {msg: 'You do not possess that kind of power.', styleClass: 'error' });
	}
}

/**
 * Command. Move the player
 * @param socket s
 * @param object r Command object
 * @returns {*}
 */
Cmd.prototype.move = function(s, r) {
	var direction = '';

	if (s.player.position !== 'fighting' && s.player.position !== 'resting' && s.player.position !== 'sleeping' && s.player.cmv > 5) {
		direction = r.params.direction;

		Room.checkExit(s, direction, function(found, roomId) {
			if (found) {
				// Send a message to the old room, declaring the player's departure
				Room.msgToRoom({
					msg: s.player.name + ' the ' + s.player.race + ' walks ' + r.cmd + '.', 
					playerName: s.player.name, 
					roomid: s.player.roomid
				}, true);

				// Change the player's remaining move points and room
				s.player.cmv = Math.round((s.player.cmv - (12 - s.player.dex/4)));
				s.player.roomid = roomId; // Make the adjustment in the socket character reference.

				Character.updatePlayer(s);

				// Send a message to the new room, declaring the player's arrival
				Room.getRoomObject({
					area: s.player.area,
					id: roomId
				}, function(roomObj) {
					Room.getRoom(s, function() {
						Room.msgToRoom({
							msg: s.player.name + ' the ' + s.player.race + ' enters the room.', 
							playerName: s.player.name, 
							roomid: roomId
						}, true, function() {
							return Character.prompt(s);
						});
					});
				});
			} else {
				s.emit('msg', {
					msg: 'There is no exit in that direction.', 
					styleClass: 'error'
				});

				return Character.prompt(s);
			}
		}); 
	} else {
		s.emit('msg', {
			msg: 'You cant move right now!', 
			styleClass: 'error'
		});

		return Character.prompt(s);
	}
}

/**
 * Show who is online
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.who = function(s, r) {
	var str = '', 
	player,
	i = 0;
	
	if (players.length > 0) {
		for (i; i < players.length; i += 1) {
			player = io.sockets.socket(players[i].sid).player; // A visible player in players[]

			str += '<li>' + player.name + ' ';

			if (player.title === '') {
				str += 'a level ' + player.level   +
					' ' + player.race + 
					' ' + player.charClass; 
			} else {
				str += player.title;
			}					

			str += ' (' + player.role + ')</li>';
		}
					
		s.emit('msg', {
			msg: '<h1>Visible Players</h1>' + str, 
			styleClass: 'who-cmd'
		});
	} else {
		s.emit('msg', {
			msg: '<h1>No Visible Players</h1>', 
			styleClass: 'who-cmd'
		});
	}
	
	return Character.prompt(s);
}

/**
 * Provide an error command for commands that require a target
 * @param s
 * @param r
 */
Cmd.prototype.doWhat = function(s, r) {
	s.emit('msg', {msg: r.params.what + ' <i>what</i>?', styleClass: 'error'});
}

/**
 * Get an item
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.get = function(s, r) {
	Room.checkItem(s, r.params.target, function(found, item) {
		if (found) {
			if(item.itemType == 'scenery') {
				s.emit('msg', {msg: "You can't get that.", styleClass: 'error'});
				return Character.prompt(s);
			}
			else {
				Character.addToInventory(s, item, function (added) {
					if (added) {
						Room.removeItem({area: s.player.area, id: s.player.roomid}, item, function () {
							console.log(item);
							s.emit('msg', {
								msg: 'You picked up ' + item.short,
								styleClass: 'get'
							});

							return Character.prompt(s);
						});
					}
					else {
						s.emit('msg', {msg: 'Could not pick up a ' + item.short, styleClass: 'error'});
						return Character.prompt(s);
					}
				});
			}
		} else {
			s.emit('msg', {msg: 'That item is not here.', styleClass: 'error'});
			return Character.prompt(s);
		}
	});
}

/**
/**
 * Drop an item
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.drop = function(s, r) {
	var doDrop = function(s, item) {
		Character.removeFromInventory(s, item, function(removed) {
			if (removed) {
				Room.addItem({area: s.player.area, id: s.player.roomid}, item, function() {
					s.emit('msg', {
						msg: 'You dropped ' + item.short,
						styleClass: 'get'
					});
					return Character.prompt(s);
				});
			} else {
				s.emit('msg', {msg: 'Could not drop a ' + item.short, styleClass: 'error'});
				return Character.prompt(s);
			}
		});
	};
	Character.checkInventory(s, r.params.target, function(found, item) {
		if (found) {
			if(item.equipped) {
				Character.remove(s, item, function(removeSuccess, msg) {
					s.emit('msg', {msg: msg, styleClass: 'cmd-wear'});
					doDrop(s, item);
				});
			}
			else {
				doDrop(s, item);
			}
		} else {
			s.emit('msg', {msg: "You are not carrying that item.", styleClass: 'error'});
			return Character.prompt(s);
		}
	});
}


/**
 * For attacking in-game monsters
 * @param s
 * @param r
 * @todo Offload this combat stuff entirely to the combat module
 * @todo Implement a better speed/initiative order
 * @todo Implement "things you can't do when you're dead"
 */
Cmd.prototype.kill = function(s, r) {
	Room.checkMonster(s, r.params.target, function(found, monster) {
		if (found) {
			s.emit('msg', {msg: 'You enter deadly combat with ' + monster.short + '!', styleClass: 'combat begin'});

			Combat.begin(s, monster);
		} else {
			s.emit('msg', {msg: 'There is no creature by that name here.', styleClass: 'error'});
			return Character.prompt(s);
		}
	});
}

/**
 * Command. Show the description of the current room
 * @param Socket s
 * @param Object r
 */
Cmd.prototype.look = function(s, r) {
	Room.getRoom(s, function(room) {
		return Character.prompt(s);
	});
}

/**
 * Command. Show the description of a thing in the current room
 * @param Socket s
 * @param Object r
 */
Cmd.prototype.lookAt = function(s, r) {
	// Gave us a noun, so lets see if something matches it in the room.
	Room.checkMonster(s, r.params.target, function(found, monster) {
		if(found) {
			s.emit('msg', {msg: monster.long});
		}
		else {
			Room.checkItem(s, r.params.target, function (found, item) {
				if(found) {
					s.emit('msg', {msg: item.long});
				}
				else {
					Character.checkInventory(s, r.params.target, function(found, item) {
						if(found) {
							s.emit('msg', {msg: item.long});
						}
						else {
							s.emit('msg', {msg: "You don't see that here."});
						}
					})
				}
				return Character.prompt(s);
			});
		}
	});
}

/**
 * Provide some information about the current location
 * @param s
 * @returns {*}
 */
Cmd.prototype.where = function(s) {
	var msg = '<ul>' +
	'<li>Your Name: ' + s.player.name + '</li>' +
	'<li>Current Area: ' + s.player.area + '</li>' +
	'<li>Room Number: ' + s.player.roomid + '</li>'  +
	'</ul>';

	s.emit('msg', {msg: msg, styleClass: 'playerinfo where'});
	return Character.prompt(s);
};


/** Communication Channels **/

/**
 * Say something aloud in the current player room
 * @param s
 * @param r
 */
Cmd.prototype.say = function(s, r) {
	var speech = r.params.speech;
	speech = speech.replace(/[<>'"&]/g, function(v){return '&#' + v.charCodeAt(0) + ';';}); // Fast dirty htmlEncode

	s.emit('msg', {msg: 'You say> ' + speech, styleClass: 'cmd-say'});
	
	Room.msgToRoom({
		msg: s.player.name + ' says> ' + r.params.speech,
		playerName: s.player.name, 
		roomid: s.player.roomid
	}, true);
};

/**
 * Say something aloud in the current player room
 * @param s
 * @param r
 */
Cmd.prototype.emote = function(s, r) {
	var speech = r.params.speech;
	speech = speech.replace(/[<>'"&]/g, function(v){return '&#' + v.charCodeAt(0) + ';';}); // Fast dirty htmlEncode

	s.emit('msg', {msg: s.player.name + ' (you) ' + speech, styleClass: 'cmd-emote'});

	Room.msgToRoom({
		msg: s.player.name + ' ' + speech,
		playerName: s.player.name,
		roomid: s.player.roomid,
		styleClass: 'cmd-emote'
	}, true);
};

/**
 * Yell to other players in the room
 * @param s
 * @param r
 */
Cmd.prototype.yell = function(s, r) {
	var speech = r.params.speech;
	speech = speech.replace(/[<>'"&]/g, function(v){return '&#' + v.charCodeAt(0) + ';';}); // Fast dirty htmlEncode

	s.emit('msg', {msg: 'You yell> ' + speech, styleClass: 'cmd-say cmd-yell'});
	
	Room.msgToArea({
		msg: s.player.name + ' yells> ' + speech +  '.',
		playerName: s.player.name, styleClass: 'cmd-say cmd-yell'
	}, true);
};

/**
 * Chat with players in broadcast
 * @param s
 * @param r
 */
Cmd.prototype.chat = function(s, r) {
	var speech = r.params.speech;
	speech = speech.replace(/[<>'"&]/g, function(v){return '&#' + v.charCodeAt(0) + ';';}); // Fast dirty htmlEncode

	s.emit('msg', {
		msg: 'You chat> ' + speech,
		element: 'blockquote',
		styleClass: 'msg'
	});

	s.in('mud').broadcast.emit('msg', {
		msg: s.player.name + '> ' + speech,
		element: 'blockquote',
		styleClass: 'chatmsg'
	});

	/* 
	If you want to return prompt after each message you can use the below,
	be sure to define i

	for (i; i < players.length; i += 1) {
		Character.prompt(s);
		s = io.sockets.socket(players[i].sid);
	}	
	*/
};

/*
Cmd.prototype.tell = function(r, s) {
	var i  = 0;
	
	s.emit('msg', {msg: 'You tell ' + r.playerName + '> ' + r.msg, styleClass: 'cmd-say'});
	
	Character.msgToPlayer({
		msg: s.player.name + ' tells you> ' + r.msg +  '.', 
		playerName: s.player.name
	}, true);
};

Cmd.prototype.reply = function(r, s) {
	var i  = 0;
	
	s.emit('msg', {msg: 'You reply to ' + s.player.reply + '> ' + r.msg, styleClass: 'cmd-say'});
	
	Character.msgToPlayer({
		msg: s.player.name + ' tells you> ' + r.msg +  '.', 
		playerName: s.player.name
	}, true);
};
*/

/**
 * Broadcast a message to all players as an admin
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.achat = function(s, r) {
	var speech = r.params.speech;
	speech = speech.replace(/[<>'"&]/g, function(v){return '&#' + v.charCodeAt(0) + ';';}); // Fast dirty htmlEncode

	if (s.player.role === 'admin') {
		s.emit('msg', {
			msg: 'You achat> ' + speech,
			element: 'blockquote',
			styleClass: 'adminmsg'
		});

		s.in('mud').broadcast.emit('msg', {
			msg: s.player.name + ' the Admin> ' + speech,
			element: 'blockquote',
			styleClass: 'adminmsg'
		});
	} else {
		s.emit('msg', {msg: 'You do not have permission to execute this command.'});
		return Character.prompt(s);
	}
};

// Viewing the time
Cmd.prototype.time = function(s, r) {

}

/** Related to Saving and character adjustment/interaction **/

/**
 * Save the current player data
 * @param s
 */
Cmd.prototype.save = function(s) {
	Character.save(s, function() {
		s.emit('msg', {msg: s.player.name + ' was saved!', styleClass: 'save'});
		return Character.prompt(s);
	});
}

/**
 * Change the character's title
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.title = function(s, r) {
	if (r.params.title.length < 40) {
		if (r.params.title != 'title') {
			s.player.title = r.params.title;
		} else {
			s.player.title = 'a level ' + s.player.level + ' ' + s.player.race + ' ' + s.player.charClass;
		}

		Character.updatePlayer(s, function(updated) {
			s.emit('msg', {msg: 'Your title was changed!', styleClass: 'save'})
			return Character.prompt(s);
		});
	} else {
		s.emit('msg', {msg: 'That title is too long.', styleClass: 'save'});
		return Character.prompt(s);
	}
}


/**
 * View Equipped items and locations
 * @param s
 * @returns {*}
 */
Cmd.prototype.equipment = function(s) {
	var bodyAreas = Object.keys(s.player.eq),
	eqStr = '',
	i = 0;

	for (i; i < s.player.eq.length; i += 1) {
		eqStr += '<tr class="slot-' + s.player.eq[i].slot.replace(/ /g, '') +
			'"><th>' + s.player.eq[i].name + '</th>';
		
		if (s.player.eq[i].item === null || s.player.eq[i].item === '') {
			eqStr += '<td>--</td>';
		} else {
			eqStr += '<td>'  + s.player.eq[i].item.short + '</td>';
		}
		eqStr += '</tr>';
	}
	
	s.emit('msg', {
		msg: '<h3>You are wearing:</h3><table class="equipment-list">' + eqStr + '</table>',
		styleClass: 'cmd-eq' 
	});
	
	return Character.prompt(s);
}

/**
 * List the player's skills
 * @param s
 * @returns {*}
 */
Cmd.prototype.skills = function(s) {
	var skills = '',
	i = 0;
	
	if (s.player.skills.length > 0) {
		for (i; i < s.player.skills.length; i += 1) {
			skills += s.player.skills[i].name;
		}
		
		s.emit('msg', {msg: 'skills', styleClass: 'eq' });
		return Character.prompt(s);
	} else {
		s.emit('msg', {msg: 'skills', styleClass: 'eq' });
		return Character.prompt(s);
	}
}

/**
 * Equip an item
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.wear = function(s, r) {
	Character.checkInventory(s, r.params.target, function(found, item) {
		if (found) {
			Character.wear(s, item, function(wearSuccess, msg) {
				s.emit('msg', {msg: msg, styleClass: 'cmd-wear'});
				return Character.prompt(s);
			});
		} else {
			s.emit('msg', {msg: 'You are not carrying that item.', styleClass: 'error'});
			return Character.prompt(s);
		}
	});
}

Cmd.prototype.remove = function(s, r) {
	Character.checkEquipment(s, r.params.target, function(found, item) {
		if (found) {
			Character.remove(s, item, function(removeSuccess, msg) {
				s.emit('msg', {msg: msg, styleClass: 'cmd-wear'});
				return Character.prompt(s);
			});
		} else {
			s.emit('msg', {msg: 'You are not wearing that.', styleClass: 'error'});
			return Character.prompt(s);
		}
	});
}

/**
 * Display a list of carried things
 * @param s
 * @param r
 * @returns {*}
 */
Cmd.prototype.inventory = function(s) {
	var iStr = '',
	i = 0;
	
	if (s.player.items.length > 0) {
		for (i; i < s.player.items.length; i += 1) {
			if (!s.player.items[i].equipped) {
				iStr += '<li>' + s.player.items[i].short + '</li>';
			} else {
				iStr += '<li>' + s.player.items[i].short + ' (Equipped) </li>';
			}		
		}
		
		s.emit('msg', {msg: '<ul>' + iStr + '</ul>', styleClass: 'inventory' });
	} else {
		s.emit('msg', {msg: 'No items in your inventory, can carry ' + s.player.carry + ' pounds of gear.', styleClass: 'inventory' });
	}
	return Character.prompt(s);
}

/**
 * Display character stats
 * @param s
 * @returns {*}
 */
Cmd.prototype.score = function(s) {
	var i = 0,
	score = '<div class="score-name">' + s.player.name + 
	' <div class="score-title">' + s.player.title + '</div></div>' +
	'<ul class="score-info">' + 
		'<li class="stat-hp">HP: ' + s.player.chp + '/' + s.player.hp +'</li>' +
		'<li class="stat-mana">Mana: ' + s.player.cmana + '/' + s.player.mana +'</li>' +
		'<li class="stat-mv">Moves: ' + s.player.cmv + '/' + s.player.mv +'</li>' +
		'<li class="stat-level">You are a level '+ s.player.level + ' ' + s.player.race + ' ' + s.player.charClass + '</li>' +
		'<li class="stat-xp">XP: ' + s.player.exp + '/' + s.player.expToLevel + '</li>' +  
		'<li class="stat-position">Position: ' + s.player.position + '</li>' +
		'<li class="stat-carry">Carrying ' + s.player.load + '/' + Character.getLoad(s) + ' pounds.</li>' +
	'</ul>' +
	'<ul class="score-stats">' + 
		'<li class="stat-str">STR: ' + s.player.str + '</li>' +
		'<li class="stat-wis">WIS: ' + s.player.wis + '</li>' +
		'<li class="stat-int">INT: ' + s.player.int + '</li>' +
		'<li class="stat-dex">DEX: ' + s.player.dex + '</li>' +
		'<li class="stat-con">CON: ' + s.player.con + '</li>' +
		'<li class="stat-armor">Armor: ' + s.player.ac + '</li>' +
		'<li class="stat-gold">Gold: ' + s.player.gold + '</li>' +
		'<li class="stat-hunger">Hunger: ' + s.player.hunger + '</li>' +
		'<li class="stat-thirst">Thirst: ' + s.player.thirst + '</li>' +
	'</ul>';

	if (s.player.affects.length > 0) {
		score += '<ul class="score-affects">';

		for (i; i < s.player.affects; i += 1) {
			score += '<li>' + affects[i].name + '</li>';
		}

		score += '</ul>';
	} else {
		score += '<ul class="score-affects"><li>No Affects</li></ul>';
	}
	
	s.emit('msg', {msg: score, element: 'section', styleClass: 'score' });
	
	return Character.prompt(s);
}

/**
 * Quit the game
 * @param Socket s
 */
Cmd.prototype.quit = function(s) {
	Character.save(s, function() {
		s.emit('token', {user: '', token: ''});

		s.emit('msg', {
			msg: 'Add a little to a little and there will be a big pile.',
			emit: 'disconnect',
			styleClass: 'logout-msg'
		});

		s.leave('mud');
		s.disconnect();
	});
}

/**
 * Display default help or on a specific topic
 * @param Socket s
 * @param Object r
 */
Cmd.prototype.help = function(s, r) {
	// if we don't list a specific help file we return help.json
	var helpTxt = '',
		helpfile = 'help';

	if (r.params.topic != '') {
		helpfile = r.params.topic.toLowerCase().replace(/\s/g, '_').replace('.', '_');
	}
	fs.readFile('./help/' + helpfile + '.json', function (err, data) {
		if (!err) {
			data = JSON.parse(data);

			helpTxt = '<header><h2>Help: ' + data.name + '</h2></header><p>' + data.description + '</p>';
			if(data.related.length) {
				helpTxt += '<footer class="help-related">Related: '
				for(var i = 0; i < data.related.length; i++) {
					helpTxt += '<a class="clickcmd" href="help ' + data.related[i] + '">' + data.related[i] + '</a>';
				}
				helpTxt += '</footer>';
			}

			s.emit('msg', {msg: helpTxt, styleClass: 'cmd-help' });
		} else {
			s.emit('msg', {msg: 'No help file found.', styleClass: 'error' });
		}
		return Character.prompt(s);
	});
}

Cmd.prototype.xyzzy = function(r, s) {
	Room.msgToRoom({
		msg: s.player.name + 	' tries to xyzzy but nothing happens.', 
		roomid: s.player.roomid,
		styleClass: 'error'
	}, true, function() {
		s.emit('msg', {msg: 'Nothing happens!', styleClass: 'error' });

		return Character.prompt(s);
	});
}

/*
* Special Admin commands below here. You can confirm permission with a value connected to the current player  
*/

/*
* View a string representation of the JSON behind a world object.
* Syntax: json objectType (item, room, monster or player)
* typing 'json' alone will give the json object for the entire current room. 
*/
Cmd.prototype.json = function(r, s) {
	if (s.player.role === 'admin') {
		
	} else {
		s.emit('msg', {msg: 'Nothing happens!', styleClass: 'error' });
	}
}

/*
* A soft game reboot. 
* Stops all combat and reloads all active areas and players without restarting the server. Checks users role.
*/
Cmd.prototype.reboot = function(r, s) {
}

Cmd.prototype.reload = function(s) {
	if (s.player.role === 'admin') {
		areas = [];
		Room.reload();

		s.emit('msg', {msg: 'Reloaded areas, monsters, and items.' });
	} else {
		s.emit('msg', {msg: 'You do not possess that kind of power.', styleClass: 'error' });
		return Character.prompt(s);
	}
}

/**
 * Fully heal everyone on the MUD
 * @param s
 * @returns {*}
 */
Cmd.prototype.restore = function(s) {
	var player,
		i = 0,
		healed = 0;

	if (s.player.role === 'admin') {
		if (players.length > 0) {
			for (i; i < players.length; i += 1) {
				player = io.sockets.socket(players[i].sid); // A visible player in players[]

				if(player.player.chp != player.player.hp) {
					healed++;
					player.player.chp = player.player.hp;
					player.player.hunger = 0;
					player.player.thirst = 0;
					player.emit('msg', {
						msg: 'You have been fully healed by an admin.',
						styleClass: 'foe-miss'
					});
				}
			}

			if(healed > 0) {
				s.emit('msg', {
					msg: 'You have healed ' + healed + ' players.'
				});
			}
			else {
				s.emit('msg', {
					msg: 'No players required healing.'
				});
			}
		}
		else {
			s.emit('msg', {
				msg: 'No players were healed.'
			});
		}

	} else {
		s.emit('msg', {msg: 'You do not possess that kind of power.', styleClass: 'error' });
	}
	return Character.prompt(s);
}

module.exports.cmd = new Cmd();