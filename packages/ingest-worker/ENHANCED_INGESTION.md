# Enhanced Story Ingestion System v2.0

## Overview

This enhanced ingestion system addresses the issues with the original story matching framework:

### Problems Solved:
- ❌ **Overly loose grouping** (231 sources to one story)
- ❌ **Limited sources** (only 10 sources)
- ❌ **No automated fetching**
- ❌ **Poor story quality control**

### New Features:
- ✅ **40+ diverse news sources** across political spectrum
- ✅ **Multi-technique similarity matching** (TF-IDF + Levenshtein + Word overlap)
- ✅ **Automated scheduled fetching** every 30 minutes
- ✅ **Strict quality controls** and validation
- ✅ **Story health monitoring** and cleanup
- ✅ **Enhanced CLI management** tools

## Architecture

### Key Components:

1. **Enhanced Sources (`expandedSources.ts`)**
   - 40+ news sources covering left/center/right perspectives
   - Major outlets: NYT, WSJ, CNN, Fox News, BBC, Reuters, etc.
   - International sources: Al Jazeera, Deutsche Welle, France 24
   - Proper bias classifications based on media bias research

2. **Enhanced Ingestion (`enhanced-ingest.ts`)**
   - Multi-algorithm similarity detection
   - Stricter grouping thresholds (0.65 vs 0.3 TF-IDF)
   - Quality filtering and validation
   - Automated scheduling with graceful shutdown

3. **Management CLI (`ingest-manager.ts`)**
   - Complete system management interface
   - Health monitoring and status reporting
   - Easy deployment and maintenance

## Configuration

### Thresholds (Stricter than v1):
```typescript
TF_IDF_THRESHOLD: 0.65         // Increased from 0.3
TITLE_SIMILARITY_THRESHOLD: 0.75
COMBINED_THRESHOLD: 0.7
MAX_GROUP_SIZE: 15            // Prevent mega-groups
MIN_SUMMARY_LENGTH: 50        // Quality control
RECENT_HOURS: 24              // Reduced from 48
```

### Quality Controls:
- Minimum title/summary lengths
- Maximum group size limits
- Source diversity requirements
- Duplicate detection and prevention
- Orphaned group cleanup

## Usage

### 1. Initialize System
```bash
# Seed 40+ news sources and run first ingestion
bun ingest-manager.ts init
```

### 2. Check System Health
```bash
# View comprehensive status report
bun ingest-manager.ts status
```

### 3. Manual Ingestion
```bash
# Run single ingestion cycle
bun ingest-manager.ts ingest

# Run with verbose logging
bun ingest-manager.ts ingest --verbose
```

### 4. Automated Scheduling
```bash
# Start automated fetching every 30 minutes (default)
bun ingest-manager.ts schedule

# Custom interval (minimum 5 minutes)
bun ingest-manager.ts schedule --interval 15
```

### 5. Maintenance
```bash
# Clean up unhealthy story groups
bun ingest-manager.ts cleanup

# View current configuration
bun ingest-manager.ts config

# Seed additional sources only
bun ingest-manager.ts seed-sources
```

## Similarity Algorithm

The enhanced system uses a weighted combination of multiple techniques:

### 1. Title Similarity (40% weight)
- Levenshtein distance for character-level similarity
- Handles typos and minor variations

### 2. Word Overlap (30% weight)  
- Jaccard similarity of significant words
- Ignores common words (length < 3)

### 3. TF-IDF Cosine Similarity (30% weight)
- Semantic similarity of title + summary content
- Only applied when summaries are substantial (>50 chars)

### Combined Score
```
similarity = (title_sim * 0.4) + (word_overlap * 0.3) + (tfidf_sim * 0.3)
```

Articles are grouped only if similarity > 0.7 (vs 0.3 in v1).

## Quality Assurance

### Story Group Validation:
- **Maximum size**: 15 articles per group
- **Source diversity**: Prefers groups with multiple sources
- **Bias balance**: Tracks left/center/right representation
- **Orphan cleanup**: Removes single-article groups
- **Mega-group detection**: Identifies and flags oversized groups

### Coverage Scoring:
```
bias_score = (unique_bias_perspectives / 3) * 100
diversity_score = (unique_sources / total_articles) * 100
coverage_score = (bias_score * 0.7) + (diversity_score * 0.3)
```

### Health Monitoring:
- Real-time system status
- Coverage quality metrics
- Recent activity tracking
- Error reporting and recovery

## Expected Results

With these improvements, you should see:

1. **Realistic Story Groupings**: 3-8 articles per story instead of 231
2. **Better Source Diversity**: Stories covered by multiple perspectives
3. **Higher Quality Matches**: More semantically similar articles grouped together
4. **Automated Operation**: Continuous ingestion without manual intervention
5. **Scalable Architecture**: Handles larger volumes efficiently

## Deployment

### Development:
```bash
# Start in development with live reload
bun ingest-manager.ts schedule --interval 10
```

### Production:
```bash
# Initialize system
bun ingest-manager.ts init

# Start as daemon (with PM2 or similar)
pm2 start "bun ingest-manager.ts schedule" --name "ingest-scheduler"

# Monitor
pm2 logs ingest-scheduler
```

### Docker:
```dockerfile
FROM oven/bun:alpine
COPY . /app
WORKDIR /app
RUN bun install
CMD ["bun", "ingest-manager.ts", "schedule"]
```

## Monitoring

### Key Metrics:
- **Sources**: Total active sources (target: 40+)
- **Articles/Day**: New articles ingested (target: 100+)
- **Grouping Rate**: % of articles successfully grouped (target: 60%+)
- **Coverage Quality**: Average story coverage score (target: 70%+)
- **Source Balance**: Even distribution across bias spectrum

### Alerts:
- Ingestion failures or delays
- Coverage score drops below 60%
- Group size exceeds 20 articles
- Source imbalance detected

## Troubleshooting

### Common Issues:

1. **Too few groups forming**:
   - Lower `COMBINED_THRESHOLD` slightly (0.65 → 0.6)
   - Check if sources are providing good summaries

2. **Groups still too large**:
   - Lower `MAX_GROUP_SIZE` (15 → 10)
   - Increase `TITLE_SIMILARITY_THRESHOLD` (0.75 → 0.8)

3. **Poor coverage scores**:
   - Add more sources from underrepresented bias categories
   - Check source bias classifications

4. **Memory issues**:
   - Reduce `BATCH_SIZE` (50 → 25)
   - Increase cleanup frequency

### Debug Mode:
```bash
# Run with detailed logging
DEBUG=* bun ingest-manager.ts ingest --verbose
```

## Next Steps

1. **Monitor for 24-48 hours** to validate grouping quality
2. **Adjust thresholds** based on observed grouping patterns
3. **Add more sources** if needed for specific topics/regions
4. **Implement AI analysis** integration for bias detection
5. **Add real-time notifications** for high-impact stories
