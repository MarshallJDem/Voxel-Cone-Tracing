#version 430
#extension GL_ARB_shader_image_load_store : enable

// Data from geometry shader
in fData {
    vec2 UV;
    flat int axis;
    vec4 position_depth; // Position from the shadow map point of view
} frag;

// This is our voxel data structure stored in the 3D texture
uniform layout(RGBA8) image3D VoxelTexture;
uniform sampler2D DiffuseTexture;
uniform sampler2DShadow ShadowMap;
uniform int VoxelDimensions;

void main() {
	
	// We must determine the 3D voxel position of our current voxel fragment.
	// This is as simple as taking the X, Y of the frag coord since 
	// our viewport is the same dimensions as the voxel tree (except Z).
	// Our triangle is flat projected onto a major axis, and so to convert these values back
	// into 3D we need only to multiply Z by the dimension size of the voxel tree. Then we just need to make
	// sure the X Y Z are correct relative to whatever axis we were projected onto.

	// We cheat in our rasterization by just dropping float precision into an integer. 
	// More advanced algorithms exist but are not required.
	ivec3 voxel_pos = ivec3(0,0,0);
	ivec2 frag_coord = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y));
	// If we are projected down the x axis
	if(frag.axis == 1){
		voxel_pos.x = VoxelDimensions - int(gl_FragCoord.z * VoxelDimensions);
		voxel_pos.y = frag_coord.y;
		voxel_pos.z = frag_coord.x;
	}
	else if(frag.axis == 2){
		voxel_pos.x = frag_coord.x;
		voxel_pos.y =  VoxelDimensions - int(gl_FragCoord.z * VoxelDimensions);
		voxel_pos.z = frag_coord.y;
	}
	else if(frag.axis == 3){
		voxel_pos.x = frag_coord.x;
		voxel_pos.y = frag_coord.y;
		voxel_pos.z = int(gl_FragCoord.z * VoxelDimensions);
	}

	// Now we need to flip the z component to match how our 3D texture data structure is setup
	voxel_pos.z = VoxelDimensions - voxel_pos.z - 1;
	
	// Read in our diffuse texture value
    vec4 materialColor = texture(DiffuseTexture, frag.UV);

    // Use the shadow map we calculated a while ago to calculate the visibility for this voxel
    float visibility = texture(ShadowMap, vec3(frag.position_depth.xy, (frag.position_depth.z - 0.001)/frag.position_depth.w));

	// Overwrite the value in this voxel. This again is a hacky solution because multiple triangles may intersect this voxel.
	// However since we are just voxelizing once at the beginning of the scene this really isnt an issue.
	// There is a suggested solution using atomic operations if you need to dynamically voxelize (for animated objects)
    
	imageStore(VoxelTexture, voxel_pos, vec4(materialColor.rgb * visibility, 1.0));
}