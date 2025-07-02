# Development Usage Guide

## Magic Numbers for Development Limits

To speed up development when you don't have GPU compute, you can control processing limits by editing **ONE FILE**: `packages/enrich-worker/src/index.ts`

```typescript
// 🔧 DEVELOPMENT MAGIC NUMBERS - Control processing limits during development
const DEV_ARTICLE_LIMIT: number = 20; // Total articles to process
const DEV_GROUP_ANALYSIS_LIMIT: number = 5; // Groups to analyze per run
```

### Recommended Values:

**For Articles (`DEV_ARTICLE_LIMIT`):**
- **20** - Very quick testing (fastest)
- **50** - Quick development testing
- **200** - Medium dataset for development
- **500** - Larger test set
- **-1** - Process ALL articles (production mode)

**For Groups (`DEV_GROUP_ANALYSIS_LIMIT`):**
- **3** - Very quick bias analysis testing
- **5** - Quick development testing  
- **10** - Medium testing
- **-1** - Analyze ALL groups (production mode)

## Optimized Pipeline (FIXED!)

The pipeline inefficiency has been **FIXED**! Now bias analysis happens immediately when each group is formed:

1. **NEW EFFICIENT FLOW**: Group articles → Immediately analyze each group → Index analyzed articles
2. **OLD INEFFICIENT FLOW**: ~~Group ALL articles → Analyze ALL groups → Index ALL articles~~

### Benefits of the New Pipeline:
- **Lower memory usage** - process groups one by one
- **Faster feedback** during development  
- **More resilient** - if one group fails, others continue
- **Parallel processing** of group formation + bias analysis
- **Real-time results** - see analysis results as groups are formed

## Recent Fixes

### ✅ **Fixed Database Range Error**
- **Issue**: `political_leaning` values like 10.0000 were out of database range
- **Fix**: Now properly normalized to -1.0 to +1.0 range
  - leftBias=10, rightBias=0 → +1.0 (left-leaning)
  - leftBias=0, rightBias=10 → -1.0 (right-leaning)  
  - leftBias=5, rightBias=5 → 0.0 (neutral)

### ✅ **Improved JSON Parsing**
- **Issue**: Valid JSON was failing to parse due to trailing text
- **Fix**: Better JSON extraction and cleanup logic

### ✅ **Added Group Analysis Limits**
- **Issue**: Long analysis times during development
- **Fix**: Magic number to limit groups analyzed per run

## Quick Development Workflow

1. Edit **ONE FILE**: `packages/enrich-worker/src/index.ts`
   - Set `DEV_ARTICLE_LIMIT` to a small number (e.g., 20)
   - Set `DEV_GROUP_ANALYSIS_LIMIT` to a small number (e.g., 5)  
2. Run the enrich worker: `bun run dev` or `bun run src/index.ts`
3. Check the logs for processing time and results
4. Gradually increase the limits as needed

## Future Improvements

~~The analyzer could be integrated directly into the grouper for real-time processing.~~ ✅ **DONE!**

All magic numbers are now centralized in `index.ts` for easy management.
