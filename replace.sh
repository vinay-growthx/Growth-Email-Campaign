#!/bin/bash

# Get list of files to replace
files=$(grep -rl "hirequotient\|HireQuotient\|HQ-Sourcing\|hq-sourcing\|Growthx\|Growthx\|Outbound\|outbound" --include="*.js" --include="*.ejs" --include="*.json" --include="*.md" --exclude-dir=node_modules --exclude-dir=.git .)

for file in $files; do
  echo "Updating: $file"
  sed -i '' 's/hirequotient\.com/growthx.com/g' "$file"
  sed -i '' 's/hirequotient\.co/growthx.com/g' "$file"
  sed -i '' 's/HireQuotient/Growthx/g' "$file"
  sed -i '' 's/hq-sourcing/growthx-internal-tool/g' "$file"
  sed -i '' 's/HQ-Sourcing/Growthx Internal Tool/g' "$file"
  sed -i '' 's/HQ-Server::/Growthx::/g' "$file"
  sed -i '' 's/Growthx/Growthx Internal Tool/g' "$file"
  sed -i '' 's/AI Outbound/Growthx/g' "$file"
  sed -i '' 's/AI OutBound/Growthx/g' "$file"
  sed -i '' 's/advanced-outbound-ai/internal-tool/g' "$file"
  sed -i '' 's/Growthx/growthx/g' "$file"
  sed -i '' 's/growthx/growthx/g' "$file"
done

echo "All replacements completed!"
