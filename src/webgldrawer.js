/*
 * OpenSeadragon - Drawer
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2013 OpenSeadragon contributors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are prmitted provided that the following conditions are
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
 * @classdesc Handles WebGL2 rendering of tiles for an {@link OpenSeadragon.Viewer}.
 * @param {Object} options - Options for this WebGlDrawer.
 */
$.WebGlDrawer = function( options ) {

    $.console.assert( options.canvas, "[WebGlDrawer] options.canvas is required." );
    $.console.assert( options.context, "[WebGlDrawer] options.context is required." );

    this.canvas = options.canvas;
    this.gl = options.context;

    this.clear();

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
        uniform float globalAlpha;          \
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
                float px = (gl_FragCoord.x - tx) / tw;   \
                float py = (th - (gl_FragCoord.y - ty)) / th;   \
                vec4 c = texture(textureSampler, vec3(px, py, float(tile)));   \
                c.w = c.w * globalAlpha;      \
                c.x = c.x * c.w;             \
                c.y = c.y * c.w;             \
                c.z = c.z * c.w;             \
                color = c;     \
            } else {  \
                color = vec4(0.0, 0.0, 0.0, 0.0);    \
            }   \
        }                                                                             \
    ";
    // FragCoord: lower left origo, pixel centers are at half a pixel. Window coordinates.
    // Note that textures from a HTMLCavnasElement are loaded starting from the top left

    // color = vec4( float(coord.x) / float(canvasSize.x), float(coord.y) / float(canvasSize.y), 0.0, 1.0 );   \
    // color = vec4(float(tile) / float(4), 0.0, 0.0, 1.0);                           \

    this.program = this._loadProgram();

    var vertexPos = this.gl.getAttribLocation(this.program, "aVertexPos");

    var globalAlpha = this.gl.getUniformLocation(this.program, "globalAlpha");
    var tilesLength = this.gl.getUniformLocation(this.program, "tilesLength");
    var textureSampler = this.gl.getUniformLocation(this.program, "textureSampler");
    var tileNbrSampler = this.gl.getUniformLocation(this.program, "tileNbrSampler");
    var tilePosSampler = this.gl.getUniformLocation(this.program, "tilePosSampler");

    var vertexBuffer = this.gl.createBuffer();

    this.shader = {
        vertexPos: vertexPos,
        globalAlpha: globalAlpha,
        tilesLength: tilesLength,
        textureSampler: textureSampler,
        tileNbrSampler: tileNbrSampler,
        tilePosSampler: tilePosSampler,
        vertexBuffer: vertexBuffer
    };

};

