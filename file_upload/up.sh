#!/bin/bash

./encrypt/encrypt $1 "$1.e"
./upload "$1.e" http://localhost:3000/upload
rm $1.e
