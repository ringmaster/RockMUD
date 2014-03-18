"use strict";

var fs = require('fs'),
	server = require('../server'),
	async = require('async'),
	io = server.io,
	players = server.players,
	areas = server.areas,
	items = require('./items');

var Room = function() {
 
}

// Returns an entire area
Room.prototype.getArea = function(areaName, fn) {
	fs.readFile('./areas/' + areaName + '.json', function (err, area) {
		return fn(true, JSON.parse(area));
	});
}

// return boolean after checking if the area is in areas[]
Room.prototype.checkArea = function(areaName, fn) {
	var room = this,
		i;
	for(i = 0; i < areas.length; i++) {
		if (areaName === areas[i].name.toLowerCase()) {
			return fn(true, areas[i]);
		}
	}
	fs.exists('./areas/' + areaName + '.json', function(exists) {
		if(exists) {
			room.getArea(areaName, function(success, area) {
				if(success) {
					areas.push(area);
					fn(true, area);
				}
				else {
					fn(false);
				}
			});
		}
		else {
			fn(false);
		}
	});
};

// Returns a specific room for display, to return the room Obj use getRoomObject
Room.prototype.getRoom = function(s, fn) {
	var room = this,
	displayRoom = function(rooms, fn) {
		var i = 0,
			roomStr = '',
			visibleItems = [];

		for (i; i < rooms.length; i += 1) {
			if (rooms[i].id === s.player.roomid) {
				(function(roomIndex) {
					room.getExits(rooms[roomIndex], function (exits) {
						room.getPlayers(s, rooms[roomIndex], function (playersInRoom) {
							room.getItems(rooms[roomIndex], {}, function (itemList) {
								room.getMonsters(rooms[roomIndex], {specific: 'short'}, function (monsters) {
									if (exits.length > 0) {
										roomStr += '<li class="room-exits">Visible Exits: ' +
											exits.join(', ') + '</li>';
									}
									else {
										roomStr += '<li class="room-exits">Visible Exits: None!</li>';
									}

									if (playersInRoom.length > 0 || monsters.length > 0) {
										roomStr += '<li>Here:' + playersInRoom.join(', ') +
											' ' + monsters.join(', ') + '</li>';
									}

									visibleItems = itemList.slice(0)
										.filter(function (item) {
											return !items.has(item, 'scenery');
										})
										.map(function (item) {
											return item.short;
										});
									if (visibleItems.length > 0) {
										roomStr += '<li>Items: ' + visibleItems.join(', ') + '</li>';
									}

									s.emit('msg', {
										msg: '<h2 class="room-title">' + rooms[roomIndex].title + '<span class="area">' + s.player.area + '</span></h2>' +
											'<p class="room-content">' + rooms[roomIndex].content + '</p>' +
											'<ul class="room-extras">' + roomStr + '</ul>',
										styleClass: 'room'
									});

									if (typeof fn === 'function') {
										return fn();
									}
								});
							});
						});
					});
				})(i);
			}
		}	
	};
	
	room.checkArea(s.player.area, function(found, area) {
		if (found) { //  area was in areas[]
			displayRoom(area.rooms);

			if (typeof fn === 'function') {
				return fn();
			}
		}
		else {
			s.emit('msg', {msg: 'There was a general error loading the room description.', styleClass: 'error'});
		}
	});
}

// Refreshes the area reference in areas[]
Room.prototype.updateArea = function(areaName, fn) {
	var  i = 0;

	for (i; i < areas.length; i += 1) {
		if (areaName === areas[i].name) {
			fs.readFile('./areas/' + areaName + '.json', function (err, area) {
				var area = JSON.parse(area);
				
				areas[i] = area;
				
				if (typeof fn === 'function') {
					return fn(true);
				}
			});
		} else {
			return fn(false);
		}
	}
}

/**
 * Reload all room data
 * Really, unload all room data, then let it be reloaded on demand
 * @param fn
 */
Room.prototype.reload = function(fn) {
	areas = [];
	if(typeof fn == 'function') {
		fn(true);
	}
}

// Return a room in memory as an object, pass in the area name and the room vnum {area: 'Midgaard', vnum: 1}
Room.prototype.getRoomObject = function(room, fn) {
	this.checkArea(room.area, function(fnd, area) {
		var i = 0;

		if (fnd) { //  area was in areas[]
			for (i; i < area.rooms.length; i += 1) {
				if (area.rooms[i].id === room.id) {
					return fn(area.rooms[i]);
				} 
			}
		}
	});
}

Room.prototype.getExits = function(room, fn) {
	var arr = Object.keys(room.exits);
	return fn(arr);
}

// This needs to look like getItems() for returning a player obj based on room
Room.prototype.getPlayers = function(s, room, fn) {
	var arr = [],
	player,
	i = 0;

	for (i; i < players.length; i += 1) {
		player = io.sockets.socket(players[i].sid).player;
		if (player.roomid === s.player.roomid && player.name !== s.player.name) {
			arr.push(' ' + player.name + ' the ' + player.race + ' is ' + player.position + ' here');
		}
	}

	return fn(arr);
}

Room.prototype.getItems = function(room, optObj, fn) {
	return this.get(room, 'item', optObj, fn);
}

Room.prototype.getMonsters = function(room, optObj, fn) {
	return this.get(room, 'monster', optObj, fn);
}

