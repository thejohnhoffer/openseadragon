/* global QUnit, Util */

(function() {

    QUnit.module('Transformationmatrix', {});

    var precision = 0.000000001;

    QUnit.test('Constructor', function(assert) {
        var m = new OpenSeadragon.TransformationMatrix();
        assert.strictEqual(m.a11, 0, 'm.a11 shound be 1');
        assert.strictEqual(m.a12, 0, 'm.a12 shound be 0');
        assert.strictEqual(m.a13, 0, 'm.a13 shound be 0');
        assert.strictEqual(m.a21, 0, 'm.a21 shound be 1');
        assert.strictEqual(m.a22, 0, 'm.a22 shound be 0');
        assert.strictEqual(m.a23, 0, 'm.a23 shound be 0');
    });

})();