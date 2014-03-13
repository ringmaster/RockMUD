/*
 Client Side JS for RockMUD
 Rocky Bevins, moreoutput@gmail.com 2013
*/

require(
	{
		shim: {
			'socketio': {
				exports: 'io'
			}
		},
		paths: {
			socketio: '../socket.io/socket.io'
		}
	},
	['dojo/dom', 'dojo/string', 'dojo/query', 'dojo/dom-attr', 'dojo/on', 'dojo/_base/event', 'dojo/window', 'dojo/ready', 'dojo/NodeList-dom', 'socketio'],
	function (dom, string, query, domAttr, on, event, win, ready) {
		ready(function () {
			'use strict';
			var ws = io.connect(''),
			terminal = dom.byId('terminal'),
			/* Command aliases */
			aliases = {
				n: 'north',
				e: 'east',
				w: 'west',
				s: 'south',
				u: 'up',
				d: 'down',
				l: 'look',
				i: 'inventory',
				sc: 'score',
				eq: 'equipment',
				q: 'quaff',
				c: 'cast',
				k: 'kill',
				re: 'rest',
				sl: 'sleep',
				h: 'help',
				wh: 'where',
				aff: 'affect',
				ooc: 'chat',
				slist: 'skills'
			},

			display = function(r) {
				var msg = r.msg;
				if (r.emit == 'password') {
					msg = msg.replace(/./g, '&middot;');
				}
				if (r.element === undefined) {
					terminal.innerHTML += '<div class="' + r.styleClass + '">' + msg + '</div>';
				} else {
					terminal.innerHTML += '<' + r.element + ' class="' + r.styleClass + '">' + msg + '</' + r.element + '>';
				}

				return parseCmd(r);
			},
			
			parseCmd = function(r) {
				if (r.msg !== undefined) {
					r.msg = string.trim(r.msg);
					ws.emit(r.emit, r);
				}
			},

			changeMudState = function(state) {
				domAttr.set(dom.byId('cmd'), 'mud-state', state);
				if(state == 'enterPassword') {
					domAttr.set(dom.byId('cmd'), 'type', 'password');
				}
				else {
					domAttr.set(dom.byId('cmd'), 'type', 'text');
				}
			},

			replaceAliases = function(cmdStr) {
				var keys = Object.keys(aliases),
				i = 0;

				for (i; i < keys.length; i++) {
					if (keys[i] === cmdStr) {
						return aliases[keys[i]];
					}
				}

				return cmdStr;
			},

			displayCmd = function(msg) {
				var node = dom.byId('cmd');

				display({
					msg : replaceAliases(msg),
					emit : (function () {
						var res = domAttr.get(node, 'mud-state');

						switch(res) {
							case 'login':
								return 'login';
							case 'quit':
							case 'disconnect':
								return 'quit';
							case 'selectRace':
								return 'raceSelection';
							case 'selectClass':
								return 'classSelection';
							case 'createPassword':
								return 'setPassword';
							case 'enterPassword':
								return 'password';
							default:
								return 'cmd';
						}
					}()),
					styleClass: 'cmd'
				});

			},

			frmH = on(dom.byId('console'), 'submit', function (e) {
				var node = dom.byId('cmd'),
				msg = string.trim(node.value);
			
				e.preventDefault();

				displayCmd(msg);

				node.value = '';
				node.focus();

				win.scrollIntoView(query('#bottom')[0]);
			});

			query('body').on('click', function(evt) {
				query('#cmd')[0].focus();
				win.scrollIntoView(query('#bottom')[0]);
			});

			on(window.document, '.clickcmd:click', function(evt){
				displayCmd(dojo.attr(this, 'href'));
				evt.preventDefault();
			});

			query('#cmd')[0].focus();

			ws.on('msg', function(r) {
				display(r);

				win.scrollIntoView(query('#bottom')[0]);
				query('#cmd')[0].focus();

				if (r.res) {
					changeMudState(r.res);
				}
			});

			ws.on('prompt', function(r) {
				// @todo Make this into a client-side template for easier editing
				var cprompt = '<div class="cprompt">';
				cprompt += '<span class="hp">HP: <span class="chp">' + r.chp + '</span>';
				cprompt += '<span class="thp">/' + r.hp + '</span></span>  ';
				cprompt += '<span class="mana">Mana: <span class="cmana">' + r.cmana + '</span>';
				cprompt += '<span class="tmana">/' + r.mana + '</span></span>  ';
				cprompt += '<span class="mv">Moves: <span class="cmv">' + r.cmv + '</span>';
				cprompt += '<span class="tmv">/' + r.mv + '</span></span>  ';
				cprompt += '<span class="room">Room: ' + r.room + '</span>  ';
				cprompt += '<span class="wait">Wait: ' + r.wait + '</span>  ';
				cprompt += '</div>';
				terminal.innerHTML += cprompt;
				win.scrollIntoView(query('#bottom')[0]);

				if (r.res) {
					changeMudState(r.res);
				}
			});
		});
	}
);
