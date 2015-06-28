WebGLBasic = { };

WebGLBasic.buildPipelineStates = function (gl, psos) {
    var psoName, pso;
    var numActiveUniforms, activeUniform, uniformLocation;
    var i;
        
    for (psoName in psos) {
        pso = psos[psoName];
        
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
};

WebGLBasic.makeIdentity4x4 = function () {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
};

WebGLBasic.makeLookAt = function (eye, center, up) {
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
};

WebGLBasic.makePerspective = function (fovy, aspect, zNear, zFar) {
    var f;
    
    f = 1.0 / Math.tan(fovy / 2.0);
    
    return [
        f / aspect, 0,                                   0,  0,
        0,          f,                                   0,  0,
        0,          0,     (zFar + zNear) / (zNear - zFar), -1,
        0,          0, (2 * zFar * zNear) / (zNear - zFar),  0
    ];
};

WebGLBasic.createInterpreter = function (gl) {
    var interpreter;
    
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
};

WebGLBasic.interpretPasses = function (interpreter, passes) {
    var passIdx, pass;
    var cmdIdx;
    
    for (passIdx = 0; passIdx < passes.length; passIdx += 1) {
        pass = passes[passIdx];
        for (cmdIdx = 0; cmdIdx < pass.commandList.length; cmdIdx += 1) {
            interpreter.interpret(pass.commandList[cmdIdx]);
        }
    }
};