var fs = require('fs');


var Items = function () {
	items = this;
	this.itemList = [];
	this.ready = false;

	fs.readFile('./items/items.json', function (err, data) {
		items.itemList = JSON.parse(data);
		fs.readFile('./items/monsters.json', function (err, data) {
			items.itemList.concat(JSON.parse(data));
			items.ready = true;
		});
	})
};

Items.prototype.get = function(index, fn, failout) {
	var item, items = this;

	if(typeof index == 'string') {
		index = {id: index};
	}

	if(typeof failout == 'undefined') {
		failout = false;
	}

	// Does the item exist in memory?
	item = items.itemList.splice(0).filter(function(element){
		return element.id == index.id;
	});

	if(item.length == 0) { // Item index wasn't found
		if(failout) {
			return fn(false, index);
		}
		items.loadAll(function(){
			return items.get(index, fn, true);
		})
	}
	else if(item.length > 1) {
		// Whut?
	}
	else {
		// Pop the item off the single-result array
		// @todo extend any index properties onto it
		item = item.shift();
		return fn(false, item);
	}
}

Items.prototype.loadAll = function(doneFn) {
	var items = this;

	fs.readFile('./items/items.json', function (err, data) {
		items.itemList = JSON.parse(data);
		fs.readFile('./items/monsters.json', function (err, data) {
			items.itemList.concat(JSON.parse(data));
			return doneFn(true);
		});
	});
}

Items.prototype.has = function(item, flag) {
	return (typeof item.flags[flag] !== 'undefined');
}

Items.prototype.hasValue = function(item, flag) {
	return item.flags[flag];
}

Items.getInstance = function() {
	if(typeof this.instance === 'undefined') {
		this.instance = new Items();
	}
	return this.instance;
}

module.exports = Items.getInstance();

