#include <openssl/evp.h>
#include <openssl/rand.h>
#include <fstream>
#include <array>
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

void decrypt_file(const std::string& input_path, const std::string& output_path, const unsigned char key[KEY_LEN]) {
	std::ifstream in(input_path, std::ios::binary);
	std::ofstream out(output_path, std::ios::binary);
	if (!in || !out) throw std::runtime_error("Failed to open file");
	unsigned char nonce[NONCE_LEN];
	in.read(reinterpret_cast<char*>(nonce), NONCE_LEN);
	EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
	if (!ctx) handleErrors();

	if (EVP_DecryptInit_ex(ctx, EVP_aes_256_ctr(), nullptr, key, nonce) != 1)
		handleErrors();

	std::vector<unsigned char> inbuf(CHUNK_SIZE);
	std::vector<unsigned char> outbuf(CHUNK_SIZE + EVP_MAX_BLOCK_LENGTH);
	int outlen;

	while (in.read(reinterpret_cast<char*>(inbuf.data()), CHUNK_SIZE) || in.gcount() > 0) {
		int bytesRead = static_cast<int>(in.gcount());
		if (EVP_DecryptUpdate(ctx, outbuf.data(), &outlen, inbuf.data(), bytesRead) != 1)
			handleErrors();
		out.write(reinterpret_cast<char*>(outbuf.data()), outlen);
	}

	if (EVP_DecryptFinal_ex(ctx, outbuf.data(), &outlen) != 1)
		handleErrors();
	out.write(reinterpret_cast<char*>(outbuf.data()), outlen);

	EVP_CIPHER_CTX_free(ctx);
}

std::array<unsigned char, KEY_LEN> getKey(const std::string& input_path) {
    std::ifstream in(input_path, std::ios::binary);
    if (!in) throw std::runtime_error("Failed to open key file");

    std::array<unsigned char, KEY_LEN> key;
    in.read(reinterpret_cast<char*>(key.data()), KEY_LEN);
    if (in.gcount() != KEY_LEN)
        throw std::runtime_error("Key file too short");

    return key;
}

int main(int argc, char** argv) {
    if (argc < 4) {
        std::cerr << "Usage: " << argv[0] << " <input_file> <output_file> <key_file> <nonce_file>\n";
        return 1;
    }

    try {
        auto key = getKey(argv[3]);
        decrypt_file(argv[1], argv[2], key.data());
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }

    return 0;
}
