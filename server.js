/*
 * RockMUD, NodeJS HTTP/WS Mud Engine
 * Rocky Bevins, 2013 (moreoutput@gmail.com)
 * We want to be able to build Browser, Diku-style, MUDs with only JS/JSON. 
*/
"use strict";

var http = require('http'),
fs = require('fs'),
cfg = require('./config').server.game,
url = require('url'),
path = require('path'),
server = http.createServer(function (req, res) {
	var uri, filename;
	var mimeTypes = {'html': 'text/html', 'png': 'image/png',
		'js': 'text/javascript', 'css': 'text/css'};

	uri = url.parse(req.url).pathname;
	uri = uri.replace(/\.+/g, '.').replace(/\/+/g, '/').replace(/[^a-z0-9\.\/_]+/g, '');
	switch(uri) {
		case '/':
		case '':
			uri = '/index.html';
			break;
	}
	filename = path.join(process.cwd(), 'public', uri);
	path.exists(filename, function(exists){
		var extension, mimeType, fileStream;
		if (exists) {
			extension = path.extname(filename).substr(1);
			mimeType = mimeTypes[extension] || 'application/octet-stream';
			res.writeHead(200, {'Content-Type': mimeType});
			console.log('serving ' + filename + ' as ' + mimeType);

			fs.readFile(filename, function (err, data) {
				if (err) {
					throw err;
				}

				data = data
					.toString()
					.replace(/\{servername\}/g, cfg.name)
					.replace(/\{version\}/g, cfg.version)
					.replace(/\{website\}/g, cfg.website);
				res.write(data);
				res.end();
			});

		} else {
			console.log('not exists: ' + filename);
			res.writeHead(404, {'Content-Type': 'text/plain'});
			res.write('404 Not Found\n');
			res.end();
		}
	});
}),
io = require('socket.io').listen(server);

// considering referencing these within their respective modules, ex: Character.players rather than players[]
module.exports.io = io; 
module.exports.players = [];
module.exports.areas = [];
module.exports.time = fs.readFile('./data/time.json');

if (!module.exports.time) {
	module.exports.time = {	
		year: '100',
		month: 'March',
		day: 8,
		hour: 12,
		minute: 13,
		name: 'The year of MUD'
	};

	fs.writeFile('./data/time.json', JSON.stringify(module.exports.time, null, 4));
}

var Character = require('./src/character').character,
Cmds = require('./src/commands').cmd,
Skills = require('./src/skills').skill,
Ticks = require('./src/ticks');

require('./src/commandlist');

io.set('log level', 1);

server.listen(cfg.port);

io.on('connection', function (s) {
	s.on('login', function (r) {	
		var parseCmd = function(r, s) {
			var cmdResult = false;

			if (r.cmd !== '') {
				console.log(r);
				if(cmdResult = Cmds.dispatch(s, r)) {
					cmdResult(s, r);
				}
				else {
					s.emit('msg', {msg: 'Not a valid command.', styleClass: 'error'});
					return Character.prompt(s);
				}
			} else {
				return Character.prompt(s);
			}
		}

		if (r.msg !== '') { // not checking slashes
			return Character.login(r, s, function (name, s, fnd) {
				if (fnd) {
					s.join('mud'); // mud is one of two socket.io rooms, 'creation' the other
					Character.load(name, s, function (s) {
						Character.getPassword(s, function(s) {
							s.on('cmd', function (r) { 
								parseCmd(r, s);
							});
						});
					});
				} else {
					s.join('creation'); // Character creation is its own socket.io room, 'mud' the other
					s.player = {name:name};
					
					Character.newCharacter(r, s, function(s) {
						s.on('cmd', function (r) {
							parseCmd(r, s);
						});
					});
				}
			});
		} else {
			return s.emit('msg', {msg : 'Enter your name:', res: 'login', styleClass: 'enter-name'});
		}
	});

	// Quitting
	s.on('quit', function () {
		Character.save(s, function() {
			s.emit('msg', {
				msg: 'Add a little to a little and there will be a big pile.',
				emit: 'disconnect',
				styleClass: 'logout-msg'
			});

			s.leave('mud');
			s.disconnect();
		});
	});

	// DC
	s.on('disconnect', function () {
		var i = 0;
		if (s.player !== undefined) {
			for (i; i < module.exports.players.length; i += 1) {	
				if (module.exports.players[i].name === s.player.name) {
					module.exports.players.splice(i, 1);	
				}
			}
		}
	});

	s.emit('msg', {msg : 'Enter your name:', res: 'login', styleClass: 'enter-name'});
});

console.log(cfg.name + ' is ready to rock and roll on port ' + cfg.port);