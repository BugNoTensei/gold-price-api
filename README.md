# Gold API Backend

Standalone Express backend for gold price scraping with automatic scheduler.

## Features

- Express server (no Vercel dependencies)
- Retry logic with exponential backoff
- Optimized headers for web scraping
- Automatic price sync via node-cron
- Supabase integration

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and set your values:

```bash
cp .env.example .env
```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service key
- `CRON_SCHEDULE` - Cron expression (default: every 15 minutes)

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

- `GET /api/scrape` - Manually trigger price sync
- `GET /health` - Health check

## Deployment

### Linux/VPS

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install
git clone <repo>
cd gold-api
npm install

# Create .env
cp .env.example .env
# Edit .env with your values

# Run with PM2 for persistence
npm install -g pm2
pm2 start index.js --name gold-api
pm2 startup
pm2 save
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install --production
CMD ["npm", "start"]
```

### Cron Schedule

Default: Every 15 minutes (`*/15 * * * *`)

Change via `CRON_SCHEDULE` env variable:

- `0 * * * *` - Every hour
- `0 9-17 * * *` - Hourly 9 AM to 5 PM
- `*/5 * * * *` - Every 5 minutes

## License

ISC
