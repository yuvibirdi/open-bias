# OpenBias

OpenBias is a comprehensive news bias analysis platform inspired by Ground News. It intelligently aggregates articles from 40+ diverse news sources, performs AI-powered bias analysis, and presents multi-perspective coverage through a modern web interface. The system helps users discover news blindspots and understand media coverage patterns across the political spectrum.

## Key Features

- **`AI-Powered Bias Analysis`**: Multiple AI provider support for automated bias detection and sentiment analysis
- **`Multi-Perspective Coverage`**: Track left/center/right source distribution with visual bias indicators
- **`Blindspot Detection`**: Automated alerts for missing political perspectives in your news consumption
- **`Advanced Story Grouping`**: Multi-algorithm similarity matching using TF-IDF, Levenshtein distance, and semantic analysis
- **`40+ News Sources`**: Continuous ingestion from diverse outlets across the political spectrum
- **`User Authentication`**: Personalized experiences with JWT-based security
- **`Modern UI`**: Responsive Vue.js interface with real-time updates and CoreUI components
- **`Real-time Processing`**: Optimized pipeline with configurable development limits

## Architecture

OpenBias follows a microservices architecture with separate workers for ingestion, analysis, and presentation:

```mermaid
graph TD
    subgraph "External Sources"
        RSS[40+ RSS Feeds<br/>Left/Center/Right Sources]
    end

    subgraph "Backend Services"
        IW[ingest-worker<br/>RSS Monitoring & Story Grouping]
        EW[enrich-worker<br/>AI Bias Analysis & Indexing]
        API[api<br/>REST Endpoints & Auth]
    end

    subgraph "Data Layer"
        MySQL[(MySQL<br/>Articles & Stories)]
        ES[(Elasticsearch<br/>Search & Analytics)]
    end

    subgraph "Frontend"
        UI[admin-ui<br/>Vue.js Dashboard]
    end

    RSS --> IW
    IW --> MySQL
    EW --> MySQL
    EW --> ES
    API --> MySQL
    API --> ES
    UI --> API

    User[ Users] --> UI
```

### Core Components

- **`ingest-worker`**: Monitors 40+ RSS feeds, performs intelligent story grouping with quality controls, and maintains source diversity
- **`enrich-worker`**: AI-powered bias analysis using multiple providers, sentiment detection, and Elasticsearch indexing
- **`api`**: Hono-based REST API with JWT authentication, story endpoints, and user management
- **`admin-ui`**: Vue 3 dashboard with real-time story feed, bias visualization, and user authentication
- **`db`**: MySQL for persistent storage, Elasticsearch for advanced search and analytics

## Packages

The monorepo contains these interconnected packages:

- **`packages/admin-ui`**: Vue 3 + TypeScript dashboard with CoreUI components and real-time story feeds
- **`packages/api`**: Hono-based REST API with JWT authentication and bias analysis endpoints
- **`packages/db`**: Drizzle ORM schema with MySQL database and source management
- **`packages/ingest-worker`**: RSS monitoring with intelligent story grouping and management CLI
- **`packages/enrich-worker`**: AI bias analysis pipeline with Elasticsearch indexing
- **`packages/common`**: Shared TypeScript utilities and image services

## 🛠️ Management Commands

```bash
# Database Management
bun db:setup          # Complete setup: start services, migrate, seed, ingest, and analyze
bun db:update          # Fetch new articles and run bias analysis
bun db:update-force    # Clean old articles, fetch new ones, and run analysis
bun db:delete          # Stop services and delete all data

# Ingest Worker Management
cd packages/ingest-worker
bun ingest-manager.ts seed-sources  # Seed 40+ news sources
bun ingest-manager.ts ingest        # Fetch articles from RSS feeds
bun ingest-manager.ts enrich        # Run article grouping and analysis
bun ingest-manager.ts schedule      # Automated ingestion (60min intervals)
bun ingest-manager.ts status        # System health check
bun ingest-manager.ts cleanup       # Clean unhealthy article groups

# Development utilities
bun --filter '*' run dev             # Run all services in development mode
bun --filter '*' run build           # Build all packages
```

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) - For MySQL and Elasticsearch

