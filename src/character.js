/*
Characters.js controls everything dealing with a character.json file, no in game commands are
defined here. Commands.js does share some function names with this module, as they -- are --  commands 
and therefore defined in commands.js. See: save().
*/
"use strict";

var fs = require('fs'),
crypto = require('crypto'),
Room = require('./rooms').room,
Dice = require('./dice').roller,
races = require('../config').server.races,
classes = require('../config').server.classes,
players = require('../server').players,
areas = require('../server').areas;

var Character = function () {

}

Character.prototype.exists = function(s, name, fn) {
	name = name.replace(/_.*/,'').toLowerCase();

	if (name.length > 3 ) {
		if (/^[a-z]+$/.test(name) === true) {
			fs.stat('./players/' + name + '.json', function (err, stat) {
				if (err === null) {
					return fn(s, name, true);
				} else {
					return fn(s, name, false);
				}
			});
		} else {
			return s.emit('msg', {msg : '<b>Invalid Entry</b>. Enter your name:', res: 'login', styleClass: 'enter-name'});
		}
	} else {
		s.emit('msg', {
			msg: 'Invalid name choice, must be more than three characters.',
			res: 'login',
			styleClass: 'error'
		});
	}
}

Character.prototype.load = function(s, name, fn) {
	var playerFile = './players/'  + name + '.json';
	fs.readFile(playerFile, function (err, r) {
		if (err) {
			throw err;
		}

		try {
			s.player = JSON.parse(r);
		}
		catch(e) {
			s.emit('msg', {msg: 'Your character was unable to be loaded.  The stored character file may be corrupt and has been moved to a backup file.'});

			var done = function(err) {
				if (!cbCalled) {
					cbCalled = true;
					fs.unlink(playerFile, function(){
						s.emit('msg', {msg : 'Enter your name:', res: 'login', styleClass: 'enter-name'})
					})
				}
			}

			var cbCalled = false;
			var rd = fs.createReadStream(playerFile);
			rd.on("error", done);

			var wr = fs.createWriteStream(playerFile + '.bak');
			wr.on("error", done);
			wr.on("close", function() { done(); });
			rd.pipe(wr);
			return fn(s, false);
		}

		s.player.filename = name;
		s.player.sid = s.id;

		return fn(s, true);
	});
}

Character.prototype.hashPassword = function(salt, password, iterations, fn) {
	var hash = password,
	i = 0;
		
	for (i; i < iterations; i += 1) {
		hash = crypto.createHmac('sha512', salt).update(hash).digest('hex');
	} 
			
	return fn(hash);
};

Character.prototype.generateSalt = function(fn) {
	crypto.randomBytes(128, function(ex, buf) {
		if (ex) {
			throw ex;
		}
			
		fn(buf.toString('hex'));
	});
};

Character.prototype.getPassword = function(s, fn) {
	var character = this;
	s.emit('msg', {msg: 'What is your password: ', res: 'enterPassword'});

	s.on('password', function (r) {
		if (r.msg.length > 7) {
			character.hashPassword(s.player.salt, r.msg, 1000, function(hash) {
				if (s.player.password === hash) {
					return fn(s);
				} else {
					s.emit('msg', {msg: 'Wrong! You are flagged after 5 incorrect responses.', res: 'enterPassword'});
					return s.emit('msg', {msg: 'What is your password: ', res: 'enterPassword'});
				}
			});
		} else {
			s.emit('msg', {msg: 'Password had to be over eight characters.', res: 'enterPassword'});
			return s.emit('msg', {msg: 'What is your password: ', res: 'enterPassword'});
		}
	});
}

Character.prototype.validateToken = function(s, token, fn) {
	var character = this;

	character.hashPassword(s.player.salt, token, 1000, function(hash) {
		if (s.player.token === hash) {
			return fn(s);
		} else {
			return s.emit('msg', {msg : 'Enter your name:', res: 'login', styleClass: 'enter-name'});
		}
	});
}

// Add a player reference object to the players array
Character.prototype.addPlayer = function(s, fn) {
	var  i = 0;	

	if (players.length > 0) {
		for (i; i < players.length; i += 1) {
			if (s.player.name === players[i].name) {
				return fn(false, 'Already Logged in');
			}
		}
		
		players.push({
			name: s.player.name, 
			sid: s.id,
			area: s.player.area,
			roomid: s.player.roomid
		});

		return fn(true);
	} else {
		players.push({
			name: s.player.name, 
			sid: s.id,
			area: s.player.area,
			roomid: s.player.roomid
		});

		return fn(true);
	}
}

