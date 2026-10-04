#!/usr/bin/env bash

./download temp http://localhost:3000/uploaded-file
./encrypt/decrypt temp $2 "$1.key"

rm temp

