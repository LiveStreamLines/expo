# Nginx Configuration Update Guide

## Problem
Your current `/v2/` configuration has security headers that block cross-origin images:
- `Cross-Origin-Embedder-Policy "require-corp"` - Requires CORP headers on all resources
- `Cross-Origin-Resource-Policy "same-origin"` - Blocks cross-origin resources

These headers prevent images from S3 (via the proxy) from loading.

## Solution

### Option 1: Update Security Headers (Recommended for Images)

Replace your current `/v2/` location block with:

```nginx
location /v2/ {
    alias /var/www/v2/;
    index index.html;
    try_files $uri $uri/ /v2/index.html;

    # Security headers (relaxed for image loading)
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    # Changed from "require-corp" to allow images
    add_header Cross-Origin-Embedder-Policy "unsafe-none" always;
    # Changed from "same-origin" to allow images
    add_header Cross-Origin-Resource-Policy "cross-origin" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option 2: Keep Strict Headers, Exclude Images

If you need to keep strict security headers, you can exclude the image proxy:

```nginx
location /v2/ {
    alias /var/www/v2/;
    index index.html;
    try_files $uri $uri/ /v2/index.html;

    # Security headers (keep strict)
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    add_header X-Content-Type-Options "nosniff" always;
}

# Exclude image proxy from strict headers
location /api/camerapics-s3-test/proxy/ {
    # ... (use the image proxy config from nginx-v2-config-updated.conf)
    # This location block will override the strict headers for images only
}
```

## Required Additions

Add these location blocks to your nginx configuration:

### 1. API Proxy (add before /v2/ location)

```nginx
location /api/ {
    proxy_pass http://localhost:5000;  # Your backend port
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;

    # Handle preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }
}
```

### 2. Image Proxy (CRITICAL - add this)

```nginx
location /api/camerapics-s3-test/proxy/ {
    proxy_pass http://localhost:5000;  # Your backend port
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # CRITICAL: Don't buffer images
    proxy_buffering off;
    proxy_request_buffering off;

    # Timeouts for large images
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # CORS headers for images
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    add_header 'Cross-Origin-Resource-Policy' 'cross-origin' always;

    # Cache images
    proxy_cache_valid 200 1h;
    add_header Cache-Control "public, max-age=3600";

    # Handle preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }
}
```

## Important Notes

1. **Order Matters**: The `/api/camerapics-s3-test/proxy/` location should be more specific and will match before the general `/api/` location.

2. **Backend Port**: Update `http://localhost:5000` to match your actual backend server address and port.

3. **Security Trade-off**: 
   - Option 1: Relaxes security headers to allow images (recommended for image-heavy apps)
   - Option 2: Keeps strict headers but makes exception for images only

4. **Testing**: After updating, test with:
   ```bash
   curl -I https://lsl-platform.com/api/camerapics-s3-test/proxy/{developerTag}/{projectTag}/{cameraTag}/{timestamp}
   ```
   You should see CORS headers in the response.

## Apply Changes

1. Edit your nginx config file (usually `/etc/nginx/sites-available/your-site`)
2. Add the location blocks above
3. Test configuration: `sudo nginx -t`
4. Reload nginx: `sudo systemctl reload nginx`

