"use strict";

var alert, document, setInterval;
var WebGLBasic;
var WebGLDebugUtils;

var Uint8Array, Uint16Array, Float32Array;

var WebGLBasicTest = {};

WebGLBasicTest.debugMode = false;

WebGLBasicTest.onLoad = function () {
    try {
        WebGLBasicTest.init();
    } catch (e) {
        alert(e);
    }
};

WebGLBasicTest.init = function () {
    var canvas, gl, scene;
    var contextAttributes;

    canvas = document.getElementById("glcanvas");
    if (!canvas) {
        throw "Failed to find glcanvas";
    }

    contextAttributes = {
        depth: false
    };

    gl = canvas.getContext("webgl", contextAttributes);
    if (!gl) {
        gl = canvas.getContext("experimental-webgl", contextAttributes);
        if (!gl) {
            throw "Unable to initialize WebGL. Your browser may not support it.";
        }
    }

    if (WebGLBasicTest.debugMode) {
        gl = WebGLDebugUtils.makeDebugContext(gl, function (err, funcName, args) {
            var msg;

            msg = WebGLDebugUtils.glEnumToString(err);
            msg += " was caused by call to: " + funcName;
            msg += "(";
            msg += WebGLDebugUtils.glFunctionArgsToString(funcName, args);
            msg += ")";

            throw msg;
        });
    }

    scene = WebGLBasicTest.createScene(canvas, gl);

    setInterval(function () {
        var currentTime = Date.now();

        WebGLBasicTest.updateScene(scene, currentTime);
        WebGLBasic.interpretPasses(scene.interpreter, scene.passes);
    }, 1000/60);
};

WebGLBasicTest.createScene = function (canvas, gl) {
    var scene;

    scene = {
        canvas: canvas,
        gl: gl
    };

    scene.targets = WebGLBasicTest.createTargets(gl, canvas.width, canvas.height);
    scene.samplers = WebGLBasicTest.createSamplers(gl);
    scene.textures = WebGLBasicTest.createTextures(gl);
    scene.psos = WebGLBasicTest.createPipelineStates(gl);
    scene.nodes = WebGLBasicTest.createNodes(gl);
    scene.camera = WebGLBasicTest.createCamera();
    scene.passes = WebGLBasicTest.createPasses(scene);
    scene.interpreter = WebGLBasic.createInterpreter(gl);

    WebGLBasic.buildPipelineStates(gl, scene.psos);

    return scene;
};

WebGLBasicTest.createTargets = function (gl, width, height) {
    var targets;
    var framebufferStatus;

    targets = {};

    targets.color = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targets.color);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    targets.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, targets.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    targets.scenePassFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scenePassFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targets.color, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, targets.depth);
    framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
        throw "checkFramebufferStatus failed: " + WebGLDebugUtils.glEnumToString(framebufferStatus);
    }

    return targets;
};

WebGLBasicTest.createSamplers = function (gl) {
    var samplers;

    samplers = {};

    samplers.blit = {
        minFilter: gl.NEAREST,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE
    };

    samplers.checkerboard = {
        minFilter: gl.NEAREST_MIPMAP_LINEAR,
        magFilter: gl.NEAREST,
        wrapS: gl.REPEAT,
        wrapT: gl.REPEAT
    };

    return samplers;
};

WebGLBasicTest.createTextures = function (gl) {
    var textures;
    var checkerboardBytes;

    textures = {};

    checkerboardBytes = new Uint8Array(
        [
            255, 255, 255, 255,
            0, 0, 0, 255,
            0, 0, 0, 255,
            255, 255, 255, 255
        ]
    );

    textures.checkerboard = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures.checkerboard);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, checkerboardBytes);
    gl.generateMipmap(gl.TEXTURE_2D);

    return textures;
};

