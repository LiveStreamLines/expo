# Fix Missing CORS Headers in Nginx Response

## Problem
The response headers show the image is being served, but CORS headers and COEP override are missing. This means either:
1. Nginx headers aren't being added to proxied responses
2. The backend response is overriding nginx headers
3. The nginx config hasn't been reloaded

## Solution

### 1. Update Backend (Already Done)
The backend now sets COEP and CORS headers. This ensures headers are present even if nginx doesn't add them.

### 2. Ensure Nginx Headers Are Added

The issue with nginx `add_header` in proxy locations is that it only adds headers if the response code matches. Use `always` flag (which we already have), but also ensure the location block is correct.

### 3. Verify Nginx Config Location

Make sure the image proxy location block is **more specific** than `/api/` and comes **before** it in the config file:

```nginx
# This MUST come BEFORE /api/ location block
location /api/camerapics-s3-test/proxy/ {
    # ... config
}

# Then the general /api/ block
location /api/ {
    # ... config
}
```

### 4. Important Nginx Settings

In the proxy location, ensure you have:

```nginx
location /api/camerapics-s3-test/proxy/ {
    proxy_pass http://localhost:5000;
    
    # CRITICAL: Pass through headers from backend
    proxy_pass_header 'Access-Control-Allow-Origin';
    proxy_pass_header 'Cross-Origin-Embedder-Policy';
    
    # Add headers (will merge with backend headers)
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Cross-Origin-Embedder-Policy' 'unsafe-none' always;
    add_header 'Cross-Origin-Resource-Policy' 'cross-origin' always;
    
    # ... rest of config
}
```

### 5. Alternative: Use proxy_hide_header

If backend headers are conflicting, you can hide them and let nginx set them:

```nginx
location /api/camerapics-s3-test/proxy/ {
    proxy_pass http://localhost:5000;
    
    # Hide backend CORS headers (optional, if conflicting)
    # proxy_hide_header 'Access-Control-Allow-Origin';
    
    # Set our own headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Cross-Origin-Embedder-Policy' 'unsafe-none' always;
    add_header 'Cross-Origin-Resource-Policy' 'cross-origin' always;
    
    # ... rest of config
}
```

## Testing

After updating:

1. **Test nginx config**: `sudo nginx -t`
2. **Reload nginx**: `sudo systemctl reload nginx`
3. **Test the endpoint**:
   ```bash
   curl -I https://lsl-platform.com/api/camerapics-s3-test/proxy/amana/dsv/camera1/20251230021102
   ```
4. **Check for headers**:
   - `Access-Control-Allow-Origin: *`
   - `Cross-Origin-Embedder-Policy: unsafe-none`
   - `Cross-Origin-Resource-Policy: cross-origin`

## Expected Response Headers

After fix, you should see:

```
HTTP/1.1 200 OK
Server: nginx
Content-Type: image/jpeg
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Cross-Origin-Embedder-Policy: unsafe-none
Cross-Origin-Resource-Policy: cross-origin
Cache-Control: public, max-age=3600
...
```

## If Headers Still Missing

1. **Check nginx error logs**: `sudo tail -f /var/log/nginx/error.log`
2. **Verify location block order**: More specific locations must come first
3. **Check if headers are being stripped**: Some nginx modules strip headers
4. **Test backend directly**: `curl -I http://localhost:5000/api/camerapics-s3-test/proxy/...` to see if backend sets headers

