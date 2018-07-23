

(function( $ ) {
    $.Shader = function(gl, n) {
        this.range = [...Array(this.n).keys()];
        this.gl = gl;
        this.n = n;
    };

    $.Shader.prototype = {
        tileN: function(n) {
            return 'u_tile' + n;
        },

        get samplers () {
            var doOne = function(n) {
                return 'uniform sampler2D ' + this.tileN(n);
            };
            return this.range.map(doOne, this).join(';\n') + ';';
        },

        get call_composite () {
            var doOne = function(n) {
                var params = this.tileN(n) + ', uv';
                return 'color = composite(color, texture(' + params + '))';
            };
            return this.range.map(doOne, this).join(';\n') + ';';
        },
        
        get header () {
        return `#version 300 es
precision highp int;
precision highp float;
precision highp sampler2D;
out vec4 fragcolor;
in vec2 uv;
` + this.samplers;
        },

        get composite () {
             return `
vec3 composite(vec3 target, vec4 source) {
    target += source.rgb * source.a;
    return target;
}
`; 
        },

        get main () {
        
            return `
void main() {

    vec3 color = vec3(0, 0, 0);
` + this.call_composite + `
    fragcolor = vec4(color, 1.0);
}
`;
        },

        get vertex () {
            return `#version 300 es
in vec2 a_uv;
out vec2 uv;

void main() {
    uv = a_uv;
    vec2 full_pos = 2. * a_uv - 1.;
    gl_Position = vec4(full_pos, 0., 1.);
}
`;
        },

        get fragment () {

            // Begin defining shader
            var fShader = this.header + this.composite + this.main;

            console.log('Fragment Shader' + fShader);
            return fShader;
        },

        get program () {
            var gl = this.gl;
            var p = gl.createProgram();

            this.compile(p, gl.VERTEX_SHADER, this.vertex);
            this.compile(p, gl.FRAGMENT_SHADER, this.fragment);

            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)){
                console.log(gl.getProgramInfoLog(p));
            }
            return p;
        },

        compile: function(p, type, file) {
            var gl = this.gl;
            var shader =    gl.createShader(type);

            gl.shaderSource(shader, file);
            gl.compileShader(shader);
            gl.attachShader(p, shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
                console.log(gl.getShaderInfoLog(shader));
            }
        }
    };
})( OpenSeadragon );
