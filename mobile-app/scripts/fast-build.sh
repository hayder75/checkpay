#!/bin/bash
# Fast build script - optimizes Gradle for faster builds

echo "🚀 Optimizing for fast build..."

# Stop all Gradle daemons
cd android && ./gradlew --stop
cd ..

# Clean build cache (optional - only if you want a completely fresh build)
# rm -rf android/.gradle android/app/build android/build

# Clean node cache
rm -rf node_modules/.cache

echo "✅ Ready for fast build!"
echo ""
echo "Now run: npm run android"
echo ""
echo "First build will still be slow (downloading dependencies),"
echo "but subsequent builds will be much faster!"













