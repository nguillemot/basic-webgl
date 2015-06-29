"use strict";

var WebGLBasic = {};

WebGLBasic.buildPipelineStates = function (gl, psos) {
    Object.keys(psos).forEach(function (psoName) {
        var pso;

        pso = psos[psoName];

        if (pso.wasBuilt) {
            throw "Pipeline state object " + psoName + " has already been built once.";
        }

        // Program compilation
        (function () {
            var vs, fs;

            // Compile vertex shader
            if (!pso.vs) {
                throw "Pipeline state objects must have a vertex shader.";
            }

            vs = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vs, pso.vs);
            gl.compileShader(vs);
            if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
                throw "Error compiling vertex shader: " + gl.getShaderInfoLog(vs);
            }

            // Compile fragment shader
            if (!pso.fs) {
                throw "Pipeline state objects must have a fragment shader.";
            }

            fs = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fs, pso.fs);
            gl.compileShader(fs);
            if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
                throw "Error compiling fragment shader: " + gl.getShaderInfoLog(fs);
            }

            // Link program
            pso.program = gl.createProgram();
            gl.attachShader(pso.program, vs);
            gl.attachShader(pso.program, fs);
            gl.linkProgram(pso.program);
            if (!gl.getProgramParameter(pso.program, gl.LINK_STATUS)) {
                throw "Error linking program: " + gl.getProgramInfoLog(pso.program);
            }
        }());

        // Query all the active attributes from the program.
        (function () {
            var activeAttributeIndex, activeAttribute, attributeLocation;

            pso.attributes = {};
            activeAttributeIndex = gl.getProgramParameter(pso.program, gl.ACTIVE_ATTRIBUTES) - 1;
            while (activeAttributeIndex >= 0) {
                activeAttribute = gl.getActiveAttrib(pso.program, activeAttributeIndex);
                attributeLocation = gl.getAttribLocation(pso.program, activeAttribute.name);
                pso.attributes[activeAttribute.name] = {
                    name: activeAttribute.name,
                    size: activeAttribute.size,
                    type: activeAttribute.type,
                    location: attributeLocation
                };
                activeAttributeIndex -= 1;
            }
        }());

        // Parse input layout
        (function () {
            // Set up default input layout if missing
            if (!pso.inputLayout) {
                pso.inputLayout = {};
            }

            // Create mappings to set attributes faster later.
            pso.attributeLocationsForInputSlot = {};
            pso.attributeLocationToAttribute = {};
            Object.keys(pso.inputLayout).forEach(function (semanticName) {
                var inputAttribute, inputAttributeLocation;

                inputAttribute = pso.inputLayout[semanticName];
                inputAttributeLocation = gl.getAttribLocation(pso.program, semanticName);

                if (inputAttributeLocation === -1) {
                    throw "Attribute " + semanticName + " could not be matched with the program.";
                }

                if (!pso.attributeLocationsForInputSlot[inputAttribute.inputSlot]) {
                    pso.attributeLocationsForInputSlot[inputAttribute.inputSlot] = [];
                }
                pso.attributeLocationsForInputSlot[inputAttribute.inputSlot].push(inputAttributeLocation);
                pso.attributeLocationToAttribute[inputAttributeLocation] = inputAttribute;
            });
        }());

        // Query all the active uniforms from the program.
        (function () {
            var activeUniformIndex, activeUniform, uniformLocation;

            pso.uniforms = {};
            activeUniformIndex = gl.getProgramParameter(pso.program, gl.ACTIVE_UNIFORMS) - 1;
            while (activeUniformIndex >= 0) {
                activeUniform = gl.getActiveUniform(pso.program, activeUniformIndex);
                uniformLocation = gl.getUniformLocation(pso.program, activeUniform.name);
                pso.uniforms[activeUniform.name] = {
                    name: activeUniform.name,
                    size: activeUniform.size,
                    type: activeUniform.type,
                    location: uniformLocation
                };
                activeUniformIndex -= 1;
            }
        }());

        // Parse root signature
        (function () {
            // Set up default root signature if missing
            if (!pso.rootSignature) {
                pso.rootSignature = {};
            }
            if (!pso.rootSignature.rootParameters) {
                pso.rootSignature.rootParameters = {};
            }

            pso.rootParameterSlotToUniform = {};
            Object.keys(pso.rootSignature.rootParameters).forEach(function (rootParameterSlot) {
                var rootParameter, rootParameterName;
                var uniformInfo;

                rootParameter = pso.rootSignature.rootParameters[rootParameterSlot];
                rootParameterName = rootParameter.semanticName;

                if (!rootParameterName) {
                    throw "Root parameter " + rootParameterSlot + " is missing a semanticName";
                }

                uniformInfo = pso.uniforms[rootParameterName];

                if (!uniformInfo) {
                    throw "Root parameter " + rootParameterName + " could not be matched with the program.";
                }

                pso.rootParameterSlotToUniform[rootParameterSlot] = uniformInfo;
            });
        }());

        // Set up default rasterizer state if missing
        if (!pso.rasterizerState) {
            pso.rasterizerState = {};
        }
        if (typeof(pso.rasterizerState.cullEnable) === 'undefined') {
            pso.rasterizerState.cullEnable = false;
        }
        if (typeof(pso.rasterizerState.cullMode) === 'undefined') {
            pso.rasterizerState.cullMode = gl.BACK;
        }

        // Set up default depth stencil state if missing
        if (!pso.depthStencilState) {
            pso.depthStencilState = {};
        }
        if (typeof(pso.depthStencilState.depthEnable) === 'undefined') {
            pso.depthStencilState.depthEnable = false;
        }
        if (typeof(pso.depthStencilState.depthFunc) === 'undefined') {
            pso.depthStencilState.depthFunc = gl.LESS;
        }
        if (typeof(pso.depthStencilState.depthMask) === 'undefined') {
            pso.depthStencilState.depthMask = true;
        }
        if (typeof(pso.depthStencilState.stencilEnable) === 'undefined') {
            pso.depthStencilState.stencilEnable = false;
        }
        if (typeof(pso.depthStencilState.stencilWriteMask) === 'undefined') {
            pso.depthStencilState.stencilWriteMask = 0xFFFFFFFF;
        }
        if (!pso.depthStencilState.frontFace) {
            pso.depthStencilState.frontFace = {};
        }
        if (typeof(pso.depthStencilState.frontFace.stencilFunc) === 'undefined') {
            pso.depthStencilState.frontFace.stencilFunc = gl.ALWAYS;
        }
        if (typeof(pso.depthStencilState.frontFace.stencilRef) === 'undefined') {
            pso.depthStencilState.frontFace.stencilRef = 0;
        }
        if (typeof(pso.depthStencilState.frontFace.stencilReadMask) === 'undefined') {
            pso.depthStencilState.frontFace.stencilReadMask = 0xFFFFFFFF;
        }
        if (typeof(pso.depthStencilState.frontFace.stencilFailOp) === 'undefined') {
            pso.depthStencilState.frontFace.stencilFailOp = gl.KEEP;
        }
        if (typeof(pso.depthStencilState.frontFace.stencilDepthFailOp) === 'undefined') {
            pso.depthStencilState.frontFace.stencilDepthFailOp = gl.KEEP;
        }
        if (typeof(pso.depthStencilState.frontFace.stencilPassOp) === 'undefined') {
            pso.depthStencilState.frontFace.stencilPassOp = gl.KEEP;
        }
        if (!pso.depthStencilState.backFace) {
            pso.depthStencilState.backFace = {};
        }
        if (typeof(pso.depthStencilState.backFace.stencilFunc) === 'undefined') {
            pso.depthStencilState.backFace.stencilFunc = gl.ALWAYS;
        }
        if (typeof(pso.depthStencilState.backFace.stencilRef) === 'undefined') {
            pso.depthStencilState.backFace.stencilRef = 0;
        }
        if (typeof(pso.depthStencilState.backFace.stencilReadMask) === 'undefined') {
            pso.depthStencilState.backFace.stencilReadMask = 0xFFFFFFFF;
        }
        if (typeof(pso.depthStencilState.backFace.stencilFailOp) === 'undefined') {
            pso.depthStencilState.backFace.stencilFailOp = gl.KEEP;
        }
        if (typeof(pso.depthStencilState.backFace.stencilDepthFailOp) === 'undefined') {
            pso.depthStencilState.backFace.stencilDepthFailOp = gl.KEEP;
        }
        if (typeof(pso.depthStencilState.backFace.stencilPassOp) === 'undefined') {
            pso.depthStencilState.backFace.stencilPassOp = gl.KEEP;
        }

        // Set up default blend state if missing
        if (!pso.blendState) {
            pso.blendState = {};
        }
        if (!pso.blendState.renderTargetBlendStates) {
            pso.blendState.renderTargetBlendStates = [];
        }

        (function () {
            var i = 0;
            var maxRenderTargets = 1;

            while (i < maxRenderTargets) {
                if (!pso.blendState.renderTargetBlendStates[i]) {
                    pso.blendState.renderTargetBlendStates[i] = {};
                }

                i += 1;
            }

            if (pso.blendState.renderTargetBlendStates.length > maxRenderTargets) {
                throw "WebGL only supports " + maxRenderTargets + " render target" + (maxRenderTargets > 1 ? "s" : "") + ".";
            }
        }());

        pso.blendState.renderTargetBlendStates.forEach(function (renderTargetBlendState) {
            var i;

            if (!renderTargetBlendState.renderTargetWriteMask) {
                renderTargetBlendState.renderTargetWriteMask = [];
            }

            i = 0;
            while (i < 4) {
                if (typeof(renderTargetBlendState.renderTargetWriteMask[i]) === 'undefined') {
                    renderTargetBlendState.renderTargetWriteMask[i] = true;
                }
                i += 1;
            }
        });

        pso.wasBuilt = true;
    });
};

