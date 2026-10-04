#include "lib.h"
int main(int argc, char** argv) {

	if(argc < 3) {
		perror("Wrong usage, do : upload <filename> <url>\n");
		exit(1);
	}

	upload(argv[1], argv[2]);

	return 0;
}
