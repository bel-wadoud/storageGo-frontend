#include <openssl/evp.h>
#include <openssl/rand.h>
#include <fstream>
#include <vector>
#include <stdexcept>
#include <iostream>
#include <cstring>

constexpr size_t KEY_LEN = 32;   // AES-256
constexpr size_t NONCE_LEN = 16; // full 16-byte initial counter block for CTR
constexpr size_t CHUNK_SIZE = 64 * 1024;

void handleErrors() {
	throw std::runtime_error("OpenSSL error occurred");
}

void encrypt_file(const std::string& input_path, const std::string& output_path, const unsigned char key[KEY_LEN]) {

	std::ifstream in(input_path, std::ios::binary);
	std::ofstream out(output_path, std::ios::binary);
	if (!in || !out) throw std::runtime_error("Failed to open file");
	unsigned char nonce[NONCE_LEN];
	if (RAND_bytes(nonce, NONCE_LEN) != 1) {
		std::cerr << "Failed to generate nonce\n";
	}

	out.write(reinterpret_cast<char*>(nonce), NONCE_LEN);

	EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
	if (!ctx) handleErrors();

	if (EVP_EncryptInit_ex(ctx, EVP_aes_256_ctr(), nullptr, key, nonce) != 1)
		handleErrors();

	std::vector<unsigned char> inbuf(CHUNK_SIZE);
	std::vector<unsigned char> outbuf(CHUNK_SIZE + EVP_MAX_BLOCK_LENGTH);
	int outlen;

	while (in.read(reinterpret_cast<char*>(inbuf.data()), CHUNK_SIZE) || in.gcount() > 0) {
		int bytesRead = static_cast<int>(in.gcount());
		if (EVP_EncryptUpdate(ctx, outbuf.data(), &outlen, inbuf.data(), bytesRead) != 1)
			handleErrors();
		out.write(reinterpret_cast<char*>(outbuf.data()), outlen);
	}

	if (EVP_EncryptFinal_ex(ctx, outbuf.data(), &outlen) != 1)
		handleErrors();
	out.write(reinterpret_cast<char*>(outbuf.data()), outlen);

	EVP_CIPHER_CTX_free(ctx);
}

int main(int argc, char **argv) {
	if(argc != 3) {
		std::cerr << "Usage : ./main file_name file_name" << std::endl;
		return 1;
	}

	unsigned char key[KEY_LEN];
	std::string keyfile = std::string(argv[1]) + ".key";

	std::ifstream in(keyfile.c_str(), std::ios::binary);

	if(!in) {
		if (RAND_bytes(key, KEY_LEN) != 1) {
			std::cerr << "Failed to generate key\n";
			return 1;
		}
		std::ofstream out(keyfile.c_str(), std::ios::binary);
		out.write(reinterpret_cast<char*>(key), KEY_LEN);
		std::cout << key << std::endl;
		out.close();
	}
	else
		in.read(reinterpret_cast<char*>(key), KEY_LEN);

	try {
		encrypt_file(argv[1], argv[2], key);
	} catch (const std::exception& e) {
		std::cerr << "Error: " << e.what() << "\n";
		return 1;
	}

	return 0;
}