/**
 * Player is authenticated, process login
 * @param r
 * @param s
 * @param fn
 */
Character.prototype.login = function(s, fn) {
	var character = this;

	character.addPlayer(s, function(added, msg) {
		if (added) {
			Room.checkArea(s.player.area, function(found, area) {
				if (found) {
					areas.push(area);
				}
			});

			character.motd(s, function() {
				Room.getRoom(s, function() {
					fn(s);
					return character.prompt(s);
				});
			});

			character.generateSalt(function(privToken){
				character.hashPassword(s.player.salt, privToken, 1000, function(hash) {
					s.player.token = hash;
					character.save(s, function(){
						s.emit('token', {user: s.player.name, token: privToken});
					})
				});
			});

		} else {
			if (msg === undefined) {
				s.emit('msg', {msg: 'Error logging in, please retry.'});
				return s.disconnect();
			} else {
				s.emit('msg', {msg: msg});
				s.emit('msg', {msg : 'Enter your name:', res: 'login', styleClass: 'enter-name'});
			}
		}
	});

}

//  A New Character is saved
Character.prototype.create = function(r, s, fn) { 
	var character = this;

	s.player = {
		name: s.player.name,
		lastname: '',
		title: '',
		role: 'player',
		password: s.player.password,
		salt: '',
		race: s.player.race,
		sex: '',
		charClass: s.player.charClass,
		created: new Date().toString(), // time of creation
		level: 1,
		exp: 1,
		expToLevel: 1000,
		position: 'standing',
		alignment: 0,
		chp: 100, // current hp
		hp: 100, // total hp
		cmana: 100,
		mana: 100,
		cmv: 80,
		mv: 100,
		str: 13,
		wis: 13,
		int: 12,
		dex: 12,
		con: 13,
		wait: 0,
		ac: 10,
		gold: 5,
		hunger: 0,
		thirst: 0,
		load: 3,
		visible: true,
		attackType: 'punch',
		area: 'midgaard', // must match an area file
		roomid: 1, // current room
		recall: 1, // id to recall to
		description: 'A brand new citizen.',
		reply: '',
		following: '',
		eq: [{
			name: 'Head',
			item: null,
			slot: 'head'
		}, {
			name: 'Necklace 1',
			item: null,
			slot: 'head'
		}, {
			name: 'Necklace 2',
			item: null,
			slot: 'head'
		}, {
			name: 'Body',
			item: null,
			slot: 'body'
		}, {
			name: 'Chest',
			item: null,
			slot: 'body'
		}, {
			name: 'About Body',
			item: null,
			slot: 'body'
		}, {
			name: 'Right Arm',
			item: null,
			slot: 'arms'
		}, {
			name: 'Left Arm',
			item: null,
			slot: 'arms'
		}, {
			name: 'Right Hand',
			item: null,
			dual: false,
			slot: 'hands'
		}, {
			name: 'Left Hand',
			item: null,
			dual: false,
			slot: 'hands'
		}, {
			name: 'Ring 1',
			item: null,
			slot: 'fingers'
		}, {
			name: 'Ring 2',
			item: null,
			slot: 'fingers'
		}, {
			name: 'Right Leg',
			item: null,
			slot: 'legs'
		}, {
			name: 'Left Leg',
			item: null,
			slot: 'legs'
		}, {
			name: 'Feet',
			item: null,
			slot: 'feet'
		}, {
			name: 'Floating',
			item: null,
			slot: 'floating'
		}],
		items: [
			{
				"name": "Pot Pie", 
				"short": "A Chicken Pot Pie",
				"long": "An over-stuffed simple pot pie",
				"id": 4, 
				"area": "all",
				"level": 1,
				"itemType": "food",
				"weight": 2,
				"flags": [
					{"hunger": -7},
					{"carry": 1} 
				]
			},
			{
				"name": "Burlap Sack", 
				"short": "A Burlap Sack",
				"long": "An over-used burlap sack with many tears",
				"id": 5, 
				"area": "all",
				"level": 1,
				"itemType": "container",
				"weight": 1,
				"maxWeight": 40,
				"contains": []
			}
		],
		affects: [],
		racials: [],
		skills: [],
		skillList: [],
		prevent: ['flame'],
		autoloot: true,
		autosac: false
	};
	
	character.rollStats(s.player, function(player) {
		s.player = player;
	
		character.generateSalt(function(salt) {
			s.player.salt = salt;
			character.hashPassword(salt, s.player.password, 1000, function(hash) {
				s.player.password = hash;
				fs.writeFile('./players/' + s.player.name + '.json', JSON.stringify(s.player, null, 4), function (err) {
					var i = 0;
		
					if (err) {
						throw err;
					}
					
					for (i; i < players.length; i += 1) {
						if (players[i].sid === s.id) {
							players.splice(i, 1);
						}
					}
		
					s.leave('creation'); // No longer creating the character so leave the channel and join the game
					s.join('mud');		
					
					character.addPlayer(s, function(added) {
						if (added) {
							character.motd(s, function() {
								fn(s);
								Room.getRoom(s);			
								character.prompt(s);
							});
						} else {
							s.emit('msg', {msg: 'Error logging in, please retry.'});
							s.disconnect();
						}
					});
				});	
			});
		});	
	});
}

