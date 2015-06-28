function onload() {
    try {
        init();
    }
    catch (e) {
        alert(e);
    }
}

function init() {
    var canvas, gl, scene;
    
    canvas = document.getElementById("glcanvas");
    if (!canvas) {
        throw "Failed to find glcanvas";
    }
    
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
        throw "Unable to initialize WebGL. Your browser may not support it.";
    }
    
    gl = WebGLDebugUtils.makeDebugContext(gl, function (err, funcName, args) {
        throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
    });
    
    scene = createScene(canvas, gl);

    setInterval(function() {
        drawScene(scene);
    }, 1000/60);
}

function createScene(canvas, gl) {
    var scene;
    
    scene = { 
        canvas : canvas,
        gl : gl
    };
    
    scene.psos = createScenePipelineStates(scene);
    scene.nodes = createSceneNodes(scene);
    scene.camera = createSceneCamera(scene);
    scene.passes = createScenePasses(scene);
    scene.interpreter = createScenePassInterpreter(scene);
    
    return scene;
}

function createScenePipelineStates(scene) {
    var gl;
    var psos;
    var sceneVS, sceneFS;
    
    gl = scene.gl;
    
    psos = { };
    
    psos.scene = { };
    
    psos.scene.rootSignature = {
        rootParameters : {
            MODELWORLD : {
                type : "uniform",
                rootParameterSlot : 0
            },
            WORLDVIEW : {
                type : "uniform",
                rootParameterSlot : 1
            },
            VIEWPROJECTION : {
                type : "uniform",
                rootParameterSlot : 2
            },
            COLOR : {
                type : "uniform",
                rootParameterSlot : 3
            }
        }
    };
    
    sceneVS = "" +
        "attribute highp vec3 POSITION;\n" +
        "uniform highp mat4 MODELWORLD;\n" +
        "uniform highp mat4 WORLDVIEW;\n" +
        "uniform highp mat4 VIEWPROJECTION;\n" +
        "void main() {\n" +
        "    mat4 modelViewProjection = VIEWPROJECTION * WORLDVIEW * MODELWORLD;\n" +
        "    gl_Position = modelViewProjection * vec4(POSITION, 1.0);\n" +
        "}\n";
    
    sceneFS = "" +
        "uniform lowp vec4 COLOR;\n" +
        "void main() {\n" +
        "    gl_FragColor = vec4((gl_FragCoord.z * gl_FragCoord.w * COLOR.rgb), 1.0);\n" +
        "}\n";
            
    psos.scene.vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(psos.scene.vs, sceneVS);
    gl.compileShader(psos.scene.vs);
    if (!gl.getShaderParameter(psos.scene.vs, gl.COMPILE_STATUS)) {
        throw "Error compiling sceneVS: " + gl.getShaderInfoLog(psos.scene.vs);
    }
    
    psos.scene.fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(psos.scene.fs, sceneFS);
    gl.compileShader(psos.scene.fs);
    if (!gl.getShaderParameter(psos.scene.fs, gl.COMPILE_STATUS)) {
        throw "Error compiling sceneFS: " + gl.getShaderInfoLog(psos.scene.fs);
    }
    
    psos.scene.program = gl.createProgram();
    gl.attachShader(psos.scene.program, psos.scene.vs);
    gl.attachShader(psos.scene.program, psos.scene.fs);
    gl.linkProgram(psos.scene.program);
    if (!gl.getProgramParameter(psos.scene.program, gl.LINK_STATUS)) {
        throw "Error linking scene program: " + gl.getProgramInfoLog(psos.scene.program);
    }
    
    psos.scene.depthStencilState = {
        depthEnable : true,
        depthFunc : gl.LEQUAL
    };
    
    psos.scene.inputLayout = {
        POSITION : {
            inputSlot : 0,
            size : 3,
            type : gl.FLOAT,
            normalized : false,
            stride : 0,
            offset : 0
        },
    };
    
    initPipelineState(gl, psos.scene);
    
    return psos;
}

function initPipelineState(gl, pso) {
    var numActiveUniforms, activeUniform, uniformLocation;
    var i;
    
    pso.uniforms = { };
    numActiveUniforms = gl.getProgramParameter(pso.program, gl.ACTIVE_UNIFORMS);
    for (i = 0; i < numActiveUniforms; i += 1) {
        activeUniform = gl.getActiveUniform(pso.program, i);
        uniformLocation = gl.getUniformLocation(pso.program, activeUniform.name);
        pso.uniforms[activeUniform.name] = {
            name : activeUniform.name,
            size : activeUniform.size,
            type : activeUniform.type,
            location : uniformLocation,
        };
    }
}

