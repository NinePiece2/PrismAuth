# Quick Start Script

Write-Host "🚀 PrismAuth Quick Start" -ForegroundColor Cyan
Write-Host "========================`n" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env and add:" -ForegroundColor Yellow
    Write-Host "   1. PostgreSQL DATABASE_URL" -ForegroundColor Yellow
    Write-Host "   2. SESSION_SECRET (random string)" -ForegroundColor Yellow
    Write-Host "   3. JWT keys (run: bun run generate:keys)`n" -ForegroundColor Yellow
    
    $continue = Read-Host "Continue setup? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

# Generate JWT keys if not present
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "JWT_PRIVATE_KEY=`"-----BEGIN") {
    Write-Host "`n🔐 Generating JWT keys..." -ForegroundColor Cyan
    bun run generate:keys
    Write-Host "`n⚠️  Please copy the generated keys to your .env file" -ForegroundColor Yellow
    $continue = Read-Host "Press Enter when done..."
}

# Check database connection
Write-Host "`n📊 Setting up database..." -ForegroundColor Cyan
try {
    bun run db:push --accept-data-loss 2>&1 | Out-Null
    Write-Host "✓ Database schema created" -ForegroundColor Green
} catch {
    Write-Host "❌ Database connection failed. Check your DATABASE_URL in .env" -ForegroundColor Red
    exit 1
}

# Generate Prisma client
Write-Host "📦 Generating Prisma client..." -ForegroundColor Cyan
bun run db:generate | Out-Null
Write-Host "✓ Prisma client generated" -ForegroundColor Green

# Seed database
Write-Host "🌱 Seeding database..." -ForegroundColor Cyan
try {
    bun run db:seed
    Write-Host "✓ Database seeded successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database seeding failed (might already be seeded)" -ForegroundColor Yellow
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`nYou can now:" -ForegroundColor Cyan
Write-Host "  1. Start dev server: bun run dev" -ForegroundColor White
Write-Host "  2. Visit: http://localhost:3000" -ForegroundColor White
Write-Host "  3. Login with: admin@prismauth.local / admin123`n" -ForegroundColor White

$start = Read-Host "Start development server now? (y/n)"
if ($start -eq "y") {
    bun run dev
}