### 1. Setup

```bash
# Clone repository
git clone https://github.com/yuvibirdi/open-bias
cd open-bias

# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys and database settings
```

### 2. Initialize Database

```bash
# Complete database setup with sources and sample data
bun db:setup
```

### 3. Development Workflow

```bash
# Run all services (recommended for development)
bun --filter '*' run dev

# Or run individual services:
bun --filter @open-bias/api run dev          # Backend API
bun --filter @open-bias/admin-ui run dev     # Frontend UI
bun --filter @open-bias/ingest-worker run dev # RSS ingestion
bun --filter @open-bias/enrich-worker run dev # AI analysis
```

The application will be available at `http://localhost:5173`

### 4. Development Configuration

For faster development, edit processing limits in `packages/enrich-worker/src/index.ts`:

```typescript
const DEV_ARTICLE_LIMIT: number = 20;     // Articles to process (20 = quick testing)
const DEV_GROUP_ANALYSIS_LIMIT: number = 5; // Groups to analyze (5 = quick testing)
```

**Tip**: Use `-1` for both values in production to process all content.

## 🤖 AI-Powered Bias Analysis

OpenBias uses advanced algorithms to detect bias patterns and ensure comprehensive coverage:

### Story Grouping Algorithm
- **Multi-technique Similarity**: TF-IDF, Levenshtein distance, and semantic analysis
- **Quality Controls**: 0.7 combined similarity threshold with source diversity enforcement
- **Time-bound Grouping**: 24-hour window for article clustering
- **Size Limits**: Maximum 15 articles per group to prevent mega-groups

### Bias Detection Features
- **Multiple AI Providers**: OpenAI, Google Gemini, and Anthropic Claude support
- **Coverage Tracking**: Left/center/right source distribution monitoring
- **Blindspot Detection**: Automated alerts for missing perspectives
- **Sentiment Analysis**: Emotional tone and sensationalism scoring

## News Sources (40+ Outlets)

OpenBias monitors a carefully curated selection of news sources across the political spectrum:

### Source Distribution
- **Center/Neutral (16)**: Associated Press, Reuters, BBC, Wall Street Journal, USA Today, CBS, ABC, NBC, Financial Times, Bloomberg, Christian Science Monitor, Al Jazeera, Times (UK), Deutsche Welle, France 24
- **Left-leaning (14)**: New York Times, Washington Post, CNN, NPR, The Guardian, The Atlantic, New Yorker, Huffington Post, MSNBC, Vox, Mother Jones, The Nation, Slate, The Independent  
- **Right-leaning (13)**: Fox News, New York Post, Washington Examiner, The Federalist, National Review, The American Conservative, Breitbart, Washington Times, Daily Wire, Telegraph

### Quality Controls
- Automated bias classification with validation
- Feed availability monitoring and health checks
- Content quality filtering and duplicate detection
- Source diversity enforcement in story grouping

## Current Status & Roadmap

### Completed Features
- Multi-source story aggregation with quality controls
- AI-powered bias analysis and sentiment detection  
- Real-time coverage tracking and blindspot detection
- User authentication with JWT security
- Modern responsive Vue.js interface
- Advanced search and filtering capabilities
- Optimized pipeline with configurable development limits

### Future Enhancements
- Real-time WebSocket updates for live story feeds
- Enhanced ML models beyond OpenAI for bias detection
- Social features: user comments and discussions
- Email notifications for critical blindspots
- Mobile app development
- Advanced analytics dashboard
- International news source expansion

## Contributing

OpenBias is open source and welcomes contributions! The codebase uses TypeScript throughout with comprehensive type safety, modern tooling, and a clean monorepo structure.

## License

MIT License - see LICENSE file for details.

---
**OpenBias**: Your open-source alternative to Ground News for comprehensive news bias analysis and multi-perspective coverage tracking.