function createSceneNodes(scene) {
    var gl;
    var nodes;
    var cubeVertices, cubeIndices;
    
    gl = scene.gl;
    
    nodes = { };
    
    cubeVertices = [
        +1.0, +1.0, +1.0, // 0
        +1.0, +1.0, -1.0, // 1
        +1.0, -1.0, +1.0, // 2
        +1.0, -1.0, -1.0, // 3
        -1.0, +1.0, +1.0, // 4
        -1.0, +1.0, -1.0, // 5
        -1.0, -1.0, +1.0, // 6
        -1.0, -1.0, -1.0, // 7
    ];
    
    cubeIndices = [
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
    ];
    
    nodes.cube = { };
    
    nodes.cube.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nodes.cube.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVertices), gl.STATIC_DRAW);
    
    nodes.cube.ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nodes.cube.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.STATIC_DRAW);
    
    nodes.cube.vertexBufferViews = [
        { buffer : nodes.cube.vbo, inputSlot : 0 }
    ];
    
    nodes.cube.indexBufferView = {
        buffer : nodes.cube.ebo,
        type : gl.UNSIGNED_SHORT,
        offset : 0
    };
    
    nodes.cube.drawIndexedArgs = {
        primitiveTopology : gl.TRIANGLES,
        indexCountPerInstance : cubeIndices.length,
        startIndexLocation : 0,
    };
    
    return nodes;
}

function createSceneCamera(scene) {
    var canvas;
    var camera;
    var fovy;
    
    canvas = scene.canvas;
    
    camera = { };
    
    camera.WorldView = new Float32Array(makeLookAt([3,3,3],[0,0,0],[0,0,1]));
    
    fovy = 70.0 * Math.PI / 180.0;
    camera.ViewProjection = new Float32Array(makePerspective(fovy, canvas.width / canvas.height, 0.1, 1000.0));
    
    return camera;
}

function makeLookAt(eye, center, up) {
    var f, flen, fnorm, uplen, upnorm, s, slen, snorm, u, tx, ty, tz;
    
    f = [center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]];
    flen = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    fnorm = [f[0] / flen, f[1] / flen, f[2] / flen];
    
    uplen = Math.sqrt(up[0] * up[0] + up[1] * up[1] + up[2] * up[2]);
    
    upnorm = [up[0] / uplen ,up[1] / uplen ,up[2] / uplen];
    
    s = [fnorm[1] * upnorm[2] - upnorm[1] * fnorm[2]
        ,fnorm[2] * upnorm[0] - upnorm[2] * fnorm[0]
        ,fnorm[0] * upnorm[1] - upnorm[0] * fnorm[1]];
    
    slen = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
    snorm = [s[0] / slen, s[1] / slen, s[2] / slen];
    
    u = [snorm[1] * fnorm[2] - fnorm[1] * snorm[2]
        ,snorm[2] * fnorm[0] - fnorm[2] * snorm[0]
        ,snorm[0] * fnorm[1] - fnorm[0] * snorm[1]];
    
    tx = -(eye[0] * s[0]     + eye[1] * s[1]     + eye[2] * s[2]    );
    ty = -(eye[0] * u[0]     + eye[1] * u[1]     + eye[2] * u[2]    );
    tz = +(eye[0] * fnorm[0] + eye[1] * fnorm[1] + eye[2] * fnorm[2]);
    
    return [
        s[0], u[0], -fnorm[0], 0,
        s[1], u[1], -fnorm[1], 0,
        s[2], u[2], -fnorm[2], 0,
          tx,   ty,        tz, 1
    ];
}

function makePerspective(fovy, aspect, zNear, zFar) {
    var f;
    
    f = 1.0 / Math.tan(fovy / 2.0);
    
    return [
        f / aspect, 0,                                   0,  0,
        0,          f,                                   0,  0,
        0,          0,     (zFar + zNear) / (zNear - zFar), -1,
        0,          0, (2 * zFar * zNear) / (zNear - zFar),  0
    ];
}

function createScenePasses(scene) {
    var passes;
    var scenePass;
    
    passes = [ ];
    
    scenePass = {
        commandList : [
            [ "clearColor", [1.0, 1.0, 1.0, 1.0] ],
            [ "clearDepth", 1.0 ],
            [ "setPipelineState", scene.psos.scene ],
            [ "setRootUniforms", {
                1 : scene.camera.WorldView,
                2 : scene.camera.ViewProjection,
                3 : new Float32Array([0.0, 0.0, 1.0, 1.0])
            }],
            [ "setRootUniforms", {
                0 : new Float32Array([1,0,0,0
                                     ,0,1,0,0
                                     ,0,0,1,0
                                     ,0,0,0,1])
            }],
            [ "drawNodes", [ scene.nodes.cube ] ],
        ]
    };
    
    passes.push(scenePass);
    
    return passes;
}

