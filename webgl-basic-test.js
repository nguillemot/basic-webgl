var WebGLBasic;
var WebGLDebugUtils;

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
    scene.passes = WebGLBasicTest.createPasses(gl, scene);
    scene.interpreter = WebGLBasic.createInterpreter(gl);

    WebGLBasic.buildPipelineStates(gl, scene.psos);

    return scene;
};

WebGLBasicTest.createTargets = function (gl, width, height) {
    var targets;
    var framebufferStatus;

    targets = {};

    targets.scene = {};

    targets.scene.color = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targets.scene.color);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    targets.scene.depthStencil = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, targets.scene.depthStencil);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);

    targets.scene.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scene.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targets.scene.color, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, targets.scene.depthStencil);
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
                modelWorld: {
                    semanticName: "MODELWORLD"
                },
                worldView: {
                    semanticName: "WORLDVIEW"
                },
                viewProjection: {
                    semanticName: "VIEWPROJECTION"
                },
                tintColor: {
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
                "    gl_FragColor = vec4((gl_FragCoord.z * gl_FragCoord.w * COLOR.rgb), COLOR.a);\n" +
                "}\n",
        depthStencilState: {
            depthEnable: true,
            depthFunc: gl.LEQUAL
        },
        inputLayout: {
            POSITION: {
                inputSlot: "meshVertices",
                size: 3,
                type: gl.FLOAT,
                normalized: false,
                stride: 0,
                offset: 0
            }
        }
    };

    psos.mirrorMask = {
        rootSignature: {
            rootParameters: {
                modelWorld: {
                    semanticName: "MODELWORLD"
                },
                worldView: {
                    semanticName: "WORLDVIEW"
                },
                viewProjection: {
                    semanticName: "VIEWPROJECTION"
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
                "void main() {\n" +
                "}\n",
        depthStencilState: {
            depthEnable: true,
            depthFunc: gl.LEQUAL,
            depthMask: false,
            stencilEnable: true,
            frontFace: {
                stencilPassOp: gl.ZERO
            },
            backFace: {
                stencilPassOp: gl.ZERO
            }
        },
        blendState: {
            renderTargetBlendStates: [
                {
                    renderTargetWriteMask: [false, false, false, false]
                }
            ]
        },
        inputLayout: {
            POSITION: psos.scene.inputLayout.POSITION
        }
    };

    psos.reflectedScene = Object.create(psos.scene);
    psos.reflectedScene.depthStencilState = {
        depthEnable: true,
        depthFunc: gl.LEQUAL,
        stencilEnable: true,
        frontFace: {
            stencilFunc: gl.EQUAL
        },
        backFace: {
            stencilFunc: gl.EQUAL
        }
    };

    psos.mirror = Object.create(psos.scene);
    psos.mirror.blendState = {
        renderTargetBlendStates: [
            {
                blendEnable: true,
                srcBlend: gl.SRC_ALPHA,
                destBlend: gl.ONE_MINUS_SRC_ALPHA
            }
        ]
    };

    psos.blit = {
        rootSignature: {
            rootParameters: {
                blitSampler: {
                    semanticName: "BLITSAMPLER"
                }
            }
        },
        vs: "" +
                "attribute lowp vec2 POSITION;\n" +
                "attribute lowp vec2 TEXCOORD;\n" +
                "varying lowp vec2 vTEXCOORD;\n" +
                "void main() {\n" +
                "    gl_Position = vec4(POSITION, 0.0, 1.0);\n" +
                "    vTEXCOORD = TEXCOORD;\n" +
                "}\n",
        fs: "" +
                "uniform sampler2D BLITSAMPLER;\n" +
                "varying lowp vec2 vTEXCOORD;\n" +
                "void main() {\n" +
                "    gl_FragColor = texture2D(BLITSAMPLER, vTEXCOORD);\n" +
                "}\n",
        inputLayout: {
            POSITION: {
                inputSlot: "blitVertices",
                size: 2,
                type: gl.FLOAT,
                normalized: false,
                stride: 16,
                offset: 0
            },
            TEXCOORD: {
                inputSlot: "blitVertices",
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

    nodes.cube.vertexBufferSlots = {
        meshVertices: {
            buffer: nodes.cube.vbo
        }
    };

    nodes.cube.indexBufferSlot = {
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

    nodes.floor.vertexBufferSlots = {
        meshVertices: {
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

    nodes.blit.vertexBufferSlots = {
        blitVertices: {
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

WebGLBasicTest.createPasses = function (gl, scene) {
    var scenePass;
    var blitPass;

    scenePass = {
        commandList: [
            // Draw the scene normally
            ["setFramebuffer", scene.targets.scene.framebuffer],
            ["clearColor", [1.0, 1.0, 1.0, 1.0]],
            ["clearDepth", 1.0],
            ["setPipelineState", scene.psos.scene],
            ["setRootUniforms", {
                worldView: scene.camera.worldView,
                viewProjection: scene.camera.viewProjection,
                tintColor: new Float32Array([0.0, 0.0, 1.0, 1.0])
            }],
            ["setRootUniforms", {
                modelWorld: scene.nodes.cube.transform
            }],
            ["drawNodes", [scene.nodes.cube]],
            // Draw the mirror into the stencil
            ["clearStencil", 1],
            ["setPipelineState", scene.psos.mirrorMask],
            ["setRootUniforms", {
                worldView: scene.camera.worldView,
                viewProjection: scene.camera.viewProjection
            }],
            ["setRootUniforms", {
                modelWorld: scene.nodes.floor.transform
            }],
            ["drawNodes", [scene.nodes.floor]],
            // Draw the scene again but flipped and stencil masked
            ["setPipelineState", scene.psos.reflectedScene],
            ["setRootUniforms", {
                worldView: function () {
                    var flip = WebGLBasic.makeScale4x4(1, 1, -1);
                    return WebGLBasic.multMat4(scene.camera.worldView, flip);
                },
                viewProjection: scene.camera.viewProjection,
                tintColor: new Float32Array([0.0, 0.0, 1.0, 1.0])
            }],
            ["setRootUniforms", {
                modelWorld: scene.nodes.cube.transform
            }],
            ["drawNodes", [scene.nodes.cube]],
            // Now draw the mirror's surface
            ["setPipelineState", scene.psos.mirror],
            ["setRootUniforms", {
                worldView: scene.camera.worldView,
                viewProjection: scene.camera.viewProjection,
                tintColor: new Float32Array([1.0, 0.5, 0.5, 0.9])
            }],
            ["setRootUniforms", {
                modelWorld: scene.nodes.floor.transform
            }],
            ["drawNodes", [scene.nodes.floor]]
        ]
    };

    blitPass = {
        commandList: [
            ["setFramebuffer", null],
            ["setPipelineState", scene.psos.blit],
            ["setActiveTextures", [
                {
                    textureImageUnit: 0,
                    target: gl.TEXTURE_2D,
                    texture: scene.targets.scene.color,
                    sampler: scene.samplers.blit
                }
            ]],
            ["setRootUniforms", {
                blitSampler: 0
            }],
            ["drawNodes", [scene.nodes.blit]]
        ]
    };

    return [
        scenePass,
        blitPass
    ];
};

WebGLBasicTest.updateScene = function (scene, currentTimeMs) {
    var canvas;
    var dtms, dt, currentTimeS;

    canvas = scene.canvas;

    // Compute delta-time
    dtms = 0;
    if (scene.lastUpdateTimeMs) {
        dtms = currentTimeMs - scene.lastUpdateTimeMs;
    }
    scene.lastUpdateTimeMs = currentTimeMs;
    dt = dtms / 1000.0;
    currentTimeS = currentTimeMs / 1000.0;

    // Update camera
    (function () {
        var camRotate;
        var camera = scene.camera;

        camRotate = WebGLBasic.makeRotate3x3(WebGLBasic.degToRad(dt * 20), [0, 0, 1]);
        camera.worldPosition = WebGLBasic.multMat3Vec3(camRotate, camera.worldPosition);

        camera.worldView.set(WebGLBasic.makeLookAt(camera.worldPosition, [0, 0, 0], [0, 0, 1]));

        camera.viewProjection.set(
            WebGLBasic.makePerspective(
                WebGLBasic.degToRad(70.0),
                canvas.width / canvas.height,
                0.1,
                1000.0
            )
        );
    }());

    // Update cube
    (function () {
        var cubePosition;

        if (!scene.nodes.cube.modelTransform) {
            scene.nodes.cube.modelTransform = new Float32Array(scene.nodes.cube.transform);
        }

        cubePosition = [2.3 * Math.cos(currentTimeS), 2.3 * Math.sin(currentTimeS), 0];

        scene.nodes.cube.transform.set(
            WebGLBasic.multMat4(
                WebGLBasic.makeTranslate4x4(cubePosition[0], cubePosition[1], cubePosition[2]),
                WebGLBasic.multMat4(
                    WebGLBasic.makeRotate4x4(currentTimeS, [0, 0, 1]),
                    scene.nodes.cube.modelTransform
                )
            )
        );
    }());
};