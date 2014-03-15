"use strict";

var Dice = require('./dice').roller,
	Character = require('./character').character,
	Room = require('./rooms').room;

var Combat = function() {
	this.adjectives = ['barbaric', 'BARBARIC', 'great', 'GREAT', 'mighty', 'MIGHTY', 'AWESOME'];
	this.abstractNouns = ['hatred', 'intensity', 'weakness'];
};

/**
 * Start combat
 * General idea behind a hit:
 * Your Short Sword (proper noun) slices (verb attached to item) a Red Dragon (proper noun) with barbaric (adjective) intensity (abstract noun) (14)
 * You swing and miss a Red Dragon with barbaric intensity (14)
 * @param s
 * @param monster
 * @param fn
 */
Combat.prototype.begin = function(s, monster, fn) {
	var combat = this,
		combatInterval,
		roundCounter = 0;

	s.player.position = 'fighting';
	monster.position = 'fighting';

	// Combat Loop
	combatInterval = setInterval(function() {
		var initiativePlayer, initiativeMonster, playerGoes, monsterGoes, queue = [];

		// Are we both still fighting?
		if (s.player.position === 'fighting' && monster.position === 'fighting') {

			// Increment round counter, figure out round speed
			roundCounter++;
			initiativePlayer = 10 + Math.floor((s.player.dex - 10) / 3);
			initiativeMonster = 10 + Math.floor((monster.dex - 10) / 3);

			if(initiativeMonster > initiativePlayer) {
				initiativeMonster = Math.floor(initiativeMonster / initiativePlayer);
				initiativePlayer = 1;
			}
			else {
				initiativePlayer = Math.floor(initiativePlayer / initiativeMonster);
				initiativeMonster = 1;
			}

			// Who goes this round?
			playerGoes = (roundCounter % initiativePlayer == 0);
			monsterGoes = (roundCounter % initiativeMonster == 0);

			if(s.player.dex > monster.dex) {
				if(playerGoes) queue.push(function(){combat.attackerRound(s, monster)});
				if(monsterGoes) queue.push(function(){combat.targetRound(s, monster)});
			}
			else {
				if(monsterGoes) queue.push(function(){combat.targetRound(s, monster)});
				if(playerGoes) queue.push(function(){combat.attackerRound(s, monster)});
			}

			queue.push(function(){
				if (monster.chp <= 0) {
					clearInterval(combatInterval);

					monster.position = 'dead';
					Room.removeMonster({
						area: s.player.area,
						id: s.player.roomid
					}, monster, function(removed) {
						if (removed) {
							Room.addCorpse(s, monster, function(corpse) {
								combat.calcXP(s, monster, function(earnedXP) {
									s.player.position = 'standing';

									if (earnedXP > 0) {
										s.emit('msg', {msg: 'You defeated your foe! You learn some things, resulting in ' + earnedXP + ' experience points.', styleClass: 'combat combat-victory'});
									} else {
										s.emit('msg', {msg: 'You defeated your foe, but learned nothing from such a paltry adversary.', styleClass: 'combat combat-victory'});
									}
								});
							});
						}
					});
				}
			});

			queue.push(function(){
				if (s.player.chp <= 0) {
					clearInterval(combatInterval);
					s.emit('msg', {msg: 'You died!', styleClass: 'combat combat-death'});
					//Character.death(s);
				}
			});

			queue.push(function(){
				Character.prompt(s);
			});

			for(var q in queue) {
				queue[q]();
			}

		}
	}, 1800);

	combat.attackerRound(s, monster, fn);
}

/**
 * Get the weapons that the player is wielding
 * @param s
 */
Combat.prototype.getWeapons = function(s) {
	return s.player.eq.slice(0).filter(function(slot){
		return (slot.slot == 'hands' && slot.item != null && slot.item.itemType == 'weapon');
	});
}