Room.prototype.get = function(room, thing, optObj, fn) {
	var here = room.here.slice(0)

	// Filter items to the type of thing required.
	here = here.filter(function(element){
		return element.type == thing;
	});

	if(here.length > 0) {
		// Convert the linked id into the object itself

		async.map(here, items.get.bind(items), function (err, here) {
			// If a specific key from the object is requested, map to it
			if (optObj.specific != undefined) {
				here = here.map(function (element) {
					return element[optObj.specific];
				});
			}
			// If a map was provided, map to it
			if (optObj.map != undefined) {
				here = here.map(optObj.map);
			}
			return fn(here);
		})
	}
	else {
		return fn([]);
	}
}

/**
 * Check if a named exit matches any exit in the current room, return it
 * @param socket s
 * @param string direction The direction to check
 * @param function fn (boolean found, integer roomId) Callback for result
 */
Room.prototype.checkExit = function(s, direction, fn) {
	var room = this;
	
	room.getRoomObject({area: s.player.area, id: s.player.roomid}, function(roomObj) {
		if(typeof roomObj.exits[direction] !== undefined) {
			return fn(true, roomObj.exits[direction]);
		}

		return fn(false);
	});
}

/**
 * Match a name to a monster
 * @param s
 * @param name
 * @param fn
 */
Room.prototype.checkMonster = function(s, name, fn) {
	var room = this;

	return room.checkThing(s, name, 'monster', fn);
}

/**
 * Match a name to a thing (item/monster)
 * @param s
 * @param name
 * @param fn
 */
Room.prototype.checkThing = function(s, name, thing, fn) {
	var room = this;

	room.getRoomObject({area: s.player.area, id: s.player.roomid}, function(roomObj) {
		var msgPatt = new RegExp('\\b' + name, 'i'),
			i = 0;

		room.get(roomObj, thing, {}, function(things){
			if (things.length > 0) {
				for (i; i < things.length; i++) {
					if (msgPatt.test(things[i].name)) {
						return fn(true, things[i]);
					}
				}
			}
			return fn(false);
		})
	});
}



// Remove a monster from a room
Room.prototype.removeMonster = function(roomQuery, monster, fn) {
	this.getRoomObject(roomQuery, function(roomObj) {
		var result = false;
		roomObj.monsters = roomObj.monsters.filter(function(item) {
			result |= item.id === monster.id;
			return item.id !== monster.id;
		});
		return fn(result);
	});
}

// does a string match an item in the room
Room.prototype.checkItem = function(s, name, fn) {
	var room = this;

	return room.checkThing(s, name, 'item', fn);
};

/**
 * Turn a monster into its corpse
 * @todo Specify a "corpse" property in the monster definition.  Each turns into a generic corpse of a type, like
 * animal, humanoid, etc.  This way, as a bonus, some monsters could even turn into a new monster when killed.
 * @param s
 * @param monster
 * @param fn
 * @returns {*}
 */
Room.prototype.addCorpse = function(s, monster, fn) {
	this.getRoomObject({
		area: s.player.area,
		id: s.player.roomid
	}, function(roomObj) {
		monster.short = 'rotting corpse of a ' + monster.name;
		monster.flags.push({decay: 5});
		monster.itemType = 'corpse';
		monster.id = monster.id + '-corpse';
		monster.weight = monster.weight - 2;
		monster.chp = 0;
		monster.hp = 0;

		roomObj.items.push(monster);
	});
	
	return fn();
}

/**
 * Remove an item from a room
 * @param Object room
 * @param Object item
 * @param fn
 * @returns {*}
 */
Room.prototype.removeItem = function (room, item, fn) {
	var found = false;
	this.getRoomObject(room, function(roomObj) {
		roomObj.items = roomObj.items.filter(function(roomItem, i) {
			if (item.id === roomItem.id) {
				found = true;
				return false;
			}
			return true;
		});
	});
	return fn(found);
}

/**
 * Add an item to a room
 * @param Object room
 * @param Object itemObj
 * @param function fn()
 * @returns {*}
 */
Room.prototype.addItem = function(room, itemObj, fn) {
	this.getRoomObject(room, function(roomObj) {
		roomObj.items.push(itemObj);
	});
	
	return fn();
}

// Emit a message to all the rooms players
Room.prototype.msgToRoom = function(msgOpt, exclude, fn) {
	var i = 0,
	s;

	for (i; i < players.length; i++) {
		s = io.sockets.socket(players[i].sid);
		if (exclude === undefined || exclude === true) {
			if (s.player.name !== msgOpt.playerName && s.player.roomid === msgOpt.roomid) {
				s.emit('msg', {
					msg: msgOpt.msg, 
					styleClass: msgOpt.styleClass
				});
			} 
		} else {
			if (s.player.roomid === msgOpt.roomid) {
				s.emit('msg', {
					msg: msgOpt.msg, 
					styleClass: msgOpt.styleClass
				});
			} 
		}
	}

	if (typeof fn === 'function') {
		return fn();
	}
}

// Emit a message to all the players in an area
Room.prototype.msgToArea = function(msgOpt, exclude, fn) {
	var i = 0,
	s;

	for (i; i < players.length; i++) {
		s = io.sockets.socket(players[i].sid);
		if (exclude === undefined || exclude === true) {
			if (s.player.name !== msgOpt.playerName && s.player.area === msgOpt.area) {
				s.emit('msg', {
					msg: msgOpt.msg, 
					styleClass: msgOpt.styleClass
				});
			} 
		} else {
			if (s.player.area === msgOpt.area) {
				s.emit('msg', {
					msg: msgOpt.msg, 
					styleClass: msgOpt.styleClass
				});
			} 
		}
	}

	if (typeof fn === 'function') {
		return fn();
	}
}

module.exports.room = new Room();