WebGLBasic.degToRad = function (deg) {
    return deg * Math.PI / 180.0;
};

WebGLBasic.makeIdentity4x4 = function () {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
};

WebGLBasic.makeTranslate4x4 = function (translateX, translateY, translateZ) {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translateX, translateY, translateZ, 1
    ];
};

WebGLBasic.makeScale4x4 = function (scaleX, scaleY, scaleZ) {
    return [
        scaleX, 0, 0, 0,
        0, scaleY, 0, 0,
        0, 0, scaleZ, 0,
        0, 0, 0, 1
    ];
};

WebGLBasic.makeRotate3x3 = function (angle, axis) {
    var c, s;
    var axislen, axisnorm, x, y, z;

    c = Math.cos(angle);
    s = Math.sin(angle);

    axislen = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
    axisnorm = [axis[0] / axislen, axis[1] / axislen, axis[2] / axislen];
    x = axisnorm[0];
    y = axisnorm[1];
    z = axisnorm[2];

    return [
        x * x * (1 - c) + c, y * x * (1 - c) + z * s, x * z * (1 - c) - y * s,
        x * y * (1 - c) - z * s, y * y * (1 - c) + c, y * z * (1 - c) + x * s,
        x * z * (1 - c) + y * s, y * z * (1 - c) - x * s, z * z * (1 - c) + c
    ];
};

