#!/usr/bin/env bash

set -e

echo "🧹 Cleaning NestJS temporary files..."

rm -rf dist
rm -rf coverage
rm -rf logs
rm -rf .nestjs

find . -name "*.tsbuildinfo" -delete

npm cache verify

echo "✅ Soft cleanup done!"