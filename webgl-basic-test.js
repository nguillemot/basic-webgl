WebGLBasicTest = { };

WebGLBasicTest.onLoad = function () {  
    try {
        WebGLBasicTest.init();
    }
    catch (e) {
        alert(e);
    }
};

WebGLBasicTest.init = function () {
    var canvas, gl, scene;
    
    canvas = document.getElementById("glcanvas");
    if (!canvas) {
        throw "Failed to find glcanvas";
    }
    
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
        throw "Unable to initialize WebGL. Your browser may not support it.";
    }
    
    // TODO: Do only in debug mode... somehow.
    gl = WebGLDebugUtils.makeDebugContext(gl, function (err, funcName, args) {
        throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
    });
    
    scene = WebGLBasicTest.createScene(canvas, gl);

    setInterval(function() {
        WebGLBasicTest.updateScene(scene);
        WebGLBasic.interpretPasses(scene.interpreter, scene.passes);
    }, 1000/60);
};

WebGLBasicTest.createScene = function (canvas, gl) {
    var scene;
    
    scene = { 
        canvas : canvas,
        gl : gl
    };
    
    scene.psos = WebGLBasicTest.createScenePipelineStates(scene);
    scene.nodes = WebGLBasicTest.createSceneNodes(scene);
    scene.camera = WebGLBasicTest.createSceneCamera(scene);
    scene.passes = WebGLBasicTest.createScenePasses(scene);
    scene.interpreter = WebGLBasic.createInterpreter(gl);
    
    WebGLBasic.buildPipelineStates(gl, scene.psos);
    
    return scene;
};

WebGLBasicTest.createScenePipelineStates = function (scene) {
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
        
    return psos;
}

WebGLBasicTest.createSceneNodes = function (scene) {
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
};

WebGLBasicTest.createSceneCamera = function (scene) {
    var camera;
        
    camera = { };
    
    camera.WorldView = new Float32Array(WebGLBasic.makeIdentity4x4());
    camera.ViewProjection = new Float32Array(WebGLBasic.makeIdentity4x4());
    
    return camera;
};

WebGLBasicTest.createScenePasses = function (scene) {
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
};

WebGLBasicTest.updateScene = function (scene) {
    var canvas;
    var camera;
    var fovy;
    
    canvas = scene.canvas;
    camera = scene.camera;
    
    camera.WorldView.set(WebGLBasic.makeLookAt([3,3,3],[0,0,0],[0,0,1]));
    
    fovy = 70.0 * Math.PI / 180.0;
    camera.ViewProjection.set(WebGLBasic.makePerspective(fovy, canvas.width / canvas.height, 0.1, 1000.0));
};