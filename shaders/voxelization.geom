#version 330 core

#define M_PI 3.1415926535897932384626433832795

layout (triangles) in; // glDrawArrays is set to triangles so that's what we're working with
layout (triangle_strip, max_vertices = 3) out;

// Input from vertex shader, stored in an array
in vertex_data {
    vec2 texture_UV;
    vec4 position_depth;
} vert_data[];

// Data that will be sent to fragment shader
out fData {
    vec2 UV;
    flat int axis;
    vec4 position_depth;
} frag;

uniform mat4 ProjX;
uniform mat4 ProjY;
uniform mat4 ProjZ;

void main() {

    // Put each vertex into a matrix for easier reference
    mat3 verts;
    verts[0] = gl_in[0].gl_Position.xyz;
    verts[1] = gl_in[1].gl_Position.xyz;
    verts[2] = gl_in[2].gl_Position.xyz;

    // Find the normal of this triangle
    vec3 normal = cross(verts[1]-verts[0],verts[2]-verts[0]);
    normal = normalize(normal);

    // Get the dot product of (normal) * (each dominant axis) for later comparison
    // Also take the absolute value so we can compare their magnitudes
    vec3 L;
    L[0] = abs(dot(normal, vec3(1.0,0.0,0.0))); // N * X
    L[1] = abs(dot(normal, vec3(0.0,1.0,0.0))); // N * Y
    L[2] = abs(dot(normal, vec3(0.0,0.0,1.0))); // N * Z

    // Compare the values. Greatest value is the dominant axis.
    // This is because a higher dot product would mean the angles between the two vectors is lowest.
    // Whichever dominant axis the normal is closest to pointing to will be chosen for projection.
    // 1 = x axis dominant, 2 = y axis dominant, 3 = z axis dominant
    mat4 projection_matrix;
    if(L[0] >= L[1] && L[0] >= L[2]){
        frag.axis = 1;
        projection_matrix = ProjX;
    }else if(L[1] >= L[0] && L[1] >= L[2]){
        frag.axis = 2;
        projection_matrix = ProjY;
    }else{
        frag.axis = 3;
        projection_matrix = ProjZ;
    }
    
    // For every vertex, project orthographically
    for(int i = 0;i < gl_in.length(); i++) {
        frag.UV = vert_data[i].texture_UV;
        frag.position_depth = vert_data[i].position_depth;
        gl_Position = projection_matrix * gl_in[i].gl_Position;
        EmitVertex();
    }
    
    // Finished creating vertices
    EndPrimitive();
}