// Rolling stats for a new character
Character.prototype.rollStats = function(player, fn) { 
	var i = 0,
	j = 0,
	raceKey, // property of the race defines in raceList
	classKey; // property of the class defines in classList

	for (i; i < races.length; i += 1) {		// looking for race
		if (races[i].name.toLowerCase() === player.race) {	 // found race		
			for (raceKey in player) {
				if (player[raceKey] in races[i] && raceKey !== 'name') { // found, add in stat bonus						
						player[player[raceKey]] = player[player[raceKey]] + races[i][player[raceKey]];	
				}
			}
		}		
				
		if (i === races.length - 1) { // rolling stats is finished
			for (j; j < classes.length; j += 1) { // looking through classes
				if (classes[j].name.toLowerCase() === player.charClass) { // class match found
					for (classKey in player) {
						if (classKey in classes[j] && classKey !== 'name') {
							if (!classes[j][classKey].length) {
								player[classKey] = classes[j][classKey] + player[classKey];
							} else {
								player[classKey].push(classes[j][classKey]);
							}
						} 
					}
				}
			}
			
			player.carry = player.str * 10;
			return fn(player);
		}
	}		
}

Character.prototype.newCharacter = function(r, s, fn) {
	var character = this,
	i = 0,
	str = '';

	for (i; i < races.length; i += 1) {
		str += '<li class="race-list-'+ races[i].name + '">' + races[i].name + '</li>';

		if	(races.length - 1 === i) {
			s.emit('msg', {msg: s.player.name + ' is a new character! There are three more steps until ' + s.player.name + 
			' is saved. The next step is to select your race: <ul>' + str + '</ul><p class="tip">You can learn more about each race by typing help race name</p>', res: 'selectRace', styleClass: 'race-selection'});		

			s.on('raceSelection', function (r) { 
				var cmdArr = r.msg.split(' ');

				r.cmd = cmdArr[0].toLowerCase();
				r.msg = cmdArr.slice(1).join(' ');
	
				character.raceSelection(r, s, function(r, s, fnd) {
					if (fnd) {
						i = 0;
						str = '';
						s.player.race = r.cmd;

						for (i; i < classes.length; i += 1) {
							str += '<li>' + classes[i].name + '</li>';

							if	(classes.length - 1 === i) {
								s.emit('msg', {
									msg: 'Great! Now time to select a class for ' + s.player.name + '. Pick on of the following: <ul>' + 
									str + '</ul>', 
									res: 'selectClass', 
									styleClass: 'race-selection'
								});
								
								s.on('classSelection', function(r) {
									r.msg = r.msg.toLowerCase();
			
									character.classSelection(r, function(fnd) {
										if (fnd) {
											s.player.charClass = r.msg;
											
											s.emit('msg', {
												msg: s.player.name + ' is a ' + s.player.charClass + '! There is 1 more step before ' + s.player.name + 
												' is saved. Please define a password (8 or more characters):', 
												res: 'createPassword', 
												styleClass: 'race-selection'
											});	
								
											s.on('setPassword', function(r) {
												if (r.msg.length > 7) {
													s.player.password = r.msg;
													character.create(r, s, fn);
												} else {
													s.emit('msg', {msg: 'Password should be longer', styleClass: 'error' });
												}											
											});											
										} else {
											s.emit('msg', {msg: 'That class is not on the list, please try again', styleClass: 'error' });
										}									
									}); 
								});
							}
						}										
					} else if (!fnd && r.cmd !== 'help') {
						s.emit('msg', {msg: 'That race is not on the list, please try again', styleClass: 'error' });
					}
				});
			});			
		}
	}	
}