WebGLBasic.makeRotate4x4 = function (angle, axis) {
    var r3x3;

    r3x3 = WebGLBasic.makeRotate3x3(angle, axis);

    return [
        r3x3[0], r3x3[1], r3x3[2], 0,
        r3x3[3], r3x3[4], r3x3[5], 0,
        r3x3[6], r3x3[7], r3x3[8], 0,
        0, 0, 0, 1
    ];
};

WebGLBasic.multMat3Vec3 = function (m, v) {
    return [
        m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
        m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
        m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
    ];
};

WebGLBasic.makeLookAt = function (eye, center, up) {
    var f, flen, fnorm, uplen, upnorm, s, slen, snorm, u, tx, ty, tz;

    f = [center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]];
    flen = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    fnorm = [f[0] / flen, f[1] / flen, f[2] / flen];

    uplen = Math.sqrt(up[0] * up[0] + up[1] * up[1] + up[2] * up[2]);

    upnorm = [up[0] / uplen, up[1] / uplen, up[2] / uplen];

    s = [
        fnorm[1] * upnorm[2] - upnorm[1] * fnorm[2],
        fnorm[2] * upnorm[0] - upnorm[2] * fnorm[0],
        fnorm[0] * upnorm[1] - upnorm[0] * fnorm[1]
    ];

    slen = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
    snorm = [s[0] / slen, s[1] / slen, s[2] / slen];

    u = [
        snorm[1] * fnorm[2] - fnorm[1] * snorm[2],
        snorm[2] * fnorm[0] - fnorm[2] * snorm[0],
        snorm[0] * fnorm[1] - fnorm[0] * snorm[1]
    ];

    tx = -(eye[0] * s[0] + eye[1] * s[1] + eye[2] * s[2]);
    ty = -(eye[0] * u[0] + eye[1] * u[1] + eye[2] * u[2]);
    tz = +(eye[0] * fnorm[0] + eye[1] * fnorm[1] + eye[2] * fnorm[2]);

    return [
        s[0], u[0], -fnorm[0], 0,
        s[1], u[1], -fnorm[1], 0,
        s[2], u[2], -fnorm[2], 0,
        tx, ty, tz, 1
    ];
};

