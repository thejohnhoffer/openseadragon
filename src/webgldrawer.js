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
        // TODO do by yourself, not working in firefox
        premultipliedAlpha: false
    } );
    $.console.assert( "[WebGlDrawer] webgl2 is not suported." );

    // return vertex position only
    this.vertexShaderSource = "              \
        #version 300 es\n                                                \
        precision highp float;                                              \
        precision highp int;                                                \
        precision highp sampler2DArray;                                    \
        in vec2 aVertexPos;          \
        in vec2 aTextureCoord;       \
                                            \
        out highp vec2 vTextureCoord;   \
                                            \
        void main(void) {                   \
            gl_Position = vec4(aVertexPos, 0.0, 1.0);       \
            vTextureCoord = aTextureCoord;  \
        }                                   \
    ";

    // Get current viewport position
    // Find all four adjacent tiles
    // For each tile
    //      Sample tile texture
    //      Sample tile mask
    //      Multiply
    // Add all tile color and alpha
    // Add all tile mask values
    // Divide color and alpha with summed mask value

    this.fragmentShaderSource = "                                    \
        #version 300 es\n                                                \
        precision highp float;                                              \
        precision highp int;                                                \
        precision highp sampler2DArray;                                    \
                                                                    \
        in highp vec2 vTextureCoord;                  \
        out vec4 color;                                         \
        uniform ivec2 uSize;                                          \
        uniform int uTile;                                           \
        uniform sampler2DArray uSampler;                            \
                                                                    \
        void main(void) {                                             \
            color = texture(uSampler, vec3(vTextureCoord, uTile));      \
        }                                                           \
    ";
    // texture(uSampler, vec3(vTextureCoord, uTile));

    this.program = this._loadProgram();

    this.vertexPos = this.gl.getAttribLocation(this.program, "aVertexPos");
    this.textureCoord = this.gl.getAttribLocation(this.program, "aTextureCoord");

    this.sampler = this.gl.getUniformLocation(this.program, "uSampler");
    this.uSize = this.gl.getUniformLocation(this.program, "uSize");
    this.uTile = this.gl.getUniformLocation(this.program, "uTile");

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


        this._loadTexture(tiles);

        for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];
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

            this.gl.uniform2i(this.uSize, this.canvas.width, this.canvas.height);
            this.gl.uniform1i(this.uTile, i);
            this.gl.uniform1i(this.sampler, 0);

            var vertexCount = 4;
            offset = 0;
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, offset, vertexCount);
        }


        // Create texture array with all tile textures
        // Create texture array with tile masks
        // Create data structure with tile positions
        // Bind data structure to a buffer in fragment shader (how?)
        // Vertex buffer contains four corners of viewport
        // Create sampler for tile textures
        // Create sampler for tile masks



    },

    destroy: function() {

    },

    _loadShader: function(source, type) {
        var shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if ( !this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS) ) {
            var log = this.gl.getShaderInfoLog(shader);
            $.console.error( "[WebGlDrawer] failed to compile shader.", log );
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

    _loadTexture: function( tiles ) {

        var texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, texture);

        for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];
            var context = tile.getContext();
            var bounds = tile.limitSourceBounds(context.canvas);
            var level = 0;
            var width = bounds.width;
            var height = bounds.height;
            var depth = 1;
            var xoffset = 0;
            var yoffset = 0;
            var zoffset = i;
            var format = this.gl.RGBA;
            var type = this.gl.UNSIGNED_BYTE;
            if (i === 0) {
                var levels = 1;
                var format2 = this.gl.RGBA8;
                this.gl.texStorage3D(this.gl.TEXTURE_2D_ARRAY, levels, format2, width, height, tiles.length);
            }

            this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, level, xoffset, yoffset, zoffset, width, height, depth, format, type, context.canvas);
        }

        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        return texture;
    }
};

 }( OpenSeadragon ));