Character.prototype.raceSelection = function(r, s, fn) {
	var i = 0;

	if (r.cmd !== 'help') {	
		for (i; i < races.length; i += 1) {
			if (r.cmd === races[i].name.toLowerCase()) {
				return fn(r, s, true);
			}
		}

		return fn(r, s, false);
	} else {
		fs.readFile('./help/' + r.msg + '.json', function (err, data) {
			if (!err) {
				data = JSON.parse(data);

				var helpTxt = '<h2>Race Profile: ' + data.name + '</h2> ' + data.description +
				'<h3>Benefits:</h3><p class="small">Related: '+ data.related.toString() + '</p>';

				s.emit('msg', {msg: helpTxt, styleClass: 'cmd-help' });

				return fn(r, s, false);
			} else {
				s.emit('msg', {msg: 'No help file found for this race.', styleClass: 'error' });	

				return fn(r, s, false);
			}
		});	
	}
}

Character.prototype.classSelection = function(r, fn) {
	var i = 0;	
	
	for (i; i < classes.length; i += 1) {
		if (r.msg === classes[i].name.toLowerCase()) {
			return fn(true)
		}
	}
	
	return fn(false)
}

Character.prototype.motd = function(s, fn) {
	fs.readFile('./motd.json', function (err, data) {
		if (err) {
			throw err;
		}
	
		s.emit('msg', {msg : JSON.parse(data).motd, res: 'logged', styleClass: 'motd'});
		return fn();
	});
}

Character.prototype.save = function(s, fn) {
	var character = this;

	if (s.player !== undefined) {
		s.player.saved = new Date().toString();
	
		fs.writeFile('./players/' + s.player.filename + '.json', JSON.stringify(s.player, null, 4), function (err) {
			if (err) {
				return s.emit('msg', {msg: 'Error saving character.'});
			} else {
				character.updatePlayer(s, function() {
					if (typeof fn === 'function') {
						return fn();
					}
				})
			}
		});
	};
}

Character.prototype.hpRegen = function(s, fn) {
	var conMod = Math.ceil(s.player.con/4);

	if (s.player.chp < s.player.hp) {

		if (s.player.position === 'sleeping') {
			conMod = conMod + 2;
		}

		Dice.roll(1, 8, function(total) {
			if (typeof fn === 'function') {
				fn(s.player.chp + total + conMod);
			} else {
				s.player.chp = s.player.chp + total + conMod;
				
				if (s.player.chp > s.player.hp) {
					return s.player.chp = s.player.hp;
				} 
			}
		});
	} else {
		fn(s.player.chp);
	}
}

Character.prototype.hunger = function(s, fn) {
	var character = this,
	conMod = Math.ceil(s.player.con/3);
	
	if (s.player.hunger < 10) {
		Dice.roll(1, 4, function(total) {
			if ((total + conMod) < s.player.con/2) { 
				s.player.hunger = s.player.hunger + 1;
			}			
						
			if (s.player.hunger >= 5) {	
				if (total < 4) {
					s.player.chp = s.player.chp - (s.player.chp / 5 + conMod);
				}
			
				s.emit('msg', {msg: 'You are hungry.', styleClass: 'hunger'});
		
				fn();
			}
		});
	} else {
		s.player.chp = (s.player.chp - 10 + conMod);
		s.emit('msg', {msg: 'You are dying of hunger.', styleClass: 'hunger'});
		
		fn();
	}
}

Character.prototype.thirst = function(s, fn) {
	var character = this,
	dexMod = Math.ceil(s.player.dex/3);

	if (s.player.thirst < 10) {
		Dice.roll(1, 4, function(total) {
			if (total + dexMod < 5) { 
				s.player.chp = s.player.chp - (s.player.chp / 4 + dexMod);
			}			
						
			if (s.player.thirst >= 5) {
				s.player.chp = s.player.chp - 1;
			}

			s.emit('msg', {msg: 'You need to find something to drink.', styleClass: 'thirst'});

			fn();
		});	
	} else {
		s.player.chp = (s.player.chp - 5 + dexMod);
		s.emit('msg', {msg: 'You are dying of thirst.', styleClass: 'thirst'});
		
		fn();
	}
}

/**
 * Callback with whether an item with the passed name is in the players inventory
 * @param Socket s
 * @param string itemname
 * @param function fn(boolean found, object item)
 * @returns {*}
 */
Character.prototype.checkInventory = function(s, itemname, fn) {
	var i = 0,
		msgPattern = new RegExp('\\b' + itemname, 'i');
	
	if (s.player.items.length > 0) {
		for (i; i < s.player.items.length; i++) {
			if (msgPattern.test(s.player.items[i].name)) {
				return fn(true, s.player.items[i]);
			}
		}
	}
	return fn(false);
}