WebGLBasic.makePerspective = function (fovy, aspect, zNear, zFar) {
    var f;

    f = 1.0 / Math.tan(fovy / 2.0);

    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (zFar + zNear) / (zNear - zFar), -1,
        0, 0, (2 * zFar * zNear) / (zNear - zFar), 0
    ];
};

WebGLBasic.createInterpreter = function (gl) {
    var interpreter;

    interpreter = {};

    interpreter.interpret = function (command) {
        return interpreter[command[0]](command[1]);
    };

    interpreter.setFramebuffer = function (fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    };

    interpreter.clearColor = function (color) {
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };

    interpreter.clearDepth = function (depth) {
        gl.clearDepth(depth);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    };

    interpreter.clearStencil = function (stencil) {
        gl.clearStencil(stencil);
        gl.clear(gl.STENCIL_BUFFER_BIT);
    };

    interpreter.setPipelineState = function (pso) {
        gl.useProgram(pso.program);

        // Set rasterizer state
        (function () {
            var rs = pso.rasterizerState;

            if (rs.cullEnable) {
                gl.enable(gl.CULL_FACE);
            } else {
                gl.disable(gl.CULL_FACE);
            }

            gl.cullFace(rs.cullMode);
        }());

        // Set depth stencil state
        (function () {
            var dss = pso.depthStencilState;

            if (dss.depthEnable) {
                gl.enable(gl.DEPTH_TEST);
            } else {
                gl.disable(gl.DEPTH_TEST);
            }

            gl.depthFunc(dss.depthFunc);
            gl.depthMask(dss.depthMask);

            if (dss.stencilEnable) {
                gl.enable(gl.STENCIL_TEST);
            } else {
                gl.disable(gl.STENCIL_TEST);
            }

            gl.stencilMask(dss.stencilWriteMask);
            gl.stencilFuncSeparate(gl.FRONT, dss.frontFace.stencilFunc, dss.frontFace.stencilRef, dss.frontFace.stencilReadMask);
            gl.stencilFuncSeparate(gl.BACK, dss.backFace.stencilFunc, dss.backFace.stencilRef, dss.backFace.stencilReadMask);
            gl.stencilOpSeparate(gl.FRONT, dss.frontFace.stencilFailOp, dss.frontFace.stencilDepthFailOp, dss.frontFace.stencilPassOp);
            gl.stencilOpSeparate(gl.BACK, dss.backFace.stencilFailOp, dss.backFace.stencilDepthFailOp, dss.backFace.stencilPassOp);
        }());

        // Set blend state
        (function () {
            pso.blendState.renderTargetBlendStates.forEach(function (renderTargetBlendState, renderTargetIndex) {
                var writeMask = renderTargetBlendState.renderTargetWriteMask;
                gl.colorMask(writeMask[0], writeMask[1], writeMask[2], writeMask[3]);
            });
        }());

        interpreter.pso = pso;
    };

    interpreter.setRootUniforms = function (rootUniforms) {
        Object.keys(rootUniforms).forEach(function (rootParameterSlot) {
            var uniformInfo, uniformLocation, uniformValue;

            uniformInfo = interpreter.pso.rootParameterSlotToUniform[rootParameterSlot];
            uniformLocation = uniformInfo.location;
            uniformValue = rootUniforms[rootParameterSlot];

            switch (uniformInfo.type) {
            case gl.FLOAT:
                if (typeof(uniformValue) === 'number') {
                    gl.uniform1f(uniformLocation, uniformValue);
                } else {
                    gl.uniform1fv(uniformLocation, uniformValue);
                }
                break;
            case gl.FLOAT_VEC2:
                gl.uniform2fv(uniformLocation, uniformValue);
                break;
            case gl.FLOAT_VEC3:
                gl.uniform3fv(uniformLocation, uniformValue);
                break;
            case gl.FLOAT_VEC4:
                gl.uniform4fv(uniformLocation, uniformValue);
                break;
            case gl.FLOAT_MAT2:
                gl.uniformMatrix2fv(uniformLocation, false, uniformValue);
                break;
            case gl.FLOAT_MAT3:
                gl.uniformMatrix3fv(uniformLocation, false, uniformValue);
                break;
            case gl.FLOAT_MAT4:
                gl.uniformMatrix4fv(uniformLocation, false, uniformValue);
                break;
            case gl.INT:
                if (typeof(uniformValue) === 'number') {
                    gl.uniform1i(uniformLocation, uniformValue);
                } else {
                    gl.uniform1iv(uniformLocation, uniformValue);
                }
                break;
            case gl.INT_VEC2:
                gl.uniform2iv(uniformLocation, uniformValue);
                break;
            case gl.INT_VEC3:
                gl.uniform3iv(uniformLocation, uniformValue);
                break;
            case gl.INT_VEC4:
                gl.uniform4iv(uniformLocation, uniformValue);
                break;
            case gl.BOOL:
                if (typeof(uniformValue) === 'boolean' || typeof(uniformValue) === 'number') {
                    gl.uniform1i(uniformLocation, uniformValue);
                } else {
                    gl.uniform1iv(uniformLocation, uniformValue);
                }
                break;
            case gl.BOOL_VEC2:
                gl.uniform2iv(uniformLocation, uniformValue);
                break;
            case gl.BOOL_VEC3:
                gl.uniform3iv(uniformLocation, uniformValue);
                break;
            case gl.BOOL_VEC4:
                gl.uniform4iv(uniformLocation, uniformValue);
                break;
            case gl.SAMPLER_2D:
                gl.uniform1i(uniformLocation, uniformValue);
                break;
            case gl.SAMPLER_CUBE:
                gl.uniform1i(uniformLocation, uniformValue);
                break;
            default:
                throw "Unhandled uniform type: " + uniformInfo.type;
            }
        });
    };

    interpreter.setActiveTextures = function (activeTextures) {
        activeTextures.forEach(function (textureInfo) {
            gl.activeTexture(gl.TEXTURE0 + textureInfo.textureImageUnit);
            gl.bindTexture(textureInfo.target, textureInfo.texture);
            if (textureInfo.sampler) {
                gl.texParameteri(textureInfo.target, gl.TEXTURE_MIN_FILTER, textureInfo.sampler.minFilter);
                gl.texParameteri(textureInfo.target, gl.TEXTURE_MAG_FILTER, textureInfo.sampler.magFilter);
                gl.texParameteri(textureInfo.target, gl.TEXTURE_WRAP_S, textureInfo.sampler.wrapS);
                gl.texParameteri(textureInfo.target, gl.TEXTURE_WRAP_T, textureInfo.sampler.wrapT);
            }
        });
    };

    interpreter.drawNodes = function (nodeList) {
        nodeList.forEach(function (node) {
            Object.keys(interpreter.pso.attributes).forEach(function (attributeName) {
                var attribInfo, inputLayoutAttrib, vbv;

                attribInfo = interpreter.pso.attributes[attributeName];
                inputLayoutAttrib = interpreter.pso.inputLayout[attributeName];
                if (inputLayoutAttrib) {
                    vbv = node.vertexBufferSlots[inputLayoutAttrib.inputSlot];
                    gl.bindBuffer(gl.ARRAY_BUFFER, vbv.buffer);
                    gl.vertexAttribPointer(
                        attribInfo.location,
                        inputLayoutAttrib.size,
                        inputLayoutAttrib.type,
                        inputLayoutAttrib.normalized,
                        inputLayoutAttrib.stride,
                        inputLayoutAttrib.offset
                    );
                    gl.enableVertexAttribArray(attribInfo.location);
                } else {
                    gl.disableVertexAttribArray(attribInfo.location);
                }
            });

            if (node.indexBufferSlot) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, node.indexBufferSlot.buffer);
            }

            if (node.drawArgs) {
                gl.drawArrays(
                    node.drawArgs.primitiveTopology,
                    node.drawArgs.startVertexLocation,
                    node.drawArgs.vertexCountPerInstance
                );
            }

            if (node.drawIndexedArgs) {
                gl.drawElements(
                    node.drawIndexedArgs.primitiveTopology,
                    node.drawIndexedArgs.indexCountPerInstance,
                    node.indexBufferSlot.type,
                    node.indexBufferSlot.offset
                );
            }
        });
    };

    return interpreter;
};

WebGLBasic.interpretPasses = function (interpreter, passes) {
    passes.forEach(function (pass) {
        pass.commandList.forEach(function (cmd) {
            interpreter.interpret(cmd);
        });
    });
};