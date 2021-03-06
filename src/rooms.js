"use strict";

var fs = require('fs'),
io = require('../server').io,
players = require('../server').players,
areas = require('../server').areas;

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
				room.getExits(rooms[i], function(exits) {
					room.getPlayers(s, rooms[i], function(playersInRoom) {
						room.getItems(rooms[i], {}, function(items) {
							room.getMonsters(rooms[i], {specific: 'short'}, function(monsters) {
								if (exits.length > 0) {
								 	roomStr += '<li class="room-exits">Visible Exits: ' + 
								 	exits.join(', ') + '</li>';
								} else {
									roomStr += '<li class="room-exits">Visible Exits: None!</li>';
								}
								
								if (playersInRoom.length > 0 || monsters.length > 0) {
									roomStr += '<li>Here:' + playersInRoom.join(', ') +
									' ' + monsters.join(', ') + '</li>';
								}

								visibleItems = items.slice(0)
									.filter(function(item){
										return item.itemType != 'scenery';
									})
									.map(function(item) { return item.short; });
								if (visibleItems.length > 0) {
									roomStr += '<li>Items: ' + visibleItems.join(', ') + '</li>';
								}
							
								s.emit('msg', {
									msg: '<h2 class="room-title">' + rooms[i].title + '<span class="area">' + s.player.area + '</span></h2>' +
									'<p class="room-content">' + rooms[i].content + '</p>' + 
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
	var arr = [],
	i = 0;
	
	for (i; i < room.exits.length; i += 1) {
		arr.push(room.exits[i].cmd);
	}
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
	return this.get(room, 'items', optObj, fn);
}

Room.prototype.getMonsters = function(room, optObj, fn) {
	return this.get(room, 'monsters', optObj, fn);
}

Room.prototype.get = function(room, thing, optObj, fn) {
	var arr = room[thing].slice(0);

	if (optObj.specific != undefined) {
		arr = arr.map(function (element) {
			return element[optObj.specific];
		});
	}
	if (optObj.map != undefined) {
		arr = arr.map(optObj.map);
	}
	return fn(arr);
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
		var i = 0;

		if (roomObj.exits.length > 0) {
			for (i; i < roomObj.exits.length; i += 1) {
				if (direction === roomObj.exits[i].cmd) {
					return fn(true, roomObj.exits[i].vnum);
				}
			}
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

	room.getRoomObject({area: s.player.area, id: s.player.roomid}, function(roomObj) {
		var msgPatt = new RegExp('\\b' + name, 'i'),
		i = 0;
		
		if (roomObj.monsters.length > 0) {
			for (i; i < roomObj.monsters.length; i += 1) {
				if (msgPatt.test(roomObj.monsters[i].name)) {
					return fn(true, roomObj.monsters[i]);
				}
			}
		}
		return fn(false);
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
	
	room.getRoomObject({area: s.player.area, id: s.player.roomid}, function(roomObj) {
		if (roomObj.items.length > 0) {
			return room.getItems(roomObj, {}, function(items) {
				var msgPatt = new RegExp('\\b' + name, 'i'),
				i = 0;

				for (i; i < items.length; i++) {
					if (msgPatt.test(items[i].name)) {
						return fn(true, items[i]);
					}
				}
				return fn(false);
			});
		}
		return fn(false);
	});
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