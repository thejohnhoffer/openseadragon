/*
 * OpenSeadragon - Drawer
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

 (function( $ ) {

/**
 * @class WebGlDrawer
 * @memberof OpenSeadragon
 * @classdesc Handles WebGL rendering of tiles for an {@link OpenSeadragon.Viewer}.
 * @param {Object} options - Options for this WebGlDrawer.
 */
$.WebGlDrawer = function( options ) {
    // TODO tile.drawingHandler?
    // TODO global alpha
    // TODO image smooting
    this.imageSmoothing = true;

    this.canvas = document.createElement( "canvas" );

    this.gl = this.canvas.getContext( "webgl2", {
        premultipliedAlpha: false
    } );
    $.console.assert( "[WebGlDrawer] webgl2 is not suported." );

    this.vertexShaderSource = "              \
        attribute vec2 aVertexPos;          \
        attribute vec2 aTextureCoord;       \
                                            \
        varying highp vec2 vTextureCoord;   \
                                            \
        void main(void) {                   \
            gl_Position = vec4(aVertexPos, 0.0, 1.0);       \
            vTextureCoord = aTextureCoord;  \
        }                                   \
    ";

    this.fragmentShaderSource = "                                    \
        varying highp vec2 vTextureCoord;                           \
                                                                    \
        uniform sampler2D uSampler;                                 \
                                                                    \
        void main(void) {                                           \
            gl_FragColor = texture2D(uSampler, vTextureCoord);      \
        }                                                           \
    ";

    this.program = this._loadProgram();

    this.vertexPos = this.gl.getAttribLocation(this.program, "aVertexPos");

    this.textureCoord = this.gl.getAttribLocation(this.program, "aTextureCoord");

    this.sampler = this.gl.getUniformLocation(this.program, "uSampler");

    this.vertexBuffer = this.gl.createBuffer();

    this.textureCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    // TODO ES6?
    // eslint-disable-next-line no-undef
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
        0.0, 1.0,   // lower left
        1.0, 1.0,   // lower right
        0.0, 0.0,   // upper left
        1.0, 0.0    // upper right
    ]), this.gl.STATIC_DRAW);
    // Data from CanvasRenderingContext2D uses origo as upper left corner

};

/** @lends OpenSeadragon.WebGlDrawer.prototype */
$.WebGlDrawer.prototype = {

    clear: function() {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    },

    draw: function( tiles, scale, translate ) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        for (var i = tiles.length - 1; i >= 0; i--) {
            var tile = tiles[i];
            this.drawTile(tile);
        }

    },

    drawTile: function( tile, scale, translate ) {

        var dest = tile.getDestinationRect(scale, translate);

        var cw = this.canvas.width;
        var ch = this.canvas.height;
        // dest origo: upper left, 0.0 ... 1.0
        // data origo: lower left, -1.0 ... 1.0
        // x, y is upper left corner of tile
        var x = dest.x / cw * 2 - 1;
        var y = -(dest.y / ch * 2 - 1);
        var w = dest.width / cw * 2;
        var h = dest.height / ch * 2;
        var data = [
            x, y - h,      // lower left
            x + w, y - h,  // lower right
            x, y,          // upper left
            x + w, y       // upper right
        ];

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        // TODO ES6?
        // eslint-disable-next-line no-undef
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.DYNAMIC_DRAW);

        var texture = this._loadTexture(tile);

        var numComponents = 2;
        var type = this.gl.FLOAT;
        var normalize = false;
        var stride = 0;
        var offset = 0;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.vertexAttribPointer(
            this.vertexPos,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        this.gl.enableVertexAttribArray(this.vertexPos);

        numComponents = 2;
        type = this.gl.FLOAT;
        normalize = false;
        stride = 0;
        offset = 0;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
        this.gl.vertexAttribPointer(
            this.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        this.gl.enableVertexAttribArray(this.textureCoord);

        this.gl.useProgram(this.program);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(this.sampler, 0);

        var vertexCount = 4;
        offset = 0;
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, offset, vertexCount);

    },

    destroy: function() {

    },

    _loadShader: function(source, type) {
        var shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if ( !this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS) ) {
            $.console.error( "[WebGlDrawer] failed to compile shader." );
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    },

    _loadProgram: function() {
        var program = this.gl.createProgram();

        var vertexShader = this._loadShader(this.vertexShaderSource, this.gl.VERTEX_SHADER);
        var fragmentShader = this._loadShader(this.fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if ( !this.gl.getProgramParameter(program, this.gl.LINK_STATUS) ) {
            $.console.error( "[WebGlDrawer] failed to link shader program." );
            return null;
        }
        return program;
    },

    _createBuffer: function(data) {
        var buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        // TODO ES6?
        // eslint-disable-next-line no-undef
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
        return buffer;
    },

    _loadTexture: function( tile ) {
        var texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        var context = tile.getContext();
        var bounds = tile.limitSourceBounds(context.canvas);
        var level = 0;
        var width = bounds.width;
        var height = bounds.height;
        var border = 0;
        var format = this.gl.RGBA;
        var type = this.gl.UNSIGNED_BYTE;
        this.gl.texImage2D(this.gl.TEXTURE_2D,
            level,
            format,
            width,
            height,
            border,
            format,
            type,
            context.canvas);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        return texture;
    }
};

 }( OpenSeadragon ));