WebGLBasicTest.createPipelineStates = function (gl) {
    var psos;

    psos = {};

    psos.scene = {
        rootSignature: {
            rootParameters: {
                '0': {
                    type: "uniform",
                    semanticName: "MODELWORLD"
                },
                '1': {
                    type: "uniform",
                    semanticName: "WORLDVIEW"
                },
                '2': {
                    type: "uniform",
                    semanticName: "VIEWPROJECTION"
                },
                '3': {
                    type: "uniform",
                    semanticName: "COLOR"
                }
            }
        },
        vs: "" +
                "uniform highp mat4 MODELWORLD;\n" +
                "uniform highp mat4 WORLDVIEW;\n" +
                "uniform highp mat4 VIEWPROJECTION;\n" +
                "attribute highp vec3 POSITION;\n" +
                "void main() {\n" +
                "    mat4 modelViewProjection = VIEWPROJECTION * WORLDVIEW * MODELWORLD;\n" +
                "    gl_Position = modelViewProjection * vec4(POSITION, 1.0);\n" +
                "}\n",
        fs: "" +
                "uniform lowp vec4 COLOR;\n" +
                "void main() {\n" +
                "    gl_FragColor = vec4((gl_FragCoord.z * gl_FragCoord.w * COLOR.rgb), 1.0);\n" +
                "}\n",
        depthStencilState: {
            depthEnable: true,
            depthFunc: gl.LEQUAL
        },
        inputLayout: {
            POSITION: {
                inputSlot: 0,
                size: 3,
                type: gl.FLOAT,
                normalized: false,
                stride: 0,
                offset: 0
            }
        }
    };

    psos.blit = {
        rootSignature: {
            rootParameters: {
                '0': {
                    type: "sampler",
                    semanticName: "BLITSAMPLER"
                }
            }
        },
        vs: "" +
                "attribute lowp vec2 POSITION;\n" +
                "attribute lowp vec2 TEXCOORD;\n" +
                "varying lowp vec2 vTexCoord;\n" +
                "void main() {\n" +
                "    gl_Position = vec4(POSITION, 0.0, 1.0);\n" +
                "    vTexCoord = TEXCOORD;\n" +
                "}\n",
        fs: "" +
                "uniform sampler2D BLITSAMPLER;\n" +
                "varying lowp vec2 vTexCoord;\n" +
                "void main() {\n" +
                "    gl_FragColor = texture2D(BLITSAMPLER, vTexCoord);\n" +
                "}\n",
        inputLayout: {
            POSITION: {
                inputSlot: 0,
                size: 2,
                type: gl.FLOAT,
                normalized: false,
                stride: 16,
                offset: 0
            },
            TEXCOORD: {
                inputSlot: 0,
                size: 2,
                type: gl.FLOAT,
                normalized: false,
                stride: 16,
                offset: 8
            }
        }
    };

    return psos;
};

WebGLBasicTest.createNodes = function (gl) {
    var nodes;
    var cubeVertices, cubeIndices;
    var floorVertices;
    var blitVertices;

    nodes = {};

    cubeVertices = new Float32Array([
        +1.0, +1.0, +1.0, // 0
        +1.0, +1.0, -1.0, // 1
        +1.0, -1.0, +1.0, // 2
        +1.0, -1.0, -1.0, // 3
        -1.0, +1.0, +1.0, // 4
        -1.0, +1.0, -1.0, // 5
        -1.0, -1.0, +1.0, // 6
        -1.0, -1.0, -1.0  // 7
    ]);

    cubeIndices = new Uint16Array([
        0, 2, 1,
        1, 2, 3,
        3, 2, 7,
        7, 2, 6,
        6, 2, 4,
        4, 2, 0,
        6, 4, 7,
        7, 4, 5,
        5, 4, 1,
        1, 4, 0,
        1, 3, 5,
        5, 3, 7
    ]);

    floorVertices = new Float32Array([
        +1.0, +1.0, 0.0,
        -1.0, +1.0, 0.0,
        +1.0, -1.0, 0.0,
        +1.0, -1.0, 0.0,
        -1.0, +1.0, 0.0,
        -1.0, -1.0, 0.0
    ]);

    blitVertices = new Float32Array([
    //  position2D  texcoord
        +1.0, +1.0, 1.0, 1.0,
        -1.0, +1.0, 0.0, 1.0,
        +1.0, -1.0, 1.0, 0.0,
        -1.0, -1.0, 0.0, 0.0
    ]);

    nodes.cube = {};

    nodes.cube.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nodes.cube.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    nodes.cube.ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nodes.cube.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

    nodes.cube.vertexBufferViews = {
        '0': {
            buffer: nodes.cube.vbo
        }
    };

    nodes.cube.indexBufferView = {
        buffer: nodes.cube.ebo,
        type: gl.UNSIGNED_SHORT,
        offset: 0
    };

    nodes.cube.drawIndexedArgs = {
        primitiveTopology: gl.TRIANGLES,
        indexCountPerInstance: 36,
        startIndexLocation: 0
    };

    nodes.cube.transform = new Float32Array(WebGLBasic.makeTranslate4x4(0, 0, 1));

    nodes.floor = {};
    nodes.floor.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nodes.floor.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, floorVertices, gl.STATIC_DRAW);

    nodes.floor.vertexBufferViews = {
        '0': {
            buffer: nodes.floor.vbo
        }
    };

    nodes.floor.drawArgs = {
        primitiveTopology: gl.TRIANGLES,
        vertexCountPerInstance: 6,
        startVertexLocation: 0
    };

    nodes.floor.transform = new Float32Array(WebGLBasic.makeScale4x4(3, 3, 1));

    nodes.blit = {};
    nodes.blit.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nodes.blit.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, blitVertices, gl.STATIC_DRAW);

    nodes.blit.vertexBufferViews = {
        '0': {
            buffer: nodes.blit.vbo
        }
    };

    nodes.blit.drawArgs = {
        primitiveTopology: gl.TRIANGLE_STRIP,
        vertexCountPerInstance: 4,
        startVertexLocation: 0
    };

    return nodes;
};

