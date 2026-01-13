# Nginx Configuration for /v2/ Path

This document explains how to configure nginx to serve the Angular application at `/v2/` and proxy images from S3.

## Quick Setup

1. **Copy the configuration** from `nginx-v2-config.conf` to your nginx sites-available directory:
   ```bash
   sudo cp nginx-v2-config.conf /etc/nginx/sites-available/lsl-platform-v2
   ```

2. **Update the paths** in the configuration:
   - Replace `/path/to/your/angular/dist/time-laps/` with the actual path to your Angular build output
   - Replace `http://localhost:5000` with your backend server address and port
   - Replace `/path/to/your/media/` with your media directory path (if applicable)

3. **Create a symbolic link** to enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/lsl-platform-v2 /etc/nginx/sites-enabled/
   ```

4. **Test the configuration**:
   ```bash
   sudo nginx -t
   ```

5. **Reload nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

## Key Configuration Points

### 1. Angular App Serving (`/v2/`)
- Serves the Angular application from the dist folder
- Uses `try_files` to handle Angular routing
- Caches static assets for 1 year

### 2. API Proxy (`/api/`)
- Proxies all API requests to the backend server
- Adds CORS headers to allow cross-origin requests
- Handles preflight OPTIONS requests

### 3. Image Proxy (`/api/camerapics-s3-test/proxy/`)
- **Critical**: Disables buffering (`proxy_buffering off`) for streaming images
- Adds CORS headers for image responses
- Caches images for 1 hour
- Increases timeouts for large images

## Important Notes

1. **Image Proxy Buffering**: The `proxy_buffering off` setting is crucial for the image proxy endpoint. Without it, nginx may try to buffer the entire image before sending it, which can cause issues with large images.

2. **CORS Headers**: The configuration adds CORS headers to allow images to be loaded from different origins. This is necessary when the frontend is served from a different domain than the API.

3. **Backend Port**: Make sure the `proxy_pass` directive points to the correct backend server and port (default is `http://localhost:5000`).

4. **HTTPS**: For production, uncomment and configure the HTTPS server block with your SSL certificates.

## Testing

After configuration, test that:
1. The Angular app loads at `https://lsl-platform.com/v2/`
2. API requests work correctly
3. Images load without CORS errors
4. The image proxy endpoint returns images with proper headers

## Troubleshooting

### Images not loading
- Check that the backend proxy endpoint is working: `curl https://lsl-platform.com/api/camerapics-s3-test/proxy/{developerTag}/{projectTag}/{cameraTag}/{timestamp}`
- Verify CORS headers are present in the response
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### 502 Bad Gateway
- Verify the backend server is running on the configured port
- Check backend logs for errors
- Ensure the backend is accessible from nginx

### 404 Not Found
- Verify the Angular dist path is correct
- Check file permissions on the dist directory
- Ensure the `try_files` directive includes `/v2/index.html`

