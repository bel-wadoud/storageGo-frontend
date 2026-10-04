#include <stdio.h>
#include <string.h>
#include <curl/curl.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>
#include <stdlib.h>
#include <sys/types.h>

struct MemoryStruct {
	char *memory;
	size_t size;
};

size_t write_cb(char *contents, size_t size, size_t nmemb, void *userp);
void download(const char* filename, const char* url);
size_t read_cb(char *ptr, size_t size, size_t nmemb, void *userdata);
size_t getfsize(FILE *f);
void upload(const char* input_file, const char* url);

