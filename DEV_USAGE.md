# Development Usage Guide
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