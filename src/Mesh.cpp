#include <iostream>

#include "Mesh.h"

Mesh::Mesh(const aiMesh* mesh) {
	hasTexCoords_ = mesh->HasTextureCoords(0);
	hasNormals_ = mesh->HasNormals();

	// std::cout << "   mNumVertices: " << mesh->mNumVertices << std::endl
	// 		  << "   mNumFaces: " << mesh->mNumFaces << std::endl << std::endl;

	std::vector<glm::vec3> vertices;
	std::vector<glm::vec2> uvs;
	std::vector<glm::vec3> normals;
	std::vector<unsigned int> indices;

	vertices.reserve(mesh->mNumVertices);
	for(unsigned int i=0; i<mesh->mNumVertices; i++) {
		aiVector3D pos = mesh->mVertices[i];
		vertices.push_back(glm::vec3(pos.x, pos.y, pos.z));
	}

	if(hasTexCoords_) {
		uvs.reserve(mesh->mNumVertices);
		for(unsigned int i=0; i<mesh->mNumVertices; i++) {
			aiVector3D uv = mesh->mTextureCoords[0][i];
			uvs.push_back(glm::vec2(uv.x, uv.y));
		}
	}

	if(hasNormals_) {
		normals.reserve(mesh->mNumVertices);
		for(unsigned int i=0; i<mesh->mNumVertices; i++) {
			aiVector3D n = mesh->mNormals[i];
			normals.push_back(glm::vec3(n.x, n.y, n.z));
		}
	}

	indices.reserve(3*mesh->mNumFaces);
	for (unsigned int i=0; i<mesh->mNumFaces; i++) {
		indices.push_back(mesh->mFaces[i].mIndices[0]);
		indices.push_back(mesh->mFaces[i].mIndices[1]);
		indices.push_back(mesh->mFaces[i].mIndices[2]);
		//std::cout << "mesh->mFaces[i].mNumIndices: " << mesh->mFaces[i].mNumIndices << std::endl;
		//std::cout << "indices: " << mesh->mFaces[i].mIndices[0] << "," << mesh->mFaces[i].mIndices[1] << "," << mesh->mFaces[i].mIndices[2] << std::endl;
	}
	
	// Create VAO
	glGenVertexArrays(1, &vertexArray_);
	glBindVertexArray(vertexArray_);

	// Load VBOs

	// Vertices
	glGenBuffers(1, &vboVertices_);
	glBindBuffer(GL_ARRAY_BUFFER, vboVertices_);
	glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(glm::vec3), &vertices[0], GL_STATIC_DRAW);

	// Texture coordinates
	if(hasTexCoords_) {
		glGenBuffers(1, &vboTexCoords_);
		glBindBuffer(GL_ARRAY_BUFFER, vboTexCoords_);
		glBufferData(GL_ARRAY_BUFFER, uvs.size() * sizeof(glm::vec2), &uvs[0], GL_STATIC_DRAW);
	}

	// Normals
	if(hasNormals_) {
		glGenBuffers(1, &vboNormals_);
		glBindBuffer(GL_ARRAY_BUFFER, vboNormals_);
		glBufferData(GL_ARRAY_BUFFER, normals.size() * sizeof(glm::vec3), &normals[0], GL_STATIC_DRAW);
	}

	// Indices
	glGenBuffers(1, &vboIndices_);
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, vboIndices_);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0] , GL_STATIC_DRAW);

	// Unbind vertex array
	glBindVertexArray(0);

	numIndices_ = 3*mesh->mNumFaces;
	materialIndex_ = mesh->mMaterialIndex;
}

Mesh::~Mesh() {

}

void Mesh::draw() {
	// glUniformMatrix4fv(MatrixID, 1, GL_FALSE, &MVP[0][0]);
	// glUniformMatrix4fv(ModelMatrixID, 1, GL_FALSE, &ModelMatrix[0][0]);
	// glUniformMatrix4fv(ViewMatrixID, 1, GL_FALSE, &ViewMatrix[0][0]);

	// std::cout << "Mesh::draw: " << std::endl <<
	// 			 "   " << "vertexArray_: " << vertexArray_ << std::endl <<
	// 			 "   " << "vboVertices_: " << vboVertices_ << std::endl <<
	// 			 "   " << "vboTexCoords_: " << vboTexCoords_ << std::endl <<
	// 			 "   " << "vboNormals_: " << vboNormals_ << std::endl <<
	// 			 "   " << "vboIndices_: " << vboIndices_ << std::endl <<
	// 			 "   " << " numIndices_: " << numIndices_ << std::endl;

	glBindVertexArray(vertexArray_);

	// 1rst attribute buffer : vertices
	glEnableVertexAttribArray(0);
	glBindBuffer(GL_ARRAY_BUFFER, vboVertices_);
	glVertexAttribPointer(
		0,                  // attribute
		3,                  // size
		GL_FLOAT,           // type
		GL_FALSE,           // normalized?
		0,                  // stride
		(void*)0            // array buffer offset
	);

	// 2nd attribute buffer : UVs
	glEnableVertexAttribArray(1);
	glBindBuffer(GL_ARRAY_BUFFER, vboTexCoords_);
	glVertexAttribPointer(
		1,                                // attribute
		2,                                // size
		GL_FLOAT,                         // type
		GL_FALSE,                         // normalized?
		0,                                // stride
		(void*)0                          // array buffer offset
	);

	// 3rd attribute buffer : normals
	glEnableVertexAttribArray(2);
	glBindBuffer(GL_ARRAY_BUFFER, vboNormals_);
	glVertexAttribPointer(
		2,                                // attribute
		3,                                // size
		GL_FLOAT,                         // type
		GL_FALSE,                         // normalized?
		0,                                // stride
		(void*)0                          // array buffer offset
	);

	// Index buffer
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, vboIndices_);

	// Draw the triangles !
	glDrawElements(
		GL_TRIANGLES,      // mode
		numIndices_,    // count
		GL_UNSIGNED_INT,   // type
		(void*)0           // element array buffer offset
	);

	glDisableVertexAttribArray(0);
	glDisableVertexAttribArray(1);
	glDisableVertexAttribArray(2);

	glBindVertexArray(0);
}