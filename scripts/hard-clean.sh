#!/usr/bin/env bash

set -e

echo "🧹 Cleaning NestJS project..."

echo "➡ Removing build files..."
rm -rf dist

echo "➡ Removing test coverage..."
rm -rf coverage

echo "➡ Removing logs..."
rm -rf logs
rm -rf *.log

echo "➡ Removing Nest cache..."
rm -rf .nestjs

echo "➡ Removing TypeScript cache..."
find . -name "*.tsbuildinfo" -delete

echo "➡ Removing node cache..."
rm -rf node_modules/.cache

echo "➡ Cleaning npm cache..."
npm cache clean --force

echo "➡ Removing node_modules..."
rm -rf node_modules

echo "➡ Removing lock file..."
rm -f package-lock.json

echo "➡ Reinstalling dependencies..."
npm install

echo ""
echo "✅ NestJS cleanup completed!"