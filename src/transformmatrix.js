/*
 * OpenSeadragon - TransformMatrix
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2013 OpenSeadragon contributors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * - Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * - Neither the name of CodePlex Foundation nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

(function( $ ){

/**
 * @class TransformMatrix
 * @classdesc A TransformMatrix is a 2 by 3 affine 2D transform matrix with
 * methods for applying rotation, scaling and translating. Element
 * notation is a_(row, col) and starts at one, i.e. a12 is the first row and
 * second column. The matrix defaults as the identity matrix.
 *
 * @memberof OpenSeadragon
 * @param {Number} [a11] Row 1, column 1.
 * @param {Number} [a12] Row 1, column 2.
 * @param {Number} [a13] Row 1, column 3.
 * @param {Number} [a21] Row 2, column 1.
 * @param {Number} [a22] Row 2, column 2.
 * @param {Number} [a23] Row 2, column 3.
 */
$.TransformMatrix = function( a11, a12, a13, a21, a22, a23 ) {
    /**
     * The vector component 'a11'.
     * @member {Number} a11
     * @memberof OpenSeadragon.TransformMatrix#
     */
    this.a11 = typeof ( a11 ) == "number" ? a11 : 1;
/**
     * The vector component 'a12'.
     * @member {Number} a12
     * @memberof OpenSeadragon.TransformMatrix#
     */
    this.a12 = typeof ( a12 ) == "number" ? a12 : 0;
/**
     * The vector component 'a13'.
     * @member {Number} a13
     * @memberof OpenSeadragon.TransformMatrix#
     */
    this.a13 = typeof ( a13 ) == "number" ? a13 : 0;

    /**
     * The vector component 'a21'.
     * @member {Number} a21
     * @memberof OpenSeadragon.TransformMatrix#
     */
    this.a21 = typeof ( a21 ) == "number" ? a21 : 0;
/**
     * The vector component 'a22'.
     * @member {Number} a22
     * @memberof OpenSeadragon.TransformMatrix#
     */
    this.a22 = typeof ( a22 ) == "number" ? a22 : 1
/**
     * The vector component 'a23'.
     * @member {Number} a23
     * @memberof OpenSeadragon.TransformMatrix#
     */
    this.a23 = typeof ( a23 ) == "number" ? a23 : 0;

};

/** @lends OpenSeadragon.TransformMatrix.prototype */
$.TransformMatrix.prototype = {
    /**
     * @function
     * @returns {OpenSeadragon.TransformMatrix} a duplicate of this TransformMatrix
     */
    clone: function() {
        return new $.TransformMatrix(this.a11, this.a12, this.a13, this.a21, this.a22, this.a23);
    },

    /**
     *
     * @param {OpenSeadragon.Point} pt
     * @returns A new, transformed point.
     */
    transformPoint: function(pt) {
        const x = this.a11 * pt.x +
    }
};

}( OpenSeadragon ));
