#!/usr/bin/env bash

gcc -o download -Wextra -Wall download.c lib.c -lcurl
gcc -o upload -Wextra -Wall upload.c lib.c -lcurl
