var createPatcher = require('../').createPatcher;
var should = require('should');
var suite = require('./suite.json');

createSuite('Test Suite');
createSuite('Custom Patcher', function(apply, value, patch) {
  return apply(value, patch);
});

function createSuite(name, patcher) {
  describe(name, function() {
    Object.keys(suite).forEach(function(type) {
      describe(type, function() {
        suite[type].forEach(function(test) {
          createTest(test, patcher);
        });
      });
    });
  });
}

function createTest(t, p) {
  it(t.name, function() {
    var patcher = createPatcher(p);
    var doc = t.doc;
    var prevDoc = JSON.parse(JSON.stringify(doc));
    var actual = patcher(doc, t.patch);
    should(actual).eql(t.expected);
    should(doc).eql(prevDoc);
  });
}