/**
 * Push an item into this player's inventory
 * @param Socket s
 * @param Object item
 * @param function fn(boolean success)
 */
Character.prototype.addToInventory = function(s, item, fn) {
	s.player.items.push(item);
	
	if(typeof fn !== 'undefined') fn(true);
}

/**
 * Remove an item from inventory
 * @param Socket s
 * @param Object itemObj
 * @param function fn(boolean success)
 * @returns {*}
 */
Character.prototype.removeFromInventory = function(s, itemObj, fn) {
	var removed = false;
	if (s.player.items.length > 0) {
		s.player.items = s.player.items.filter(function(item) {
			if (item.id !== itemObj.id) {
				removed = true;
				return true;
			}
		});
	}
	if (typeof fn === 'function') {
		return fn(removed);
	}
}

Character.prototype.wear = function(s, item, fn) {
	var i = 0,
	replacedItem;

	for (i; i < s.player.eq.length; i++) {
		if (item.slot === s.player.eq[i].slot && item.equipped === false) {
			if (item.itemType === 'weapon') {
				item.equipped = true;
				 
				// Wielding weapons
				if (item.weight < (20 + s.player.str)) { // Dual check

				}

				if (s.player.eq[i].dual === false && s.player.eq[i].item === null) {
					s.player.eq[i].item = item;

					return fn(true, 'You wield ' + item.short + ' in your ' + s.player.eq[i].name);
				}
			} else {
				// Wearing Armor
				if (s.player.eq[i].item === null) {
					item.equipped = true;
					s.player.eq[i].item = item;

					s.player.ac = s.player.ac + item.ac;
					
					return fn(true, 'You wear ' + item.short + ' on your ' + s.player.eq[i].name);
				} else {
					item.equipped = true;
					s.player.eq[i].item.equipped = false;

					replacedItem = s.player.eq[i].item;
					s.player.eq[i].item = item;

					s.player.ac = s.player.ac - replacedItem.ac;

					s.player.ac = s.player.ac + item.ac

					return fn(true, 'You wear ' + item.short + ' on your ' + 
						s.player.eq[i].name + ' and remove ' + 
						replacedItem.short);
				}
			}
		} 
	}
	return fn(false, 'You must remove gear to have room for that item.');
}

Character.prototype.remove = function( s, item, fn) {
	var i = 0;

	for (i; i < s.player.eq.length; i++) {
		if(s.player.eq[i].item == item) {
			return this.checkInventory(s, s.player.eq[i].item.name, function(found, item) {
				item.equipped = false; // Set item in inventory to be not equipped
				s.player.eq[i].item = null; // Remove item from equipment list
				switch(item.itemType) {
					case 'weapon':
						return fn(true, 'You no longer wield a ' + item.short + ' in your ' + s.player.eq[i].name);
					case 'armor':
						return fn(true, 'You removed a ' + item.short + ' from your ' + s.player.eq[i].name);
				}
			});
		}
	}
	return fn(true, 'You are not wearing a ' + item.short + '.');
}

// boolean if item with the same vnum is in a players equipment
Character.prototype.checkEquipment = function(s, itemName, fn) {
	var pattern = new RegExp('\\b' + itemName, 'i'),
		eqs = s.player.eq.slice(0).filter(function(slot){
			return slot.item != null && pattern.test(slot.item.name);
		});
	if(eqs.length > 0) {
		return fn(true, eqs.shift().item);
	}
	return fn(false);
}

Character.prototype.getLoad = function(s, fn) {
	var load = Math.round((s.player.str + s.player.con / 4) * 10);
			
	if (typeof fn === 'function') {
		fn(load);
	} else {
		return load;
	}
};

// Updates a players reference in players[] with some data attached to the socket
Character.prototype.updatePlayer = function(s, fn) {
	var  i = 0;

	for (i; i < players.length; i += 1) {
		if (s.player.name === players[i].name) {
			players[i] = {
				name: s.player.name, 
				sid: s.id,
				area: s.player.area,
				roomid: s.player.roomid
			};
			
			if (typeof fn === 'function') {
				fn(true);
			} 
		}
	}
}

Character.prototype.prompt = function(s) {
	return s.emit('prompt', {
		chp: s.player.chp,
		hp: s.player.hp,
		cmana: s.player.cmana,
		mana: s.player.mana,
		cmv: s.player.cmv,
		mv: s.player.mv,
		room: s.player.roomid,
		wait: s.player.wait
	});
}

Character.prototype.level = function(s, fn) {

}

module.exports.character = new Character();