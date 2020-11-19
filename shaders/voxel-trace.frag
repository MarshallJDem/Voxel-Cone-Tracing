#version 400 core

// Interpolated values from the vertex shaders
in vec2 UV;
in vec3 Position_world;
in vec3 Normal_world;
in vec3 Tangent_world;
in vec3 Bitangent_world;
in vec3 EyeDirection_world;
in vec4 Position_depth; // Position from the shadow map point of view

out vec4 color;


// Textures
uniform sampler2D DiffuseTexture;
uniform sampler2D SpecularTexture;
uniform sampler2D MaskTexture;
uniform sampler2D HeightTexture;
uniform vec2 HeightTextureSize;

// Material properties
uniform float Shininess;
uniform float Opacity;

// Shadow map
uniform sampler2DShadow ShadowMap;

// Voxel stuff
uniform sampler3D VoxelTexture;
uniform float VoxelGridWorldSize;
uniform int VoxelDimensions;

// Toggle "booleans"
uniform float ShowDiffuse;
uniform float ShowIndirectDiffuse;
uniform float ShowIndirectSpecular;
uniform float ShowAmbientOcculision;

uniform vec3 LightDirection;

//cone tracing constants
const float MAX_DIST = 100.0;
const float ALPHA_THRESH = 1.0f;
const float MAX_MIP_LEVEL = 100.0f;

// 6 60 degree cone
const int NUM_CONES = 6;
vec3 coneDirections[6] = vec3[]
(                            vec3(0, 1, 0),
                            vec3(0, 0.5, 0.866025),
                            vec3(0.823639, 0.5, 0.267617),
                            vec3(0.509037, 0.5, -0.700629),
                            vec3(-0.509037, 0.5, -0.700629),
                            vec3(-0.823639, 0.5, 0.267617)
                            );
float coneWeights[6] = float[](0.25, 0.15, 0.15, 0.15, 0.15, 0.15);

mat3 tangentToWorld;

vec4 SampleVoxelTexutre(vec3 worldPosition, float mipLevel) 
{
    vec3 offset = vec3(1.0 / VoxelDimensions, 1.0 / VoxelDimensions, 0);
    vec3 voxelTextureUV = worldPosition / (VoxelGridWorldSize * 0.5);
    voxelTextureUV = voxelTextureUV * 0.5 + 0.5 + offset;
    return textureLod(VoxelTexture, voxelTextureUV, mipLevel);
}

vec4 ConeTrace(vec3 direction, float TanHalf, out float occlusion) 
{
    // level 0 mipmap is full size, level 1 is half that size and so on
    float mipLevel = 0.0f;

	//output definitions
	vec4 outputColor = vec4(0.0f);
	float alpha = 0.0f;
    occlusion = 0.0f;

	float voxelWorldSize = VoxelGridWorldSize / VoxelDimensions;
	float voxelSteps = 1.0f / voxelWorldSize;

	//skip one voxel in front to avoid computing (self emission and direct illumination on object twice)
    float distance = voxelWorldSize; 
    vec3 start = Position_world + Normal_world * distance; 

    while(alpha < ALPHA_THRESH) 
	{
		//compute cone diameter
        float diameter = max(voxelWorldSize, 2 * TanHalf * distance);//scale by voxel size at certain step

		//compute mip_level by converting to mip map lvel or lod
        //exmaple
		//log2(1/x * x) = 0
		//log2(1/(x/2) * x) = 1
		//log2(1/(x/4) * x) = 2
		float mipLevel = log2(diameter * voxelSteps);

		if(mipLevel > MAX_MIP_LEVEL)
			break;

		//sample the voxel texture at mipLevel
		//vec3 samplePosition = start + distance * direction;
        vec4 smapledColor = SampleVoxelTexutre(start + distance * direction, mipLevel);

        //blend equation
		float oneMinusAlpha = (1.0 - alpha); 
		outputColor = vec4(outputColor.xyz + (oneMinusAlpha * smapledColor.rgb), outputColor.w + (oneMinusAlpha * smapledColor.a));
		alpha = outputColor.w;
		
		//update occlusin and sample distance
		occlusion += oneMinusAlpha * smapledColor.a;
        distance += diameter;
    }
	return outputColor;
}

vec4 indirectLight(out float occlusion_out) 
{
    vec4 color = vec4(0);
    occlusion_out = 0.0;

    for(int i = 0; i < NUM_CONES; i++) 
	{
        float occlusion = 0.0;
        // 60 degree cones -> tan(30) = 0.577
        // 90 degree cones -> tan(45) = 1.0
        color += coneWeights[i] * ConeTrace(tangentToWorld * coneDirections[i], 0.577, occlusion);
        occlusion_out += coneWeights[i] * occlusion;
    }

    occlusion_out = 1.0 - occlusion_out;

    return color;
}

vec3 calcBumpNormal() {
    // Calculate gradients
    vec2 offset = vec2(1.0) / HeightTextureSize;
    float curr = texture(HeightTexture, UV).r;
    float diffX = texture(HeightTexture, UV + vec2(offset.x, 0.0)).r - curr;
    float diffY = texture(HeightTexture, UV + vec2(0.0, offset.y)).r - curr;

    // Tangent space bump normal
    float bumpMult = -3.0;
    vec3 bumpNormal_tangent = normalize(vec3(bumpMult*diffX, 1.0, bumpMult*diffY));

    return normalize(tangentToWorld * bumpNormal_tangent);
}


