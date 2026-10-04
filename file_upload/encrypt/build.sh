#!/bin/zsh
g++ encrypt.cpp -lssl -lcrypto -o encrypt
g++ decrypt.cpp -lssl -lcrypto -o decrypt
