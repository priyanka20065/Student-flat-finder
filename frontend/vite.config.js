import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

// Custom plugin to rewrite clean URLs to their index.html counterparts
function cleanUrlPlugin() {
    return {
        name: 'clean-url-rewrite',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url.split('?')[0]

                // Skip assets, API, and files with extensions
                if (url.startsWith('/api') || url.startsWith('/uploads') || url.includes('.')) {
                    return next()
                }

                // Try [url]/index.html
                const candidate = resolve(__dirname, '.' + url, 'index.html')
                if (fs.existsSync(candidate)) {
                    req.url = url + '/index.html'
                    return next()
                }

                // Handle dynamic routes: /flat/[id] -> /flat/index.html
                if (url.startsWith('/flat/')) {
                    req.url = '/flat/index.html'
                    return next()
                }

                // Handle dynamic routes: /roommate/[id] -> /roommate/index.html
                if (url.startsWith('/roommate/')) {
                    req.url = '/roommate/index.html'
                    return next()
                }

                next()
            })
        }
    }
}

export default defineConfig({
    plugins: [cleanUrlPlugin()],
    server: {
        proxy: {
            '/api': 'http://localhost:4001',
            '/uploads': 'http://localhost:4001',
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                browse: resolve(__dirname, 'browse/index.html'),
                browseMap: resolve(__dirname, 'browse/map/index.html'),
                chat: resolve(__dirname, 'chat/index.html'),
                community: resolve(__dirname, 'community/index.html'),
                dashboard: resolve(__dirname, 'dashboard/index.html'),
                favorites: resolve(__dirname, 'favorites/index.html'),
                feedback: resolve(__dirname, 'feedback/index.html'),
                flat: resolve(__dirname, 'flat/index.html'),
                list: resolve(__dirname, 'list/index.html'),
                login: resolve(__dirname, 'login/index.html'),
                notifications: resolve(__dirname, 'notifications/index.html'),
                personalityQuiz: resolve(__dirname, 'personality-quiz/index.html'),
                profile: resolve(__dirname, 'profile/index.html'),
                reviews: resolve(__dirname, 'reviews/index.html'),
                roommate: resolve(__dirname, 'roommate/index.html'),
                signup: resolve(__dirname, 'signup/index.html'),
                subscription: resolve(__dirname, 'subscription/index.html'),
                notFound: resolve(__dirname, '404.html'),
            }
        }
    }
})
