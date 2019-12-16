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
        in vec2 aVertexPos;                    \
                                                    \
        void main(void) {                        \
            gl_Position = vec4(aVertexPos, 0.0, 1.0);       \
        }                                                \
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
        precision highp usampler2D;                                    \
                                                                    \
        out vec4 color;                                         \
        uniform int tilesLength;   \
        uniform sampler2DArray textureSampler;                            \
        uniform usampler2D tileNbrSampler;                                  \
        uniform sampler2DArray tilePosSampler;                                  \
                                                                           \
        void main(void) {                                                  \
            ivec2 coord = ivec2(int(gl_FragCoord.x ), int(gl_FragCoord.y ));            \
            uint tile =  uvec4(texelFetch(tileNbrSampler, coord, 0)).x;                 \
            if (tile != uint(tilesLength)) {    \
                vec4 pos = texelFetch(tilePosSampler, ivec3(0, 0, tile), 0);         \
                float tx = pos.x;    \
                float ty = pos.y;    \
                float tw = pos.z;    \
                float th = pos.w;    \
                float px = (float(coord.x) - tx) / tw;   \
                float py = 1.0 - (float(coord.y) - ty) / th;   \
                vec4 c = texture(textureSampler, vec3(px, py, float(tile)));   \
                color = c;     \
            } else {  \
                color = vec4(0.0, 0.0, 0.0, 0.0);    \
            }   \
        }                                                                             \
    ";
    // Note that textures from a HTMLCavnasElement are loaded starting from the top left

    // color = vec4( float(coord.x) / float(canvasSize.x), float(coord.y) / float(canvasSize.y), 0.0, 1.0 );   \
    // color = vec4(float(tile) / float(4), 0.0, 0.0, 1.0);                           \

    this.program = this._loadProgram();

    this.vertexPos = this.gl.getAttribLocation(this.program, "aVertexPos");
    this.textureCoord = this.gl.getAttribLocation(this.program, "aTextureCoord");

    this.tilesLength = this.gl.getUniformLocation(this.program, "tilesLength");
    this.textureSampler = this.gl.getUniformLocation(this.program, "textureSampler");
    this.tileNbrSampler = this.gl.getUniformLocation(this.program, "tileNbrSampler");
    this.tilePosSampler = this.gl.getUniformLocation(this.program, "tilePosSampler");

    this.vertexBuffer = this.gl.createBuffer();

};

/** @lends OpenSeadragon.WebGlDrawer.prototype */
$.WebGlDrawer.prototype = {

    clear: function() {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    },

    draw: function( tiles, tiledImage, scale, translate ) {

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        this.gl.useProgram(this.program);

        var texture = this._loadTexture(tiles);
        var textureTileNbr = this._loadTileNumberTexture(tiles, scale, translate);
        var textureTilePos = this._loadTilePositionTexture(tiles, scale, translate);

        var data = [
            -1, -1,      // lower left
            1, -1,  // lower right
            -1, 1,          // upper left
            1, 1       // upper right
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

        this.gl.uniform1i(this.tilesLength, tiles.length);
        this.gl.uniform1i(this.textureSampler, 0);
        this.gl.uniform1i(this.tileNbrSampler, 1);
        this.gl.uniform1i(this.tilePosSampler, 2);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, texture);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, textureTileNbr);

        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, textureTilePos);

        var vertexCount = 4;
        offset = 0;
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, offset, vertexCount);


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
        this.gl.activeTexture(this.gl.TEXTURE0);
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
                var internalFormat = this.gl.RGBA8;
                this.gl.texStorage3D(this.gl.TEXTURE_2D_ARRAY, levels, internalFormat, width, height, tiles.length);
            }

            this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, level, xoffset, yoffset, zoffset, width, height, depth, format, type, context.canvas);
        }

        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        return texture;
    },

    _loadTileNumberTexture: function( tiles, scale, translate ) {
        var texture = this.gl.createTexture();
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        var width = this.canvas.width;
        var height = this.canvas.height;
        // eslint-disable-next-line no-undef
        var data = new Uint16Array(width * height);
        data.fill(tiles.length);
        for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];
            var bounds = tile.getDestinationRect(scale, translate);
            // Origo is top left in tile coord
            // Origo is bottom left in texture
            var startX = bounds.x < 0 ? 0 : bounds.x;
            var endX = bounds.x + bounds.width;
            endX = endX > width ? width : endX;

            var startY = bounds.y + bounds.height - 1;
            startY = height - 1 - startY;
            var endY = startY + bounds.height;
            startY = startY < 0 ? 0 : startY;
            endY = endY > height ? height : endY;

            // TODO rounding problems here. Needs fixing.
            startX = Math.round(startX);
            startY = Math.round(startY);
            endX = Math.round(endX);
            endY = Math.round(endY);

            for (var x = startX; x < endX; x++) {
                for (var y = startY; y < endY; y++) {
                    data[(y * width) + x] = i;
                }
            }
        }
        var level = 0;
        var border = 0;
        var internalFormat = this.gl.R16UI;
        var format =  this.gl.RED_INTEGER;
        var offset = 0;
        var type = this.gl.UNSIGNED_SHORT;
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, width, height, border, format, type, data, offset);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        return texture;
    },

    _loadTilePositionTexture: function( tiles, scale, translate ) {
        var texture = this.gl.createTexture();
        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, texture);
        var cavnasHeight = this.canvas.height;
        // Origo is top left in tile coord
        // Origo is bottom left in texture
        for (var i = 0; i < tiles.length; i++) {
            // eslint-disable-next-line no-undef
            var data = new Float32Array(4);
            var tile = tiles[i];
            var bounds = tile.getDestinationRect(scale, translate);
            var startY = bounds.y + bounds.height - 1;
            startY = cavnasHeight - 1 - startY;
            var startX = bounds.x;
            data[0] = startX;
            data[1] = startY;
            data[2] = bounds.width;
            data[3] = bounds.height;

            var level = 0;
            var width = 1;
            var height = 1;
            var depth = 1;
            var xoffset = 0;
            var yoffset = 0;
            var zoffset = i;
            var format = this.gl.RGBA;
            var type = this.gl.FLOAT;
            if (i === 0) {
                var levels = 1;
                var internalFormat = this.gl.RGBA32F;
                this.gl.texStorage3D(this.gl.TEXTURE_2D_ARRAY, levels, internalFormat, width, height, tiles.length);
            }

            this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, level, xoffset, yoffset, zoffset, width, height, depth, format, type, data);

        }

        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        return texture;
    }

};

 }( OpenSeadragon ));
