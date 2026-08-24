#!/usr/bin/env bash

set -e

echo "🚀 Starting NestJS fresh install..."

echo ""
echo "➡ Removing build artifacts..."
rm -rf dist
rm -rf coverage
rm -rf .nestjs

echo ""
echo "➡ Removing TypeScript cache..."
find . -name "*.tsbuildinfo" -delete

echo ""
echo "➡ Removing node_modules..."
rm -rf node_modules

echo ""
echo "➡ Cleaning npm cache..."
npm cache verify

echo ""
echo "➡ Installing dependencies from lock file..."
npm ci

echo ""
echo "➡ Generating Prisma client (if Prisma exists)..."
if [ -d "prisma" ]; then
  npx prisma generate
fi

echo ""
echo "➡ Checking environment file..."

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
  else
    echo "⚠️ No .env.example found, skipping..."
  fi
else
  echo "✅ .env already exists, skipping..."
fi

echo ""
echo "🎉 Fresh install completed!"
echo ""
echo "Next steps:"
echo "  npm run start:dev"