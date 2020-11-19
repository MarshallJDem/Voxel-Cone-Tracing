#version 330 core

layout(location = 0) in vec3 vertex_position_modelspace;
layout(location = 1) in vec2 vertex_texture_UV;

uniform mat4 DepthModelViewProjectionMatrix;
uniform mat4 ModelMatrix;

out vertex_data {
    vec2 texture_UV;
    vec4 position_depth;
} vertex;

void main() {

    // Just initialize values from Application and prepare them to be sent over to geometry shader. Nothing special here.

    vertex.texture_UV = vertex_texture_UV;

    vertex.position_depth = DepthModelViewProjectionMatrix * vec4(vertex_position_modelspace, 1);

	vertex.position_depth.xyz = (vertex.position_depth.xyz * 0.5f) + 0.5f;

    // Transform position using Model Matrix
    gl_Position = ModelMatrix * vec4(vertex_position_modelspace,1);
}