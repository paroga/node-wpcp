function SequenceNumberManager(firstId) {
  this.items = new Map();
  this.nextId = firstId || 0;
}

SequenceNumberManager.prototype.delete = function(id) {
  if (id < this.nextId)
    this.nextId = id;
  let ret = this.items.get(id);
  this.items.delete(id);
  return ret;
};

SequenceNumberManager.prototype.get = function(id) {
  return this.items.get(id);
};

SequenceNumberManager.prototype.insert = function(value) {
  while (this.items.has(this.nextId))
    ++this.nextId;
  this.items.set(this.nextId, value);
  return this.nextId++;
};

module.exports = SequenceNumberManager;