float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    const float PI = 3.14159265359;
    float a      = roughness*roughness;
    float a2     = a*a;
    float NdotH  = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2  = GeometrySchlickGGX(NdotV, roughness);
    float ggx1  = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

vec3 BRDF(vec3 L, vec3 N, vec3 V, vec3 ka, vec4 ks)
{
    // common variables
    vec3 H = normalize(V + L);

    // compute dot procuts
    float dotNL = max(dot(N, L), 0.0f);
    float dotNH = max(dot(N, H), 0.0f);
    float dotLH = max(dot(L, H), 0.0f);

    // emulate fresnel effect
    vec3 F0 = vec3(0.04);
    vec3 fresnel = F0 + (1.0f - F0) * pow(1.0f - dotLH, 5.0f);

    // decode specular power
    float spec = exp2(11.0f * ks.a + 1.0f);
    
    // specular factor
    float blinnPhong = pow(dotNH, spec);

    // energy conservation, aprox normalization factor
    blinnPhong *= spec * 0.0397f + 0.3183f;

    // specular term
    float lightSpecular = 1.0f;
    vec3 specular = ks.rgb * lightSpecular * blinnPhong * fresnel;

    // diffuse term
    float lightDiffuse = 1.0f;
    vec3 diffuse = ka.rgb * lightDiffuse;

    // return composition
    return (diffuse + specular) * dotNL;
}

vec4 CalculateIndirectLighting(vec3 V, vec3 N, vec3 albedo, vec4 specular, bool ambientOcclusion)
{
    vec4 specularTrace = vec4(0.0f);
    vec4 diffuseTrace = vec4(0.0f);
    vec3 coneDirection = vec3(0.0f);

    // component greater than zero
    if(any(greaterThan(specular.rgb, specularTrace.rgb)))
    {
        //vec3 viewDirection = normalize(cameraPosition - position);
        vec3 coneDirection = normalize(reflect(-V, N));
  
        const float PI = 3.14159265f;
        const float HALF_PI = 1.57079f;

        // specular cone setup, minimum of 1 grad, fewer can severly slow down performance
        float aperture = clamp(tan(HALF_PI * (1.0f - specular.a)), 0.0174533f, PI);
        //specularTrace = TraceCone(position, N, coneDirection, aperture, false);

        vec3 reflectDir = normalize(-V - 2.0 * dot(-V, N) * N);
        float specularOcclusion;
        vec4 tracedSpecular = ConeTrace(reflectDir, aperture, specularOcclusion); // 0.2 = 22.6 degrees, 0.1 = 11.4 degrees, 0.07 = 8 degrees angle
        specularTrace = ConeTrace(reflectDir, 0.07, specularOcclusion);
        specularTrace.rgb *= specular.rgb;
    }

    // component greater than zero
    if(any(greaterThan(albedo, diffuseTrace.rgb)))
    {
        // diffuse cone setup
        const float aperture = 0.57735f;
        vec3 guide = vec3(0.0f, 1.0f, 0.0f);

        if (abs(dot(N,guide)) == 1.0f)
        {
            guide = vec3(0.0f, 0.0f, 1.0f);
        }

        // Find a tangent and a bitangent
        vec3 right = normalize(guide - dot(N, guide) * N);
        vec3 up = cross(right, N);

        for(int i = 0; i < 6; i++)
        {
            coneDirection = N;
            coneDirection += coneDirections[i].x * right + coneDirections[i].z * up;
            coneDirection = normalize(coneDirection);
            // cumulative result
            float specularOcclusion;
            vec4 tracedSpecular = ConeTrace(coneDirection, 0.07, specularOcclusion); // 0.2 = 22.6 degrees, 0.1 = 11.4 degrees, 0.07 = 8 degrees angle
            diffuseTrace += tracedSpecular * coneWeights[i];
        }

        diffuseTrace.rgb *= albedo;
    }

    float bounceStrength = 1.0f;
    vec3 result = bounceStrength * (diffuseTrace.rgb + specularTrace.rgb);
    //vec3 result = bounceStrength * (diffuseTrace.rgb + specularTrace.rgb);

    float aoAlpha = 0.01f;
    return vec4(result, ambientOcclusion ? clamp(1.0f - diffuseTrace.a + aoAlpha, 0.0f, 1.0f) : 1.0f);
}

void main() {
    vec4 materialColor = texture(DiffuseTexture, UV);
    float alpha = materialColor.a;

    if(alpha < 0.5) {
        discard;
    }
    
    tangentToWorld = inverse(transpose(mat3(Tangent_world, Normal_world, Bitangent_world)));

    // Normal, light direction and eye direction in world coordinates
    vec3 N = calcBumpNormal();
    vec3 L = LightDirection;
    vec3 E = normalize(EyeDirection_world);
    
    // Direct light
    float visibility = texture(ShadowMap, vec3(Position_depth.xy, (Position_depth.z - 0.0005)/Position_depth.w));
    vec3 directLight = ShowDiffuse > 0.5 ? 1.25f * BRDF(L, N, E, vec3(1.0), vec4(0.0)) * materialColor.rgb * visibility : vec3(0.0);	
    
    // Indirect light
    vec4 specularColor = texture(SpecularTexture, UV);
    // Some specular textures are grayscale:
    specularColor = length(specularColor.gb) > 0.0 ? specularColor : specularColor.rrra;

    vec3 indirectLight = ShowIndirectSpecular > 0.5 ? 1.25f * CalculateIndirectLighting(E, N, materialColor.rgb, specularColor, true).rgb : vec3(0.0);

    color = vec4(directLight + indirectLight, alpha);
}