WebGLBasicTest.createCamera = function () {
    var camera;

    camera = {};

    camera.worldPosition = [4, 4, 4];
    camera.worldView = new Float32Array(WebGLBasic.makeIdentity4x4());
    camera.viewProjection = new Float32Array(WebGLBasic.makeIdentity4x4());

    return camera;
};

WebGLBasicTest.createPasses = function (scene) {
    var gl;
    var scenePass;
    var blitPass;

    gl = scene.gl;

    scenePass = {
        commandList: [
            ["setFramebuffer", scene.targets.scenePassFBO],
            ["clearColor", [1.0, 1.0, 1.0, 1.0]],
            ["clearDepth", 1.0],
            ["setPipelineState", scene.psos.scene],
            ["setRootUniforms", {
                '1': scene.camera.worldView,
                '2': scene.camera.viewProjection,
                '3': new Float32Array([0.0, 0.0, 1.0, 1.0])
            }],
            ["setRootUniforms", {
                '0': scene.nodes.cube.transform
            }],
            ["drawNodes", [scene.nodes.cube]],
            ["setRootUniforms", {
                '0': scene.nodes.floor.transform,
                '3': new Float32Array([0.5, 0.5, 0.5, 1.0])
            }],
            ["drawNodes", [scene.nodes.floor]]
        ]
    };

    blitPass = {
        commandList: [
            ["setFramebuffer", null],
            ["setPipelineState", scene.psos.blit],
            ["setActiveTextures", {
                '0': {
                    target: gl.TEXTURE_2D,
                    texture: scene.targets.color,
                    sampler: scene.samplers.blit
                }
            }],
            ["setRootSamplers", {
                '0': 0
            }],
            ["drawNodes", [scene.nodes.blit]]
        ]
    };

    return [
        scenePass,
        blitPass
    ];
};

WebGLBasicTest.updateScene = function (scene, currentTime) {
    var canvas;
    var camera;
    var dtms, dt;
    var camRotate;
    var fovy;

    canvas = scene.canvas;
    camera = scene.camera;

    dtms = 0;
    if (scene.lastUpdateTime) {
        dtms = currentTime - scene.lastUpdateTime;
    }
    scene.lastUpdateTime = currentTime;
    dt = dtms / 1000.0;

    camRotate = WebGLBasic.makeRotate3x3(WebGLBasic.degToRad(dt * 90), [0, 0, 1]);
    camera.worldPosition = WebGLBasic.multMat3Vec3(camRotate, camera.worldPosition);

    camera.worldView.set(WebGLBasic.makeLookAt(camera.worldPosition, [0, 0, 0], [0, 0, 1]));

    fovy = WebGLBasic.degToRad(70.0);
    camera.viewProjection.set(WebGLBasic.makePerspective(fovy, canvas.width / canvas.height, 0.1, 1000.0));
};