/** @lends OpenSeadragon.WebGlDrawer.prototype */
$.WebGlDrawer.prototype = {

    clear: function( bounds ) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        if (bounds) {
            this._fillRect(bounds);
        } else {
            this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }

        this.clip = undefined;
        this.fillRect = undefined;
        this.transformMatrix = undefined;
        this.opacity = 1.0;
    },

    _fillRect: function( rect, color ) {
        this.gl.enable(this.gl.SCISSOR_TEST);

        rect = this._viewerElementToWebGlCoordinates(rect);
        this.gl.scissor(
            rect.x < 0 ? 0 : rect.x,
            rect.y < 0 ? 0 : rect.y,
            rect.x + rect.width > this.canvas.width ? this.canvas.width - rect.x : rect.width,
            rect.y + rect.height > this.canvas.height ? this.canvas.height - rect.y : rect.height);

        if (color && color.length >= 3) {
            this.gl.clearColor(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0, 1.0);
        } else {
            this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.disable(this.gl.SCISSOR_TEST);
    },

    setClip: function( rect ) {
        this.clip = this._viewerElementToWebGlCoordinates(rect);
    },

    drawRectangle: function( rect, fillStyle) {
        //TODO
        this.fillRect = {
            rect: this._viewerElementToWebGlCoordinates(rect),
            color: this._parseColor(fillStyle)
        };
    },

    _parseColor: function( input ) {
        // TODO: not working
        var m = input.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (m) {
            return [m[1], m[2], m[3]];
        } else {
            throw new Error("Colour " + input + " could not be parsed.");
        }
    },

    setImageSmoothingEnabled: function( enabled ) {
        this.imageSmoothing = enabled;
    },


    /**
     * Input coordnates use top left as origo, output uses bottom left.
     * Canvas width and height are used for transform.
     * Creates a new rectangle.
     *
     * @param {Openseadragon.Rect} rectangle
     * @returns a new rectangle
     */
    _viewerElementToWebGlCoordinates: function( rectangle ) {
        // Origo is top left in tile coord
        // Origo is bottom left in WebGL
        var y = rectangle.y + rectangle.height - 1;
        y = this.canvas.height - 1 - y;

        var rectWebGl = rectangle.clone();
        rectWebGl.y = y;
        return rectWebGl;
    },

    /**
     * Draws the given tiles.
     * @param {OpenSeadragon.Tile[]} tiles - The tiles to draw.
     * @param {OpenSeadragon.tiledImage} tiledImage - The image that holds the tiles
     * @param {Float} [scale=1] - Apply a scale to tile position and size. Defaults to 1.
     * @param {OpenSeadragon.Point} [translate] A translation vector to offset tile position
     */
    draw: function( tiles, tiledImage, scale, translate ) {
        // TODO drawing-handler?
        // TODO, use clip and fill rect
        // console.log('canvas size', this.canvas.width, this.canvas.height);
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
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shader.vertexBuffer);
        // TODO ES6?
        // eslint-disable-next-line no-undef
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.DYNAMIC_DRAW);

        var numComponents = 2;
        var type = this.gl.FLOAT;
        var normalize = false;
        var stride = 0;
        var offset = 0;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shader.vertexBuffer);
        this.gl.vertexAttribPointer(
            this.shader.vertexPos,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        this.gl.enableVertexAttribArray(this.shader.vertexPos);

        this.gl.uniform1f(this.shader.globalAlpha, tiledImage.getOpacity());
        this.gl.uniform1i(this.shader.tilesLength, tiles.length);
        this.gl.uniform1i(this.shader.textureSampler, 0);
        this.gl.uniform1i(this.shader.tileNbrSampler, 1);
        this.gl.uniform1i(this.shader.tilePosSampler, 2);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, texture);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, textureTileNbr);

        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, textureTilePos);

        var vertexCount = 4;
        offset = 0;
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, offset, vertexCount);

        if (this.fillRect) {
            this._fillRect(this.fillRect.rect, this.fillRect.color);
        }

        // Create texture array with all tile textures
        // Create texture array with tile masks
        // Create data structure with tile positions
        // Bind data structure to a buffer in fragment shader (how?)
        // Vertex buffer contains four corners of viewport
        // Create sampler for tile textures
        // Create sampler for tile masks

        // TODO clean up: delete arrays/textures/program etc
        this.gl.deleteTexture(textureTilePos);
        this.gl.deleteTexture(textureTileNbr);
        this.gl.deleteTexture(texture);

    },

    destroy: function() {
        // TODO. Fill in. Is this called?
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

        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        if (this.imageSmoothing) {
            this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        } else {
            this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        }
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAX_LEVEL, 0);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_BASE_LEVEL, 0);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAX_LOD, 0);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_LOD, 0);

        var size = [];
        var maxWidth = 0;
        var maxHeight = 0;
        for (var i = 0; i < tiles.length; i++) {
            var bounds = tiles[i].limitSourceBounds(tiles[i].getContext().canvas);
            size.push(bounds);
            maxWidth = bounds.width > maxWidth ? bounds.width : maxWidth;
            maxHeight = bounds.height > maxHeight ? bounds.height : maxHeight;
        }

        var level = 0;
        var depth = 1;
        var xoffset = 0;
        var yoffset = 0;
        var format = this.gl.RGBA;
        var type = this.gl.UNSIGNED_BYTE;
        var levels = 1;
        var internalFormat = this.gl.RGBA8;
        this.gl.texStorage3D(this.gl.TEXTURE_2D_ARRAY, levels, internalFormat, maxWidth, maxHeight, tiles.length);

        for (var j = 0; j < tiles.length; j++) {
            var zoffset = j;
            var context = tiles[j].getContext();
            var width = size[j].width;
            var height = size[j].height;
            this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, level, xoffset, yoffset, zoffset, width, height, depth, format, type, context.canvas);
        }
        return texture;
    },

    _loadTileNumberTexture: function( tiles, scale, translate ) {
        var texture = this.gl.createTexture();
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAX_LEVEL, 0);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_BASE_LEVEL, 0);

        var width = this.canvas.width;
        var height = this.canvas.height;

        var alignmentBytes = this.gl.getParameter(this.gl.UNPACK_ALIGNMENT);
        var alignmentElements = Math.max(alignmentBytes / 2, 1);
        var dataArrayStride = Math.ceil(width / alignmentElements) * alignmentElements;
        // eslint-disable-next-line no-undef
        var data = new Uint16Array(dataArrayStride * height);
        data.fill(tiles.length);
        for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];
            var bounds = tile.getDestinationRect(scale, translate);
            bounds = this._viewerElementToWebGlCoordinates(bounds);

            // TODO: tile overlap?
            // TODO rounding problems here. Needs fixing.
            var startX = Math.round(bounds.x);
            var endX = Math.round(bounds.x + bounds.width);
            var startY = Math.round(bounds.y);
            var endY = Math.round(bounds.y + bounds.height);

            startX = startX < 0 ? 0 : startX;
            startY = startY < 0 ? 0 : startY;
            endX = endX > width ? width : endX;
            endY = endY > height ? height : endY;

            // console.log('tile nr', i, 'raw', bounds, 'sx, ex, sy, ey', startX, endX, startY, endY);

            for (var x = startX; x < endX; x++) {
                for (var y = startY; y < endY; y++) {
                    data[(y * dataArrayStride) + x] = i;
                }
            }
        }
        var level = 0;
        var internalFormat = this.gl.R16UI;
        var format =  this.gl.RED_INTEGER;
        var offset = 0;
        var type = this.gl.UNSIGNED_SHORT;
        var levels = 1;
        var xoffset = 0;
        var yoffset = 0;

        this.gl.texStorage2D(this.gl.TEXTURE_2D, levels, internalFormat, width, height);
        this.gl.texSubImage2D(this.gl.TEXTURE_2D, level, xoffset, yoffset, width, height, format, type, data, offset);

        return texture;
    },

    _loadTilePositionTexture: function( tiles, scale, translate ) {
        var texture = this.gl.createTexture();
        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, texture);

        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAX_LEVEL, 0);
        this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_BASE_LEVEL, 0);

        // Origo is top left in tile coord
        // Origo is bottom left in texture
        for (var i = 0; i < tiles.length; i++) {
            // eslint-disable-next-line no-undef
            var data = new Float32Array(4);
            var tile = tiles[i];
            var bounds = tile.getDestinationRect(scale, translate);
            bounds = this._viewerElementToWebGlCoordinates(bounds);
            data[0] = bounds.x;
            data[1] = bounds.y;
            data[2] = bounds.width;
            data[3] = bounds.height;

            // console.log('tile pos, sx, sy, w, h', i, data);

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

        return texture;
    }

};

 }( OpenSeadragon ));
