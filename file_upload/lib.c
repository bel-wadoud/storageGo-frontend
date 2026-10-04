#include "lib.h"

CURLcode result;

size_t write_cb(char *contents, size_t size, size_t nmemb, void *userp) {
	size_t realsize = size * nmemb;
	struct MemoryStruct *mem = (struct MemoryStruct *)userp;

	char *ptr = realloc(mem->memory, mem->size + realsize + 1);
	if(!ptr) {
		printf("not enough memory (realloc returned NULL)\n");
		return 0;
	}

	mem->memory = ptr;
	memcpy(&mem->memory[mem->size], contents, realsize);
	mem->size += realsize;
	mem->memory[mem->size] = 0;

	return realsize;
}

// download file at url, and save it as filename in local directory.

void download(const char* filename, const char* url) {
	struct MemoryStruct chunk;

	CURL* curl;
	chunk.memory = malloc(1);
	chunk.size = 0;

	curl = curl_easy_init();
	if(curl) {

		curl_easy_setopt(curl, CURLOPT_URL, url);

		curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);

		curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);

		curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");

		result = curl_easy_perform(curl);

		if(result != CURLE_OK) {
			fprintf(stderr, "curl_easy_perform() failed: %s\n",
					curl_easy_strerror(result));
		}
		else {
			printf("%lu bytes retrieved\n", (unsigned long)chunk.size);
			FILE *f = fopen(filename, "w");
			fwrite(chunk.memory, 1, chunk.size, f);

		}

		curl_easy_cleanup(curl);
	}

	free(chunk.memory);

}
size_t read_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
	FILE *src = userdata;
	/* copy as much data as possible into the 'ptr' buffer, but no more than
	   'size' * 'nmemb' bytes */
	size_t retcode = fread(ptr, size, nmemb, src);

	return retcode;
}

size_t getfsize(FILE *f) {
	struct stat buf;
	fstat(fileno(f), &buf);
	return buf.st_size;
}

void upload(const char* input_file, const char* url) {
	CURL *curl = curl_easy_init();
	if(curl) {
		CURLcode result;
		FILE *src = fopen(input_file, "r");
		curl_off_t fsize = getfsize(src);
		printf("%lu\n",(long)fsize);

		curl_easy_setopt(curl, CURLOPT_READFUNCTION, read_cb);

		curl_easy_setopt(curl, CURLOPT_POST, 1L);

		curl_easy_setopt(curl, CURLOPT_URL, url);

		curl_easy_setopt(curl, CURLOPT_READDATA, src);

		curl_easy_setopt(curl, CURLOPT_INFILESIZE_LARGE, (curl_off_t)fsize);

		result = curl_easy_perform(curl);
		curl_easy_cleanup(curl);
	}
}