/*
* If begin() was successful then we can move to running this function until:
* 1) attacker or target hits 0 chps.
* 2) a skill or command ends the battle -- flee for example
* 3) the target or attacker changes postions to sleeping, or 'prone'
* Each player gets one round of attacks against their target
*/
Combat.prototype.round = function(s, monster, fn) {
	var combat = this;
	combat.attackerRound(s, monster, function(s, monster) {
		if (monster.chp > 0) {
			combat.targetRound(s, monster, function(s, monster) {
				return fn();
			});
		} else {
			return fn();
		}
	});
}

/*
* The round for the entity issuing the kill command, the Attacker 
* Attacker is always at the top of the round
*/
Combat.prototype.attackerRound = function(s, monster) {
	var combat = this,
		weapons = combat.getWeapons(s),
		activeWeapon,
		damage = 0,
		hitRoll;

	// Figure out what weapon we're using
	// Uh, we're just starting out, so just use the first one in the list for now.
	if(weapons.length > 0) {
		activeWeapon = weapons.shift().item;
	}
	else {
		// This is the default unarmed weapon
		activeWeapon = {
			attackType: 'punch',
			diceNum: 1,
			diceSides: 4
		};
	}

	// Roll against AC
	hitRoll = Dice.roll(1, 20) + Math.floor(s.player.dex / 3);

	if (hitRoll > monster.ac) {
		damage = combat.meleeDamage(s.player, monster, activeWeapon);
		monster.chp = (monster.chp - damage);
		s.emit('msg', {
			msg: 'You ' + activeWeapon.attackType + ' ' + monster.short + '. (' + damage + ')',
			styleClass: 'combat player-hit'
		});
	}
	else {
		s.emit('msg', {msg: 'You ' + activeWeapon.attackType + ' at ' + monster.short + ' but miss!', styleClass: 'combat player-miss'});
	}
}

/*
* The round for the entity being attacked, the Target
* Target is always at the bottom of the round
*/
Combat.prototype.targetRound = function(s, monster, fn) {
	var combat = this, damage = 0;
	Dice.roll(1, 20, function(total) { // Roll against AC
		total = total + 5;
		if (total > s.player.ac) {
			damage = combat.meleeDamage(monster, s.player, {diceNum: monster.diceNum, diceSides: monster.diceSides});
			s.player.chp = (s.player.chp - total);
			s.emit('msg', {
				msg: monster.short + ' ' + monster.attackType + 's you hard! (' + total + ')',
				styleClass: 'combat foe-hit'
			});
		}
		else {
			s.emit('msg', {
				msg: monster.short + ' misses '+ ' you!',
				styleClass: 'combat foe-miss'
			});
		}
	});
}

Combat.prototype.calcXP = function(s, monster, fn) {
	if ((monster.level) >= (s.player.level - 5)) {
		if (monster.level >= s.player.level) {
			Dice.roll(1, 4, function(total) {
				var exp,
				total = total + 1;

				// @todo Fix this math?
				exp = ((monster.level - s.player.level) * total) + 1 * (total * 45);

				s.player.exp = exp + s.player.exp;

				return fn( exp );
			});
		} else {
			Dice.roll(1, 4, function(total) {
				return fn(total * 10);
			});
		}
	} else {
		return fn(0);
	}
}

/**
 * Calculate the total damage done with a melee hit
 * @param attacker
 * @param opponent
 * @param weapon
 * @param fn
 * @todo Damage calculation should factor in weapon type and character ability.
 */
Combat.prototype.meleeDamage = function(attacker, opponent, weapon) {
	var total = Dice.roll(1, 20);
	total = (total + 1 + attacker.str/2);
	total = total - (opponent.ac/3);  // This creates the potential to *add* HP to the monster attacked!

	if (typeof weapon !== 'function') {
		total += Dice.roll(weapon.diceNum, weapon.diceSides);
	}
	return Math.round(total);
}

module.exports.combat = new Combat();