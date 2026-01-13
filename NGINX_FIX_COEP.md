# Fix for COEP Error: ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep

## Problem
The error `ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep` occurs when:
1. The browser tries to load images from S3 directly (even though proxy should be used)
2. The `Cross-Origin-Embedder-Policy` header is set to `require-corp` or similar
3. The S3 response doesn't have the required CORP headers

## Solution

### 1. Update your `/v2/` location block

Change the COEP header from `require-corp` to `unsafe-none`:

```nginx
location /v2/ {
    alias /var/www/v2/;
    index index.html;
    try_files $uri $uri/ /v2/index.html;

    # Security headers (RELAXED for image loading)
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "unsafe-none" always;  # CHANGED: was "require-corp"
    add_header Cross-Origin-Resource-Policy "cross-origin" always;  # CHANGED: was "same-origin"
    add_header X-Content-Type-Options "nosniff" always;
}
```

### 2. Add the image proxy location with explicit COEP override

```nginx
location /api/camerapics-s3-test/proxy/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # CRITICAL: Don't buffer images
    proxy_buffering off;
    proxy_request_buffering off;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # CRITICAL: Explicitly override COEP to allow images
    add_header 'Cross-Origin-Embedder-Policy' 'unsafe-none' always;
    
    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    add_header 'Cross-Origin-Resource-Policy' 'cross-origin' always;

    # Cache
    proxy_cache_valid 200 1h;
    add_header Cache-Control "public, max-age=3600";

    # Preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
        add_header 'Cross-Origin-Embedder-Policy' 'unsafe-none';
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }
}
```

### 3. Verify the frontend is using proxy URLs

Make sure your Angular app is built with the latest code that uses `getProxiedImageUrl()`. 

Check the browser Network tab - image requests should go to:
- ✅ `https://lsl-platform.com/api/camerapics-s3-test/proxy/...`
- ❌ NOT `https://s3.ap-southeast-1.idrivee2.com/...`

### 4. Clear browser cache

After updating nginx, clear your browser cache or do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R).

## Why This Works

1. **COEP "unsafe-none"**: Allows loading cross-origin resources without requiring CORP headers
2. **CORP "cross-origin"**: Explicitly allows the resource to be loaded cross-origin
3. **Proxy endpoint**: Images are served from the same origin (your server), avoiding COEP restrictions

## Testing

After applying changes:

1. Test nginx config: `sudo nginx -t`
2. Reload nginx: `sudo systemctl reload nginx`
3. Hard refresh browser: Ctrl+Shift+R
4. Check Network tab - images should load from `/api/camerapics-s3-test/proxy/`
5. Verify no COEP errors in console

## If Still Not Working

1. **Check if old code is cached**: Rebuild Angular app and clear CDN/browser cache
2. **Verify proxy is working**: 
   ```bash
   curl -I https://lsl-platform.com/api/camerapics-s3-test/proxy/amana/dsv/camera1/20251230021102
   ```
   Should return 200 with CORS headers
3. **Check nginx error logs**: `sudo tail -f /var/log/nginx/error.log`
4. **Verify backend proxy endpoint**: Check that `/api/camerapics-s3-test/proxy/` route exists and works

