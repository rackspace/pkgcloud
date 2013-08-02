var Attribute = function (options) {
  this.key = options.key;
  this.defaultValue = options.defaultValue;

  if (options.transform) {
    this.transform = options.transform;
  }

  return this;
};

Attribute.prototype.transform = function (value) {
  return value || this.defaultValue;
};

exports.Attribute = Attribute;

