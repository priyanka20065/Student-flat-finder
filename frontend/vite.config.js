import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

function copyLegacyAssetsPlugin() {
    return {
        name: 'copy-legacy-assets',
        closeBundle() {
            const distDir = resolve(__dirname, 'dist')
            const sourceJsDir = resolve(__dirname, 'js')
            const targetJsDir = resolve(distDir, 'js')

            if (fs.existsSync(sourceJsDir)) {
                fs.mkdirSync(targetJsDir, { recursive: true })
                fs.cpSync(sourceJsDir, targetJsDir, { recursive: true })
            }

            const legacyCssFiles = ['styles.css', 'auth-modern.css']
            legacyCssFiles.forEach((fileName) => {
                const sourceFile = resolve(__dirname, fileName)
                const targetFile = resolve(distDir, fileName)
                if (fs.existsSync(sourceFile)) {
                    fs.copyFileSync(sourceFile, targetFile)
                }
            })
        },
    }
}

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

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const proxyTarget = String(env.VITE_API_BASE_URL || 'http://localhost:4001').replace(/\/$/, '')

    return {
    plugins: [cleanUrlPlugin(), copyLegacyAssetsPlugin()],
    server: {
        proxy: {
            '/api': proxyTarget,
            '/uploads': proxyTarget,
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
                roommateProfile: resolve(__dirname, 'roommate/profile.html'),
                signup: resolve(__dirname, 'signup/index.html'),
                authCallback: resolve(__dirname, 'auth/callback/index.html'),
                subscription: resolve(__dirname, 'subscription/index.html'),
                notFound: resolve(__dirname, '404.html'),
            }
        }
    }
    }
})