function createScenePassInterpreter(scene) {
    var gl;
    var interpreter;
    
    gl = scene.gl;
    
    interpreter = { };
    
    interpreter.interpret = function (command) {
        return interpreter[command[0]](command[1]);
    };
    
    interpreter.clearColor = function (color) {
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };
    
    interpreter.clearDepth = function (depth) {
        gl.clearDepth(depth);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    };
    
    interpreter.setPipelineState = function (pso) {
        var semanticName, inputAttribute, inputAttributeLocation;
        var rootParameterName, rootParameter, uniformInfo;
        
        gl.useProgram(pso.program);
        
        interpreter.inputSlotToAttributeLocation = { };
        interpreter.inputSlotToAttribute = { };
        for (semanticName in pso.inputLayout) {
            inputAttribute = pso.inputLayout[semanticName];
            inputAttributeLocation = gl.getAttribLocation(pso.program, semanticName);
            if (inputAttributeLocation !== -1) {
                interpreter.inputSlotToAttributeLocation[inputAttribute.inputSlot] = inputAttributeLocation;
                interpreter.inputSlotToAttribute[inputAttribute.inputSlot] = inputAttribute;
            }
        }
        
        interpreter.rootParameterSlotToUniform = { };
        for (rootParameterName in pso.rootSignature.rootParameters) {
            rootParameter = pso.rootSignature.rootParameters[rootParameterName];
            if (rootParameter.type === "uniform") {
                uniformInfo = pso.uniforms[rootParameterName];
                interpreter.rootParameterSlotToUniform[rootParameter.rootParameterSlot] = uniformInfo;
            }
        }
        
        if (pso.depthStencilState.depthEnable) {
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(pso.depthStencilState.depthFunc);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
    };
    
    interpreter.setRootUniforms = function (rootUniforms) {
        var rootParameterSlot, uniformInfo;
        var uniformLocation, uniformValue;
        
        for (rootParameterSlot in rootUniforms) {
            uniformInfo = interpreter.rootParameterSlotToUniform[rootParameterSlot];
            uniformLocation = uniformInfo.location;
            uniformValue = rootUniforms[rootParameterSlot];
            switch (uniformInfo.type) {
                case gl.FLOAT_VEC4:
                    gl.uniform4fv(uniformLocation, uniformValue);
                    break;
                case gl.FLOAT_MAT4:
                    gl.uniformMatrix4fv(uniformLocation, false, uniformValue);
                    break;
                default:
                    throw "Unhandled uniform type: " + uniformInfo.type;
            }
        }
    };
    
    interpreter.drawNodes = function (nodeList) {
        var nodeIdx, node;
        var vbvIdx, vbv;
        var inputAttributeLocation, inputAttribute;
        var ibv;
        
        for (nodeIdx = 0; nodeIdx < nodeList.length; nodeIdx++) {
            node = nodeList[nodeIdx];
            
            if (node.vertexBufferViews) {
                for (vbvIdx = 0; vbvIdx < node.vertexBufferViews.length; vbvIdx += 1) {
                    vbv = node.vertexBufferViews[vbvIdx];
                    gl.bindBuffer(gl.ARRAY_BUFFER, vbv.buffer);
                    
                    inputAttributeLocation = interpreter.inputSlotToAttributeLocation[vbv.inputSlot];
                    inputAttribute = interpreter.inputSlotToAttribute[vbv.inputSlot];
                    
                    gl.vertexAttribPointer(
                        inputAttributeLocation,
                        inputAttribute.size,
                        inputAttribute.type,
                        inputAttribute.normalized,
                        inputAttribute.stride,
                        inputAttribute.offset);
                        
                    gl.enableVertexAttribArray(inputAttributeLocation);
                }
            }
            
            if (node.indexBufferView) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, node.indexBufferView.buffer);
            }
            
            if (node.drawArgs) {
                gl.drawArrays(
                    node.drawArgs.primitiveTopology,
                    node.drawArgs.startVertexLocation, 
                    node.drawArgs.vertexCountPerInstance);
            }
            
            if (node.drawIndexedArgs) {
                gl.drawElements(
                    node.drawIndexedArgs.primitiveTopology,
                    node.drawIndexedArgs.indexCountPerInstance,
                    node.indexBufferView.type,
                    node.indexBufferView.offset);
            }
        }
    };
    
    return interpreter;
}

function drawScene(scene) {
    var gl;
    var passIdx, pass;
    var cmdIdx;
    var node, attrib;
        
    gl = scene.gl;
    
    for (passIdx = 0; passIdx < scene.passes.length; passIdx += 1) {
        pass = scene.passes[passIdx];
        for (cmdIdx = 0; cmdIdx < pass.commandList.length; cmdIdx += 1) {
            scene.interpreter.interpret(pass.commandList[cmdIdx]);
        }
    }
}