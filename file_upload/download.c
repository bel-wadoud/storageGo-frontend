#include "lib.h"

extern CURLcode result;

int main(int argc, char **argv) {
	if(argc < 3) {
		perror("ERROR WRONG USAGE\n");
		puts("Use: 'download <filename> <url>");
		exit(-1);
	}
	result = curl_global_init(CURL_GLOBAL_ALL);
	if(result != CURLE_OK)
		return (int)result;

	download(argv[1], argv[2]);

	curl_global_cleanup();

	return (int)result;
}
